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
    await logStep('pickPhoto.3b.before-library-permission', {});
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    await logStep('pickPhoto.4b.after-library-permission', { granted: p.granted, status: p.status });
    if (!p.granted) throw new Error('Photo Library permission denied');
  }
  await logStep('pickPhoto.5.before-launch', { source });
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
  await logStep('pickPhoto.6.after-launch', {
    source, canceled: result.canceled, assetCount: result.assets?.length,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

export async function normalize(uri: string): Promise<string> {
  const ImageManipulator = require('expo-image-manipulator');
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512, height: 512 } }],
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
    return json.url;
  } finally {
    clearTimeout(timer);
  }
}
