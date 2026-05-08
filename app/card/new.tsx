// New-card form with: LinkedIn auto-fill, template picker, custom color
// picker, manual fields. KeyboardAvoidingView keeps the CTA always visible.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { createCardSynced } from '@/lib/sync';
import { CUSTOM_COLORS, TEMPLATES, templateStyle } from '@/lib/templates';
import { emptyCard, type CardTemplate } from '@/lib/types';

export default function NewCard() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState(emptyCard());
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // No deep-link listener needed — we poll /oauth/linkedin/result after
  // openAuthSessionAsync returns.

  const onSave = async () => {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      const next = { ...draft, emails: email ? [email] : [], phones: phone ? [phone] : [] };
      await createCardSynced(next);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onConnectLinkedIn = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const state = Math.random().toString(36).slice(2);
      const redirect = Linking.createURL('oauth/linkedin');
      const { url } = await api.linkedinAuthorize(state, redirect);
      const result = await WebBrowser.openAuthSessionAsync(url, redirect);
      if (result.type !== 'success') {
        // user cancelled, browser dismissed, or unsupported — not an error.
        return;
      }
      // Browser closed via deep-link. Pull the profile from the backend.
      const p = await api.linkedinResult(state);
      setDraft(d => ({
        ...d,
        name: p.name || d.name,
        title: d.title,
        company: d.company,
        photoUrl: p.picture || d.photoUrl,
      }));
      if (p.email) setEmail(p.email);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'connect failed';
      alert(`LinkedIn: ${msg}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
        >
          <Pressable
            onPress={onConnectLinkedIn}
            disabled={connecting}
            style={[styles.linkedinBtn, connecting && styles.disabled]}
          >
            <Text style={styles.linkedinText}>
              {connecting ? 'Opening LinkedIn…' : 'Connect LinkedIn (auto-fill)'}
            </Text>
          </Pressable>
          <Text style={styles.hint}>or fill in manually</Text>

          <Field label="Label">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.label} onChangeText={t => setDraft({ ...draft, label: t })}
              placeholder="Work, Personal, …" placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next" />
          </Field>
          <Field label="Name">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.name} onChangeText={t => setDraft({ ...draft, name: t })}
              placeholder="Ali Eren Baysal" placeholderTextColor={isDark ? '#666' : '#999'}
              autoFocus returnKeyType="next" />
          </Field>
          <Field label="Title">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.title ?? ''} onChangeText={t => setDraft({ ...draft, title: t })}
              placeholder="Founder" placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next" />
          </Field>
          <Field label="Company">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.company ?? ''} onChangeText={t => setDraft({ ...draft, company: t })}
              placeholder="Dynolabs" placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next" />
          </Field>
          <Field label="Email">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={email} onChangeText={setEmail}
              placeholder="ali@dynolabs.io" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              returnKeyType="next" />
          </Field>
          <Field label="Phone">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={phone} onChangeText={setPhone}
              placeholder="+1 555 0100" placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={onSave} />
          </Field>

          <Field label="Template">
            <View style={styles.templateRow}>
              {TEMPLATES.map(t => {
                const selected = draft.template === t.id;
                const preview = t.preview;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setDraft({ ...draft, template: t.id as CardTemplate })}
                    style={[
                      styles.templateChip,
                      { backgroundColor: preview.card.backgroundColor || preview.card.backgroundGradient?.[0] || '#0B0B0F' },
                      selected && styles.templateChipSelected,
                    ]}
                  >
                    <Text style={[styles.templateName, { color: preview.name.color }]}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
          {draft.template === 'custom' && (
            <Field label="Accent color">
              <View style={styles.colorRow}>
                {CUSTOM_COLORS.map(c => {
                  const selected = (draft.customColor || CUSTOM_COLORS[0]) === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setDraft({ ...draft, customColor: c })}
                      style={[styles.swatch, { backgroundColor: c }, selected && styles.swatchSelected]}
                    />
                  );
                })}
              </View>
            </Field>
          )}

          {/* Live preview */}
          <View style={[styles.preview, {
            backgroundColor: templateStyle(draft.template, draft.customColor).card.backgroundColor
              || templateStyle(draft.template, draft.customColor).card.backgroundGradient?.[0]
              || '#0B0B0F'
          }]}>
            <Text style={[styles.pLabel, templateStyle(draft.template, draft.customColor).label]}>{draft.label || 'WORK'}</Text>
            <Text style={[styles.pName,  templateStyle(draft.template, draft.customColor).name]}>{draft.name || 'Your name'}</Text>
            {!!draft.title   && <Text style={[styles.pTitle, templateStyle(draft.template, draft.customColor).title]}>{draft.title}</Text>}
            {!!draft.company && <Text style={[styles.pCompany, templateStyle(draft.template, draft.customColor).company]}>{draft.company}</Text>}
          </View>

          <Pressable
            style={[styles.cta, (!draft.name.trim() || saving) && styles.disabled]}
            onPress={onSave}
            disabled={!draft.name.trim() || saving}
          >
            <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Save card'}</Text>
          </Pressable>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.08)', fontSize: 16, color: '#000' },
  inputDark: { color: '#fff' },
  cta: { padding: 16, borderRadius: 999, backgroundColor: '#111', alignItems: 'center', marginTop: 12 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  linkedinBtn: { padding: 14, borderRadius: 12, backgroundColor: '#0A66C2', alignItems: 'center' },
  linkedinText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { textAlign: 'center', fontSize: 12, opacity: 0.5, marginTop: 4 },
  templateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  templateChip: { padding: 12, borderRadius: 12, minWidth: 72, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  templateChipSelected: { borderColor: '#0A66C2' },
  templateName: { fontSize: 13, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: '#000' },
  preview: { padding: 18, borderRadius: 18, marginTop: 4 },
  pLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  pName: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  pTitle: { fontSize: 14, marginTop: 2 },
  pCompany: { fontSize: 13, marginTop: 1 },
});
