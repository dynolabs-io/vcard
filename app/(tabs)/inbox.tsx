// Inbox tab — who has interacted with YOUR cards.
//
// Three sections:
//   • Reach       — totalScans, last7Days, last30Days, uniqueUsers
//   • Connections — coming in a follow-up (mutual reveal flow)
//   • Leads       — people who used the "request callback" form on
//                   your public web profile dynolabs.io/c/<slug>
//
// All require sign-in (the server can only attribute reach/leads to
// a user via their card's user_id). Anonymous users see a sign-in CTA.

import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { api, type InboxSummary, type Lead, type RevealedScanner, type ReachStats } from '@/lib/api';
import { getAuthSnapshot } from '@/lib/auth';
import { listCards } from '@/lib/storage';
import type { Card } from '@/lib/types';

export default function InboxScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [connections, setConnections] = useState<RevealedScanner[]>([]);
  const [reach, setReach] = useState<ReachStats | null>(null);
  const [signedIn, setSignedIn] = useState(getAuthSnapshot().signedIn);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setSignedIn(getAuthSnapshot().signedIn);
    if (!getAuthSnapshot().signedIn) {
      setSummary(null);
      setLeads([]);
      setConnections([]);
      setReach(null);
      return () => {};
    }
    (async () => {
      try {
        const [s, l, c] = await Promise.all([
          api.scansInbox(),
          api.leadsList(),
          api.connectionsList(),
        ]);
        if (cancelled) return;
        setSummary(s);
        setLeads(l);
        setConnections(c);
        // TBD-V09: fetch per-card reach for the user's first slugged
        // card. The new /v1/inbox/reach endpoint (TBD-V08) returns
        // profile/vcf/pkpass intent-level breakdown that the scansInbox
        // summary alone can't express.
        const cards = await listCards();
        const primary = cards.find((c: Card) => Boolean(c.slug));
        if (primary?.slug) {
          try {
            const r = await api.inboxReach(primary.slug);
            if (!cancelled) setReach(r);
          } catch { /* reach is optional — not signed-in / not owner / etc. */ }
        }
      } catch { /* offline ok */ }
    })();
    return () => { cancelled = true; };
  }, []));

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}><Text style={styles.title}>Inbox</Text></View>
        <View style={styles.empty}>
          <SymbolView name="tray.fill" tintColor="rgba(60,60,67,0.3)"
            resizeMode="scaleAspectFit" style={{ width: 64, height: 64 }} />
          <Text style={styles.emptyTitle}>Sign in to see your inbox</Text>
          <Text style={styles.emptyBody}>
            Once signed in you can see who scanned your card, where they
            were, and any callback requests from your public profile.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/account')}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const empty = !summary || (summary.totalScans === 0 && leads.length === 0 && connections.length === 0);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}><Text style={styles.title}>Inbox</Text></View>
      {empty ? (
        <View style={styles.empty}>
          <SymbolView name="tray.fill" tintColor="rgba(60,60,67,0.3)"
            resizeMode="scaleAspectFit" style={{ width: 64, height: 64 }} />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>
            Share your card to see scan stats and callback requests here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            summary ? (
              <View style={styles.reach}>
                <Text style={styles.sectionTitle}>REACH</Text>
                <View style={styles.reachGrid}>
                  <Stat label="Total scans" value={summary.totalScans} />
                  <Stat label="Last 7 days" value={summary.last7Days} />
                  <Stat label="Last 30 days" value={summary.last30Days} />
                  <Stat label="Unique users" value={summary.uniqueUsers} />
                </View>
                {reach && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>BY INTENT (last 30 days)</Text>
                    <View style={styles.reachGrid}>
                      <Stat label="Profile views" value={reach.totals.profile} />
                      <Stat label="Contact saves" value={reach.totals.vcf} />
                      <Stat label="Wallet adopts" value={reach.totals.pkpass} />
                    </View>
                  </>
                )}
                {connections.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>CONNECTIONS</Text>
                    {connections.map(c => (
                      <View key={c.userId + c.scannedAt} style={styles.connectionRow}>
                        <Text style={styles.connName}>{c.name || c.email || '(unknown)'}</Text>
                        <Text style={styles.connMeta}>
                          {c.placeName ? `📍 ${c.placeName} · ` : ''}
                          {c.eventName ? `📅 ${c.eventName} · ` : ''}
                          {new Date(c.scannedAt).toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>LEADS</Text>
                {leads.length === 0 && (
                  <Text style={styles.smallHint}>
                    No callback requests yet. Share your dynolabs.io/c/{'<slug>'}
                    link — visitors can use the {'"request callback"'} form there.
                  </Text>
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.leadRow}
              onPress={() => {
                if (item.fromEmail) {
                  Linking.openURL(`mailto:${item.fromEmail}`).catch(() => {});
                } else if (item.fromPhone) {
                  Linking.openURL(`tel:${item.fromPhone}`).catch(() => {});
                }
              }}
            >
              <Text style={styles.leadName}>
                {item.fromName || item.fromEmail || item.fromPhone || '(anonymous)'}
              </Text>
              {item.message ? (
                <Text style={styles.leadMessage} numberOfLines={3}>{item.message}</Text>
              ) : null}
              <View style={styles.leadMeta}>
                {item.fromEmail ? <Text style={styles.leadMetaText}>✉️ {item.fromEmail}</Text> : null}
                {item.fromPhone ? <Text style={styles.leadMetaText}>📞 {item.fromPhone}</Text> : null}
                <Text style={styles.leadMetaText}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600' },
  emptyBody: { fontSize: 15, textAlign: 'center', opacity: 0.7, lineHeight: 22 },
  cta: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#0A66C2' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reach: { paddingHorizontal: 20, paddingTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, opacity: 0.55, marginBottom: 10 },
  reachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flex: 1, minWidth: '47%', padding: 16, borderRadius: 14, backgroundColor: 'rgba(127,127,127,0.08)' },
  statValue: { fontSize: 28, fontWeight: '700', color: '#0A66C2' },
  statLabel: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  smallHint: { fontSize: 13, opacity: 0.6, lineHeight: 19, marginBottom: 12 },
  leadRow: { marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 14, backgroundColor: 'rgba(127,127,127,0.08)' },
  leadName: { fontSize: 16, fontWeight: '600' },
  leadMessage: { fontSize: 13, opacity: 0.8, marginTop: 4, lineHeight: 18 },
  leadMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  leadMetaText: { fontSize: 11, color: 'rgba(60,60,67,0.55)' },
  connectionRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.2)' },
  connName: { fontSize: 14, fontWeight: '500' },
  connMeta: { fontSize: 11, color: 'rgba(60,60,67,0.55)', marginTop: 2 },
});
