// Rolodex storage — local-first, server-sync when signed in.
//
// Anonymous flow: scans live in AsyncStorage only. Signing in later
// uploads them via POST /v1/scans and they become part of the user's
// account-bound rolodex (synced across devices).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { getAuthSnapshot } from './auth';

const KEY = 'dynolabs.scans.v1';

export type ScanRecord = {
  id: string;             // local UUID; replaced with server id once uploaded
  serverId?: string;      // server id once synced
  targetSlug: string;
  /** Snapshot of the card at scan time. We DON'T use this to display
   *  in the rolodex — we always fetch the latest from the server. This
   *  is only the offline fallback when the card is unreachable. */
  cardSnapshot?: {
    name: string;
    title?: string;
    company?: string;
    phones?: string[];
    emails?: string[];
    photoUrl?: string;
  };
  notes: string;
  tags: string[];
  lat?: number;
  lon?: number;
  placeName?: string;
  eventName?: string;
  /** Opt-in: when true, owner of the scanned card can see WHO scanned
   *  them in their Inbox. Defaults to false (anonymous). */
  reveal?: boolean;
  scannedAt: string;     // ISO
  createdAt: string;
  updatedAt: string;
};

function freshId(): string {
  const a = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

async function readAll(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanRecord[];
  } catch {
    return [];
  }
}

async function writeAll(scans: ScanRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(scans));
}

export async function listScans(): Promise<ScanRecord[]> {
  const local = await readAll();
  // Newest first.
  return [...local].sort((a, b) => +new Date(b.scannedAt) - +new Date(a.scannedAt));
}

export async function getScan(id: string): Promise<ScanRecord | null> {
  const all = await readAll();
  return all.find(s => s.id === id) ?? null;
}

export async function createScan(
  input: Omit<ScanRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ScanRecord> {
  const now = new Date().toISOString();
  const rec: ScanRecord = {
    id: freshId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  const all = await readAll();
  all.push(rec);
  await writeAll(all);
  // Best-effort sync to server when signed in.
  if (getAuthSnapshot().signedIn) {
    try {
      const remote = await api.scansCreate({
        targetSlug: rec.targetSlug,
        notes: rec.notes,
        tags: rec.tags,
        lat: rec.lat,
        lon: rec.lon,
        placeName: rec.placeName,
        eventName: rec.eventName,
        reveal: rec.reveal,
        scannedAt: rec.scannedAt,
      });
      rec.serverId = remote.id;
      await writeAll(all);
    } catch { /* offline ok */ }
  }
  return rec;
}

export async function updateScan(id: string, patch: Partial<ScanRecord>): Promise<ScanRecord | null> {
  const all = await readAll();
  const idx = all.findIndex(s => s.id === id);
  if (idx < 0) return null;
  const next: ScanRecord = {
    ...all[idx],
    ...patch,
    id: all[idx].id,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  await writeAll(all);
  if (next.serverId && getAuthSnapshot().signedIn) {
    try {
      await api.scansUpdate(next.serverId, {
        notes: next.notes,
        tags: next.tags,
        placeName: next.placeName,
        eventName: next.eventName,
      });
    } catch {}
  }
  return next;
}

export async function deleteScan(id: string): Promise<void> {
  const all = await readAll();
  const rec = all.find(s => s.id === id);
  const next = all.filter(s => s.id !== id);
  await writeAll(next);
  if (rec?.serverId && getAuthSnapshot().signedIn) {
    try { await api.scansDelete(rec.serverId); } catch {}
  }
}

/** Merge the user's server scans into local store (run after sign-in). */
export async function pullServerScans(): Promise<{ added: number }> {
  if (!getAuthSnapshot().signedIn) return { added: 0 };
  try {
    const remote = await api.scansList();
    const local = await readAll();
    const haveServerIds = new Set(local.map(s => s.serverId).filter(Boolean));
    let added = 0;
    for (const r of remote) {
      if (haveServerIds.has(r.id)) continue;
      local.push({
        id: freshId(),
        serverId: r.id,
        targetSlug: r.targetSlug,
        notes: r.notes ?? '',
        tags: r.tags ?? [],
        lat: r.lat,
        lon: r.lon,
        placeName: r.placeName,
        eventName: r.eventName,
        scannedAt: r.scannedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
      added++;
    }
    if (added > 0) await writeAll(local);
    return { added };
  } catch {
    return { added: 0 };
  }
}

/** Push any local-only scans (no serverId) to the server. */
export async function pushLocalScans(): Promise<{ pushed: number }> {
  if (!getAuthSnapshot().signedIn) return { pushed: 0 };
  const all = await readAll();
  let pushed = 0;
  for (const rec of all) {
    if (rec.serverId) continue;
    try {
      const remote = await api.scansCreate({
        targetSlug: rec.targetSlug,
        notes: rec.notes,
        tags: rec.tags,
        lat: rec.lat,
        lon: rec.lon,
        placeName: rec.placeName,
        eventName: rec.eventName,
        scannedAt: rec.scannedAt,
      });
      rec.serverId = remote.id;
      pushed++;
    } catch {}
  }
  if (pushed > 0) await writeAll(all);
  return { pushed };
}

/** Helper: collect tags ever used across all scans for picker reuse. */
export async function knownTags(): Promise<string[]> {
  const all = await readAll();
  const set = new Set<string>();
  for (const s of all) for (const t of s.tags) set.add(t);
  return [...set].sort();
}
