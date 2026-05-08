// New-card form. Minimal v1 — name, title, company, one email, one phone.
// LinkedIn-connect auto-fill, multi-email/phone, social links, photo
// picker, template chooser all light up in Phase 7.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveCard } from '@/lib/storage';
import { emptyCard } from '@/lib/types';

export default function NewCard() {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyCard());
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const onSave = () => {
    if (!draft.name.trim()) return;
    const next = { ...draft, emails: email ? [email] : [], phones: phone ? [phone] : [] };
    saveCard(next);
    router.back();
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Field label="Label">
          <TextInput
            style={styles.input}
            value={draft.label}
            onChangeText={t => setDraft({ ...draft, label: t })}
            placeholder="Work, Personal, …"
          />
        </Field>
        <Field label="Name">
          <TextInput
            style={styles.input}
            value={draft.name}
            onChangeText={t => setDraft({ ...draft, name: t })}
            placeholder="Ali Eren Baysal"
            autoFocus
          />
        </Field>
        <Field label="Title">
          <TextInput
            style={styles.input}
            value={draft.title ?? ''}
            onChangeText={t => setDraft({ ...draft, title: t })}
            placeholder="Founder"
          />
        </Field>
        <Field label="Company">
          <TextInput
            style={styles.input}
            value={draft.company ?? ''}
            onChangeText={t => setDraft({ ...draft, company: t })}
            placeholder="Dynolabs"
          />
        </Field>
        <Field label="Email">
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ali@dynolabs.io"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </Field>
        <Field label="Phone">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 0100"
            keyboardType="phone-pad"
          />
        </Field>

        <Pressable style={[styles.cta, !draft.name.trim() && styles.ctaDisabled]} onPress={onSave} disabled={!draft.name.trim()}>
          <Text style={styles.ctaText}>Save card</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.08)', fontSize: 16 },
  cta: { padding: 16, borderRadius: 999, backgroundColor: '#111', alignItems: 'center', marginTop: 12 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
