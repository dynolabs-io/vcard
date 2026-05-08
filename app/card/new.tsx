// New-card form. Minimal v1 — name, title, company, one email, one phone.
// LinkedIn-connect auto-fill button kicks the OAuth flow; on return the
// form prefills with the LinkedIn profile.

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
import { emptyCard } from '@/lib/types';

export default function NewCard() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState(emptyCard());
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Listen for the deep-link return from the LinkedIn callback. The
  // backend redirects to dynolabs-vcard://oauth/linkedin?profile=<base64>
  // which expo-linking captures and routes here.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === 'oauth/linkedin' && parsed.queryParams?.profile) {
        try {
          const json = atob(String(parsed.queryParams.profile));
          const p = JSON.parse(json);
          setDraft(d => ({
            ...d,
            name: p.name || d.name,
            title: p.headline || p.title || d.title,
            company: p.company || d.company,
            photoUrl: p.picture || d.photoUrl,
          }));
          if (p.email) setEmail(p.email);
        } catch {
          // ignore malformed payload
        }
      }
    });
    return () => sub.remove();
  }, []);

  const onSave = async () => {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      const next = { ...draft, emails: email ? [email] : [], phones: phone ? [phone] : [] };
      await createCardSynced(next);
      router.back();
    } finally {
      // ALWAYS reset — sync-layer is bounded by api timeout, but we still
      // want the user to retry if something unexpected throws.
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
      await WebBrowser.openAuthSessionAsync(url, redirect);
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
              value={draft.label}
              onChangeText={t => setDraft({ ...draft, label: t })}
              placeholder="Work, Personal, …"
              placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next"
            />
          </Field>
          <Field label="Name">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.name}
              onChangeText={t => setDraft({ ...draft, name: t })}
              placeholder="Ali Eren Baysal"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoFocus
              returnKeyType="next"
            />
          </Field>
          <Field label="Title">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.title ?? ''}
              onChangeText={t => setDraft({ ...draft, title: t })}
              placeholder="Founder"
              placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next"
            />
          </Field>
          <Field label="Company">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.company ?? ''}
              onChangeText={t => setDraft({ ...draft, company: t })}
              placeholder="Dynolabs"
              placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next"
            />
          </Field>
          <Field label="Email">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={email}
              onChangeText={setEmail}
              placeholder="ali@dynolabs.io"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
          </Field>
          <Field label="Phone">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 0100"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={onSave}
            />
          </Field>

          <Pressable
            style={[styles.cta, (!draft.name.trim() || saving) && styles.disabled]}
            onPress={onSave}
            disabled={!draft.name.trim() || saving}
          >
            <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Save card'}</Text>
          </Pressable>

          {/* Bottom spacer so the CTA stays clear of the home indicator and
              the screen scrolls naturally above any focused input. */}
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
});
