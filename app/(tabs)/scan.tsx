// QR scan tab. Opens the rear camera and listens for QR codes containing
// vCard 3.0 text. Successful scan offers to save to the device's native
// Contacts via expo-contacts (added in Phase 7) or a deep link to the
// system handler in v1.

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);

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

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : (event) => setScanned(event.data)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.hint}>Point camera at a vCard QR</Text>
        {scanned && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>Got it</Text>
            <Text numberOfLines={6} style={styles.previewBody}>{scanned}</Text>
            <Pressable style={styles.cta} onPress={() => setScanned(null)}>
              <Text style={styles.ctaText}>Scan another</Text>
            </Pressable>
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
  hint: { color: '#fff', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 8, borderRadius: 999 },
  preview: { backgroundColor: 'rgba(255,255,255,0.95)', padding: 20, borderRadius: 20, gap: 12 },
  previewTitle: { fontSize: 18, fontWeight: '700' },
  previewBody: { fontFamily: 'Menlo', fontSize: 11 },
  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111', alignSelf: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
