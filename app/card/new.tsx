// New-card form. Manual entry with phone-pad-toolbar fix and explicit
// "Save card" CTA at the bottom — never triggered by the keyboard's
// return key (that path silently dropped state on the phone field).

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert, InputAccessoryView, KeyboardAvoidingView, Keyboard, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import type { TextInput as TextInputType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createCardSynced } from '@/lib/sync';
import { CUSTOM_COLORS, TEMPLATES, templateStyle } from '@/lib/templates';
import { emptyCard, type CardTemplate } from '@/lib/types';

const PHONE_ACCESSORY = 'phone-keyboard-accessory';

export default function NewCard() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState(emptyCard());
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Refs for sequential next-field focus.
  const titleRef   = useRef<TextInputType>(null);
  const companyRef = useRef<TextInputType>(null);
  const emailRef   = useRef<TextInputType>(null);
  const phoneRef   = useRef<TextInputType>(null);

  const onSave = async () => {
    Keyboard.dismiss();             // commit any pending edits before reading state
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Enter a name to save the card.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const next = {
        ...draft,
        emails:  email.trim() ? [email.trim()] : [],
        phones:  phone.trim() ? [phone.trim()] : [],
      };
      const saved = await createCardSynced(next);
      // Belt-and-braces: confirm something landed locally.
      if (!saved || !saved.id) {
        throw new Error('save returned empty');
      }
      router.back();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'unknown error';
      Alert.alert('Could not save card', msg);
    } finally {
      setSaving(false);
    }
  };

  const tmpl = templateStyle(draft.template, draft.customColor);

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
          <Field label="Label">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.label} onChangeText={t => setDraft({ ...draft, label: t })}
              placeholder="Work, Personal, …" placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next" />
          </Field>
          <Field label="Name">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.name} onChangeText={t => setDraft({ ...draft, name: t })}
              placeholder="Your name" placeholderTextColor={isDark ? '#666' : '#999'}
              autoFocus returnKeyType="next"
              onSubmitEditing={() => titleRef.current?.focus()} />
          </Field>
          <Field label="Title">
            <TextInput ref={titleRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={draft.title ?? ''} onChangeText={t => setDraft({ ...draft, title: t })}
              placeholder="Founder" placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next"
              onSubmitEditing={() => companyRef.current?.focus()} />
          </Field>
          <Field label="Company">
            <TextInput ref={companyRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={draft.company ?? ''} onChangeText={t => setDraft({ ...draft, company: t })}
              placeholder="Dynolabs" placeholderTextColor={isDark ? '#666' : '#999'}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()} />
          </Field>
          <Field label="Email">
            <TextInput ref={emailRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()} />
          </Field>
          <Field label="Phone">
            <TextInput ref={phoneRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={phone} onChangeText={setPhone}
              placeholder="+1 555 0100" placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad"
              inputAccessoryViewID={Platform.OS === 'ios' ? PHONE_ACCESSORY : undefined} />
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
            backgroundColor: tmpl.card.backgroundColor || tmpl.card.backgroundGradient?.[0] || '#0B0B0F'
          }]}>
            <Text style={[styles.pLabel, tmpl.label]}>{(draft.label || 'WORK').toUpperCase()}</Text>
            <Text style={[styles.pName,  tmpl.name]}>{draft.name || 'Your name'}</Text>
            {!!draft.title   && <Text style={[styles.pTitle, tmpl.title]}>{draft.title}</Text>}
            {!!draft.company && <Text style={[styles.pCompany, tmpl.company]}>{draft.company}</Text>}
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

      {/* iOS-only Done toolbar above the phone-pad keyboard. The phone-pad
          keyboard has no return key, so without this users had no way to
          dismiss the keyboard short of tapping outside. */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={PHONE_ACCESSORY}>
          <View style={styles.accessory}>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={styles.accessoryBtn}
            >
              <Text style={styles.accessoryText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
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
  accessory: {
    backgroundColor: '#f1f1f3',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#bbb',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  accessoryBtn: { padding: 12, paddingHorizontal: 16 },
  accessoryText: { color: '#0A66C2', fontSize: 16, fontWeight: '600' },
});
