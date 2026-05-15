// Photo picker + upload — lazy-loaded so the new-card form opens even
// if expo-image-picker fails to bind native module on iOS 26 / new arch.

import { config } from './config';

export type Source = 'camera' | 'library';

async function logStep(step: string, ctx: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${config.apiBase}/v1/crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: step, ...ctx, ts: new Date().toISOString() }),
    });
  } catch { /* never throw from logger */ }
}

// Pre-warm the native module so the FIRST picker open doesn't pay the
// cold-start cost (expo-image-picker binds a native bridge on first
// require — that adds 1–3 s on iOS 26). Call this once shortly after
// app launch; subsequent require()s return the cached module instantly.
//
// Per [[native-modules-lazy-only-iOS26]] we still call require() at
// call time (not a top-level import). This helper just pulls the
// reference into memory before the user taps Add photo.
let _warmedPicker = false;
export function prewarmImagePicker(): void {
  if (_warmedPicker) return;
  _warmedPicker = true;
  try { require('expo-image-picker'); } catch { /* ignore */ }
  try { require('expo-image-manipulator'); } catch { /* ignore */ }
}

export async function pickPhoto(source: Source): Promise<string | null> {
  await logStep('pickPhoto.1.before-require', { source });
  const ImagePicker = require('expo-image-picker');
  await logStep('pickPhoto.2.after-require', {
    source,
    hasImagePicker: !!ImagePicker,
    hasLaunchLibrary: !!ImagePicker?.launchImageLibraryAsync,
    hasLaunchCamera: !!ImagePicker?.launchCameraAsync,
  });
  if (source === 'camera') {
    await logStep('pickPhoto.3a.before-camera-permission', {});
    const p = await ImagePicker.requestCameraPermissionsAsync();
    await logStep('pickPhoto.4a.after-camera-permission', { granted: p.granted, status: p.status });
    if (!p.granted) throw new Error('Camera permission denied');
  } else {
    // Photo Library: iOS 14+ PHPicker runs out-of-process and doesn't
    // require permission — but if the user previously chose "Limited
    // Access" iOS shows a banner ("Select More Photos / Keep Current
    // Selection") inside the picker. Asking for FULL access here, with
    // `granularPermissions: ['photo']`, gives the user a chance to flip
    // to "Allow Access to All Photos" and stop the limited banner. If
    // they decline, we silently fall back to PHPicker (which still
    // works without any permission). Either way the picker opens.
    try {
      await logStep('pickPhoto.3b.before-library-permission', {});
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync(false, ['photo']);
      await logStep('pickPhoto.4b.after-library-permission', { granted: p.granted, status: p.status, accessPrivileges: p.accessPrivileges });
    } catch { /* PHPicker works without permission too */ }
  }
  await logStep('pickPhoto.5.before-launch', { source });
  // `allowsEditing: true` invokes iOS's native crop sheet AFTER the
  // user picks an asset — that adds 1–3 s every time. We do our own
  // square center-crop in normalize() (which already resizes for
  // upload), so skip the system editor and return immediately.
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        // Default to the front (selfie) camera for face-photo cards.
        // The CameraType enum was renamed across versions; pass both
        // the enum value (when present) AND the literal string so the
        // native module accepts whichever it understands.
        cameraType: ImagePicker?.CameraType?.front ?? 'front',
        quality: 0.9,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
  await logStep('pickPhoto.6.after-launch', {
    source, canceled: result.canceled, assetCount: result.assets?.length,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

// Resize + square center-crop to 512×512 JPEG. Replaces the system
// editing screen we used to invoke via allowsEditing: true.
export async function normalize(uri: string): Promise<string> {
  const ImageManipulator = require('expo-image-manipulator');
  // First inspect dimensions so we can compute the center-crop square.
  // manipulateAsync with [{}] (no ops) returns width/height in result.
  const probe = await ImageManipulator.manipulateAsync(uri, [], { base64: false });
  const w = probe.width as number, h = probe.height as number;
  const sz = Math.min(w, h);
  const ox = Math.max(0, Math.floor((w - sz) / 2));
  const oy = Math.max(0, Math.floor((h - sz) / 2));
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX: ox, originY: oy, width: sz, height: sz } },
      { resize: { width: 512, height: 512 } },
    ],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return out.uri;
}

export async function uploadPhoto(slug: string, localUri: string): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const upload = await fetch(`${config.cdnBase}/p/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
      signal: ctrl.signal,
    });
    if (!upload.ok) throw new Error(`upload failed: HTTP ${upload.status}`);
    const json = (await upload.json()) as { url?: string };
    if (!json.url) throw new Error('upload returned no url');
    // Append cache-busting param so the next time the user uploads a
    // new photo for the same slug, iOS/RN Image doesn't show the
    // previously cached version. The pass-signer + downstream readers
    // strip the ?v= silently.
    return `${json.url}?v=${Date.now()}`;
  } finally {
    clearTimeout(timer);
  }
}
