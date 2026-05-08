// QR scan tab. Opens the rear camera, decodes vCard 3.0 QRs, and offers
// to save the contact to the device's native address book.
//
// Two QR shapes are supported in the wild: raw vCard text (BEGIN:VCARD …)
// and a URL pointing to dynolabs.io/c/<slug>. For URLs we open the browser
// — the recipient lands on the styled web profile and taps Save.

import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseVCard, saveToContacts } from '@/lib/contacts';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Loading camera…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.body}>Needed to scan vCard QR codes from other people.</Text>
        <Pressable style={styles.cta} onPress={requestPermission}>
          <Text style={styles.ctaText}>Grant access</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const onSave = async () => {
    if (!scanned || busy) return;
    setBusy(true);
    try {
      if (scanned.startsWith('BEGIN:VCARD')) {
        const card = parseVCard(scanned);
        const ok = await saveToContacts(card);
        if (!ok) {
          Alert.alert('Permission needed', 'Allow Contacts access in Settings to save.');
        } else {
          Alert.alert('Saved', card.name ? `${card.name} added to your Contacts.` : 'Contact saved.');
          setScanned(null);
        }
      } else if (/^https?:/.test(scanned)) {
        await Linking.openURL(scanned);
        setScanned(null);
      } else {
        Alert.alert('Unsupported QR', 'This QR is not a vCard.');
      }
    } catch (e: unknown) {
      Alert.alert('Failed to save', (e as { message?: string })?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const isVCard = scanned?.startsWith('BEGIN:VCARD');
  const isUrl   = scanned ? /^https?:/.test(scanned) : false;
  const parsed  = isVCard && scanned ? parseVCard(scanned) : null;

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : (event) => setScanned(event.data)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frameOuter}>
          <View style={styles.frameInner} />
        </View>
        <Text style={styles.hint}>Point camera at a vCard QR</Text>
        {scanned && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>
              {isVCard ? (parsed?.name || 'Contact found') : isUrl ? 'Profile link' : 'Got it'}
            </Text>
            {parsed && (
              <View style={styles.previewBody}>
                {parsed.title && <Text style={styles.previewLine}>{parsed.title}{parsed.company ? ` · ${parsed.company}` : ''}</Text>}
                {parsed.emails.slice(0,1).map(e => <Text key={e} style={styles.previewLine}>{e}</Text>)}
                {parsed.phones.slice(0,1).map(p => <Text key={p} style={styles.previewLine}>{p}</Text>)}
              </View>
            )}
            {isUrl && !isVCard && (
              <Text style={styles.previewLine} numberOfLines={1}>{scanned}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable style={[styles.cta, { flex: 1, opacity: busy ? 0.4 : 1 }]} onPress={onSave} disabled={busy}>
                <Text style={styles.ctaText}>
                  {busy ? '…' : isVCard ? 'Save to Contacts' : isUrl ? 'Open' : 'OK'}
                </Text>
              </Pressable>
              <Pressable style={[styles.cta, styles.secondary, { flex: 1 }]} onPress={() => setScanned(null)}>
                <Text style={[styles.ctaText, { color: '#000' }]}>Scan another</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 24 },
  frameOuter: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  frameInner: { width: 240, height: 240, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 16 },
  hint: { color: '#fff', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 8, borderRadius: 999 },
  preview: { backgroundColor: 'rgba(255,255,255,0.95)', padding: 20, borderRadius: 20, gap: 8 },
  previewTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  previewBody: { gap: 4 },
  previewLine: { fontSize: 13, color: '#333' },
  cta: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111', alignItems: 'center' },
  secondary: { backgroundColor: 'rgba(0,0,0,0.08)' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
