// "Me" tab — settings + connected accounts + about. v1 stub — wallet
// connectors and LinkedIn auto-fill light up in Phase 7.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { config } from '@/lib/config';

export default function MeScreen() {
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.healthz().then(r => setVersion(r.version)).catch(e => setError(String(e)));
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Me</Text>
      </View>

      <Section title="Connect accounts">
        <Pressable style={styles.row} onPress={() => alert('LinkedIn connect — wires up in Phase 7')}>
          <Text style={styles.rowLabel}>LinkedIn</Text>
          <Text style={styles.rowValue}>Not connected</Text>
        </Pressable>
      </Section>

      <Section title="Backend">
        <Row label="API" value={config.apiBase} />
        <Row label="Status" value={error ?? (version ? `OK · ${version}` : '…')} />
      </Section>

      <Section title="About">
        <Row label="Version" value="0.1.0" />
        <Row label="Build" value="dev" />
      </Section>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.6, marginBottom: 8, paddingHorizontal: 4 },
  card: { backgroundColor: 'rgba(127,127,127,0.08)', borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(127,127,127,0.2)' },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 14, opacity: 0.7, flexShrink: 1, marginLeft: 16 },
});
