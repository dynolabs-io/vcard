// Inbox tab — who scanned your card, who's reached out.
//
// Build 126: empty-state stub. Build 130 wires up:
//   • Reach analytics (total scans, peak times, top locations)
//   • Connections (signed-in scanners who opted to reveal themselves)
//   • Leads (people who used the web profile "request callback" form)

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

export default function InboxScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
      </View>

      <View style={styles.empty}>
        <SymbolView name="tray.fill" tintColor="rgba(60,60,67,0.3)"
          resizeMode="scaleAspectFit" style={{ width: 64, height: 64 }} />
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyBody}>
          See who scanned your card, where, and when. Track leads from
          people who reached out through your public profile.
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600' },
  emptyBody: { fontSize: 15, textAlign: 'center', opacity: 0.7, lineHeight: 22 },
  emptySoon: { fontSize: 12, color: '#0A66C2', marginTop: 4, fontWeight: '500' },
});
