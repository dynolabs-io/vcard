// Scan a QR code — camera viewport that recognises any vCard or
// Dynolabs URL QR. On scan: parse the payload, fetch the card from
// the server (online mode) or use the embedded vCard text (offline
// mode), open the save sheet at /scan/save with the parsed card +
// auto-captured context (GPS, calendar event).
//
// Anonymous users: scan and save locally. Signed-in: also syncs to
// the user's server-side rolodex.

import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { SymbolView } from 'expo-symbols';
import { api, profileUrl } from '@/lib/api';
import { config } from '@/lib/config';
import type { Card } from '@/lib/types';

// vCard or URL — detect which.
function parseScanned(data: string): { kind: 'url'; slug: string } | { kind: 'vcard'; text: string } | null {
  const trimmed = data.trim();
  if (trimmed.startsWith('BEGIN:VCARD')) return { kind: 'vcard', text: trimmed };
  // Match either /v/<slug> (online-mode QR) or /c/<slug> (web profile).
  const m = trimmed.match(/^https?:\/\/[^/]+\/(?:v|c)\/([a-z2-9-]+)$/i);
  if (m) return { kind: 'url', slug: m[1] };
  return null;
}

// Parse a vCard 3.0 text into a minimal Card-like shape.
function parseVCard(text: string): Partial<Card> {
  const lines = text.split(/\r?\n/);
  const phones: string[] = [];
  const emails: string[] = [];
  let name = '', title = '', company = '', photoUrl = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('FN:')) name = line.slice(3);
    else if (line.startsWith('TITLE:')) title = line.slice(6);
    else if (line.startsWith('ORG:')) company = line.slice(4);
    else if (line.startsWith('TEL') && line.includes(':')) phones.push(line.split(':').slice(1).join(':'));
    else if (line.startsWith('EMAIL') && line.includes(':')) emails.push(line.split(':').slice(1).join(':'));
    else if (line.startsWith('PHOTO;VALUE=URI:')) photoUrl = line.slice('PHOTO;VALUE=URI:'.length);
  }
  return { name, title, company, phones, emails, photoUrl };
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lastData = useRef<string>('');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const onBarcode = async (r: BarcodeScanningResult) => {
    if (scanned) return;
    if (r.data === lastData.current) return;
    lastData.current = r.data;
    const parsed = parseScanned(r.data);
    if (!parsed) {
      // Ignore non-vCard / non-Dynolabs QRs silently — keep scanning.
      return;
    }
    setScanned(true);
    try {
      let slug = '';
      let card: Partial<Card> = {};
      if (parsed.kind === 'url') {
        slug = parsed.slug;
        try {
          const full = await api.publicCard(slug);
          card = full;
        } catch {
          // Offline — server unreachable. Show a minimal record.
          card = { name: '(offline scan)' };
        }
      } else {
        card = parseVCard(parsed.text);
        // If the vCard had our profile URL, extract slug.
        const m = parsed.text.match(new RegExp(`/c/([a-z2-9-]+)`));
        if (m) slug = m[1];
      }
      router.replace({
        pathname: '/scan/save',
        params: {
          slug,
          name: card.name || '',
          title: card.title || '',
          company: card.company || '',
          phone: card.phones?.[0] || '',
          email: card.emails?.[0] || '',
          photoUrl: card.photoUrl || (slug ? `${config.cdnBase}/p/${slug}` : ''),
        },
      });
    } catch (e) {
      Alert.alert('Scan failed', String(e));
      setScanned(false);
    }
  };

  if (!permission) {
    return <SafeAreaView style={styles.root} />;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen options={{ title: 'Scan card' }} />
        <View style={styles.permPrompt}>
          <SymbolView name="qrcode.viewfinder" tintColor="#0A66C2"
            resizeMode="scaleAspectFit" style={{ width: 64, height: 64 }} />
          <Text style={styles.permTitle}>Camera access required</Text>
          <Text style={styles.permBody}>
            Allow camera to scan Dynolabs cards into your rolodex.
          </Text>
          <Pressable onPress={requestPermission} style={styles.cta}>
            <Text style={styles.ctaText}>Allow camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ title: 'Scan card' }} />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onBarcode}
      />
      <View pointerEvents="none" style={styles.frame}>
        <View style={styles.viewfinder} />
        <Text style={styles.hint}>Aim at a Dynolabs QR</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  permTitle: { fontSize: 22, fontWeight: '600', color: '#fff' },
  permBody: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  cta: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#0A66C2' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  frame: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinder: { width: 260, height: 260, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 24 },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 18 },
});
