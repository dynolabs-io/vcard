// Scanned tab — your private rolodex of cards you've scanned.
//
// Build 126: empty-state stub. Build 127 wires up:
//   • iOS Contacts permission + match-by-slug + sync banner
//   • Camera viewport for scanning new QRs
//   • Context capture: GPS + EventKit calendar + notes + tags
//   • Search & facet filters (company, event, location, date)

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

export default function ScannedScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Scanned</Text>
        <Pressable
          style={styles.scanBtn}
          accessibilityLabel="Scan QR"
          testID="scanned-scan"
          onPress={() => {/* Build 127: open camera */}}
        >
          <SymbolView name="qrcode.viewfinder" tintColor="#0A66C2"
            resizeMode="scaleAspectFit" style={{ width: 22, height: 22 }} weight="semibold" />
        </Pressable>
      </View>

      <View style={styles.empty}>
        <SymbolView name="qrcode.viewfinder" tintColor="rgba(60,60,67,0.3)"
          resizeMode="scaleAspectFit" style={{ width: 64, height: 64 }} />
        <Text style={styles.emptyTitle}>No scanned cards yet</Text>
        <Text style={styles.emptyBody}>
          Scan someone's Dynolabs QR to save their card here. Notes, tags,
          location and event are captured automatically.
        </Text>
        <Text style={styles.emptySoon}>Ships in the next update.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  scanBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600' },
  emptyBody: { fontSize: 15, textAlign: 'center', opacity: 0.7, lineHeight: 22 },
  emptySoon: { fontSize: 12, color: '#0A66C2', marginTop: 4, fontWeight: '500' },
});
