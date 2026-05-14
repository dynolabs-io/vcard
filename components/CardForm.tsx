// Unified create/edit form. Used by app/card/new.tsx and app/card/edit/[id].tsx.
// Wraps everything in KeyboardAvoidingView, accessory toolbar for the
// phone field, photo picker, multi-email/phone, template + custom color,
// live preview, save with visible errors.

import { useRef, useState } from 'react';
import {
  Alert, Image, InputAccessoryView, KeyboardAvoidingView, Keyboard, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import type { TextInput as TextInputType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CUSTOM_COLORS, TEMPLATES, templateStyle } from '@/lib/templates';
import { type Card, type CardTemplate, type WalletStyle } from '@/lib/types';

// Apple Wallet pass layout choices the user can pick.
const WALLET_STYLES: { id: WalletStyle; name: string; preview: string }[] = [
  { id: 'bigqr',     name: 'Big QR',     preview: '▓▓▓\n▓▓▓\n— text —' },
  { id: 'photoBack', name: 'Photo back', preview: '◼ photo ◼\nname • QR' },
  { id: 'compact',   name: 'Compact',    preview: '◻ ◻ ◻\nname\n▓ qr ▓' },
  { id: 'minimal',   name: 'Minimal',    preview: 'name\n\n  ▓▓\n  ▓▓' },
];

const PHONE_ACCESSORY = 'phone-keyboard-accessory';

type Props = {
  initial: Card;
  /** Called with the merged card on Save. Implementations decide
   *  whether to create-new or update-existing. Throw on failure → form
   *  shows the error in an Alert and the user stays on the form. */
  onSubmit: (card: Card) => Promise<void>;
  submitLabel: string;
  /** First-time create can prefill from the device. Skip on edit. */
  enablePrefill?: boolean;
};

export function CardForm({ initial, onSubmit, submitLabel }: Props) {
  const isDark = useColorScheme() === 'dark';
  const [draft, setDraft] = useState<Card>(initial);
  const [emailsInput, setEmailsInput] = useState((initial.emails || []).join(', '));
  const [phonesInput, setPhonesInput] = useState((initial.phones || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Refs for sequential next-field focus on Return.
  const titleRef   = useRef<TextInputType>(null);
  const companyRef = useRef<TextInputType>(null);
  const emailRef   = useRef<TextInputType>(null);
  const phoneRef   = useRef<TextInputType>(null);

  const onSave = async () => {
    Keyboard.dismiss();
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Enter a name to save the card.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const next: Card = {
        ...draft,
        emails: emailsInput.split(',').map(s => s.trim()).filter(Boolean),
        phones: phonesInput.split(',').map(s => s.trim()).filter(Boolean),
      };
      await onSubmit(next);
    } catch (e: unknown) {
      Alert.alert('Could not save card', (e as { message?: string })?.message || 'unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Photo picker — every step traced. Each phase POSTs to /v1/crash so
  // we can see exactly where it dies on the user's phone (lazy-require,
  // permission request, picker launch, normalize, upload).
  const onPickPhoto = (source: 'camera' | 'library') => async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    const { trace } = require('@/lib/telemetry');
    try {
      await trace(`photo-${source}`, { hasSlug: !!draft.slug }, async () => {
        const photoMod = require('@/lib/photo');
        const uri = await trace(`photo-${source}-pick`, {}, () => photoMod.pickPhoto(source));
        if (!uri) return;
        const normalized = await trace(`photo-${source}-normalize`, {}, () => photoMod.normalize(uri));
        setDraft(d => ({ ...d, photoUrl: normalized }));
        if (draft.slug) {
          const url = await trace(`photo-${source}-upload`, { slug: draft.slug },
            () => photoMod.uploadPhoto(draft.slug, normalized));
          setDraft(d => ({ ...d, photoUrl: url }));
        }
      });
    } catch (e: unknown) {
      Alert.alert('Photo failed', (e as { message?: string })?.message || String(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const onChoosePhoto = () => {
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo',     onPress: onPickPhoto('camera') },
      { text: 'Choose from library', onPress: onPickPhoto('library') },
      ...(draft.photoUrl ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setDraft(d => ({ ...d, photoUrl: undefined })) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const tmpl = templateStyle(draft.template, draft.customColor);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Modal presentation eats more chrome — use larger offset so the
        // phone-pad keyboard never covers the focused phone field.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
        >
          {/* Photo picker — Pressable wraps ONLY the avatar circle.
              Earlier the Pressable spanned the full row width, so any tap
              in the upper band of the form opened the photo dialog. */}
          <View style={styles.photoPicker}>
            <Pressable
              onPress={onChoosePhoto}
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              {draft.photoUrl ? (
                <Image source={{ uri: draft.photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Text style={styles.photoInitial}>{(draft.name || '?').slice(0,1).toUpperCase()}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={onChoosePhoto} hitSlop={4}>
              <Text style={styles.photoHint}>{photoBusy ? 'Working…' : draft.photoUrl ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
          </View>

          <Field label="Label">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.label} onChangeText={t => setDraft({ ...draft, label: t })}
              placeholder="Work, Personal, …" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCorrect={false} autoCapitalize="words"
              returnKeyType="next" />
          </Field>
          <Field label="Name">
            <TextInput style={[styles.input, isDark && styles.inputDark]}
              value={draft.name} onChangeText={t => setDraft({ ...draft, name: t })}
              placeholder="Your name" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCorrect={false} autoCapitalize="words" spellCheck={false}
              returnKeyType="next"
              onSubmitEditing={() => titleRef.current?.focus()} />
          </Field>
          <Field label="Title">
            <TextInput ref={titleRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={draft.title ?? ''} onChangeText={t => setDraft({ ...draft, title: t })}
              placeholder="Founder" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCorrect={false} autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => companyRef.current?.focus()} />
          </Field>
          <Field label="Company">
            <TextInput ref={companyRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={draft.company ?? ''} onChangeText={t => setDraft({ ...draft, company: t })}
              placeholder="Dynolabs" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCorrect={false} autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()} />
          </Field>
          <Field label="Emails (comma-separated)">
            <TextInput ref={emailRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={emailsInput} onChangeText={setEmailsInput}
              placeholder="you@example.com, you@work.com" placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()} />
          </Field>
          <Field label="Phones (comma-separated)">
            <TextInput ref={phoneRef}
              style={[styles.input, isDark && styles.inputDark]}
              value={phonesInput} onChangeText={setPhonesInput}
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
          <Field label="Wallet pass layout">
            <View style={styles.templateRow}>
              {WALLET_STYLES.map(w => {
                const selected = (draft.walletStyle ?? 'compact') === w.id;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => setDraft({ ...draft, walletStyle: w.id })}
                    style={[
                      styles.walletChip,
                      selected && styles.walletChipSelected,
                    ]}
                  >
                    <Text style={[styles.walletName, selected && styles.walletNameSelected]}>{w.name}</Text>
                    <Text style={styles.walletPreview}>{w.preview}</Text>
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
            <Text style={styles.ctaText}>{saving ? 'Saving…' : submitLabel}</Text>
          </Pressable>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS-only Done toolbar above the phone-pad keyboard. */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={PHONE_ACCESSORY}>
          <View style={styles.accessory}>
            <Pressable onPress={() => Keyboard.dismiss()} style={styles.accessoryBtn}>
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
  templateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  templateChip: { padding: 12, borderRadius: 12, minWidth: 72, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  templateChipSelected: { borderColor: '#0A66C2' },
  templateName: { fontSize: 13, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: '#000' },
  walletChip: { padding: 10, borderRadius: 12, minWidth: 96, alignItems: 'center', backgroundColor: 'rgba(127,127,127,0.10)', borderWidth: 2, borderColor: 'transparent' },
  walletChipSelected: { borderColor: '#0A66C2', backgroundColor: 'rgba(10,102,194,0.10)' },
  walletName: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  walletNameSelected: { color: '#0A66C2' },
  walletPreview: { fontSize: 9, opacity: 0.6, textAlign: 'center', fontFamily: 'Menlo' },
  preview: { padding: 18, borderRadius: 18, marginTop: 4 },
  pLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  pName: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  pTitle: { fontSize: 14, marginTop: 2 },
  pCompany: { fontSize: 13, marginTop: 1 },
  photoPicker: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(127,127,127,0.1)' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 36, fontWeight: '700', color: '#0A66C2' },
  photoHint: { fontSize: 13, color: '#0A66C2', fontWeight: '600' },
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
