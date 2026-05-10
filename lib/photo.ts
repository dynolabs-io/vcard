// Photo picker + upload — lazy-loaded so the new-card form opens even
// if expo-image-picker fails to bind native module on iOS 26 / new arch.

import { config } from './config';

export type Source = 'camera' | 'library';

export async function pickPhoto(source: Source): Promise<string | null> {
  const ImagePicker = require('expo-image-picker');
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Camera permission denied');
  } else {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) throw new Error('Photo Library permission denied');
  }
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
