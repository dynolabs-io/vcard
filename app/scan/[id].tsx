// Scan detail — view & edit one rolodex entry. Shows live card data
// from the server (fresh on every focus) + your private notes/tags
// + meeting context. Allows editing notes/tags and deleting.

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as Linking from 'expo-linking';
import { api } from '@/lib/api';
import { deleteScan, getScan, knownTags, updateScan, type ScanRecord } from '@/lib/scans';
import type { Card } from '@/lib/types';

export default function ScanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [live, setLive] = useState<Card | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [knownT, setKnownT] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const s = await getScan(id);
      if (!s || cancelled) return;
      setScan(s);
      setNotes(s.notes);
      setTags(s.tags);
      knownTags().then(setKnownT);
      // Always refresh the underlying card from server so the user
      // sees the latest info every time they open this rolodex entry.
      try {
        const fresh = await api.publicCard(s.targetSlug);
        if (!cancelled) setLive(fresh);
      } catch {
        // Offline — fall back to the snapshot stored at scan time.
      }
    })();
    return () => { cancelled = true; };
  }, [id]));

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags(prev => [...prev, v]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const onSave = async () => {
    if (!scan || saving) return;
    setSaving(true);
    try {
      await updateScan(scan.id, { notes, tags });
      router.back();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete contact',
      `Remove ${scan?.cardSnapshot?.name || 'this contact'} from your rolodex?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!scan) return;
            await deleteScan(scan.id);
            router.back();
          },
        },
      ],
    );
  };

  if (!scan) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen options={{ title: '' }} />
      </SafeAreaView>
    );
  }

  // Prefer live data over snapshot.
  const view = live ?? {
    name: scan.cardSnapshot?.name || '',
    title: scan.cardSnapshot?.title,
    company: scan.cardSnapshot?.company,
    phones: scan.cardSnapshot?.phones || [],
    emails: scan.cardSnapshot?.emails || [],
    photoUrl: scan.cardSnapshot?.photoUrl,
  } as Card;

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: view.name || 'Contact' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            {view.photoUrl ? (
              <Image source={{ uri: view.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.initial}>{(view.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.name}>{view.name}</Text>
            {(view.title || view.company) ? (
              <Text style={styles.sub}>{[view.title, view.company].filter(Boolean).join(' · ')}</Text>
            ) : null}
            {live && (
              <Text style={styles.liveBadge}>● Live · refreshes when they update</Text>
            )}
          </View>

          {(view.phones?.length || view.emails?.length) ? (
            <View style={styles.quickRow}>
              {view.phones?.[0] && (
                <Pressable
                  style={styles.quickBtn}
                  onPress={() => Linking.openURL(`tel:${view.phones[0]}`).catch(() => {})}
                >
                  <SymbolView name="phone.fill" tintColor="#fff" resizeMode="scaleAspectFit"
                    style={{ width: 18, height: 18 }} weight="semibold" />
                  <Text style={styles.quickLabel}>Call</Text>
                </Pressable>
              )}
              {view.emails?.[0] && (
                <Pressable
                  style={styles.quickBtn}
                  onPress={() => Linking.openURL(`mailto:${view.emails[0]}`).catch(() => {})}
                >
                  <SymbolView name="envelope.fill" tintColor="#fff" resizeMode="scaleAspectFit"
                    style={{ width: 18, height: 18 }} weight="semibold" />
                  <Text style={styles.quickLabel}>Mail</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="(private notes)"
              multiline
              style={styles.notesInput}
              placeholderTextColor="rgba(60,60,67,0.4)"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>TAGS</Text>
            <View style={styles.tagRow}>
              {tags.map(t => (
                <Pressable key={t} style={styles.tagChip} onPress={() => removeTag(t)}>
                  <Text style={styles.tagText}>{t}</Text>
                  <SymbolView name="xmark.circle.fill" tintColor="rgba(60,60,67,0.4)"
                    resizeMode="scaleAspectFit" style={{ width: 14, height: 14 }} />
                </Pressable>
              ))}
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => addTag(tagInput)}
                placeholder="+ Add tag"
                style={styles.tagInput}
                returnKeyType="done"
                placeholderTextColor="rgba(60,60,67,0.4)"
              />
            </View>
            {knownT.length > 0 && (
              <View style={styles.suggestedRow}>
                {knownT.filter(s => !tags.includes(s)).slice(0, 8).map(s => (
                  <Pressable key={s} style={styles.suggestedChip} onPress={() => addTag(s)}>
                    <Text style={styles.suggestedText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {(scan.placeName || scan.eventName) && (
            <View style={styles.section}>
              <Text style={styles.label}>WHEN AND WHERE</Text>
              {scan.placeName && (
                <View style={styles.captureRow}>
                  <SymbolView name="mappin.circle.fill" tintColor="#0A66C2"
                    resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
                  <Text style={styles.captureText}>{scan.placeName}</Text>
                </View>
              )}
              {scan.eventName && (
                <View style={styles.captureRow}>
                  <SymbolView name="calendar" tintColor="#0A66C2"
                    resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
                  <Text style={styles.captureText}>{scan.eventName}</Text>
                </View>
              )}
              <View style={styles.captureRow}>
                <SymbolView name="clock.fill" tintColor="#0A66C2"
                  resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
                <Text style={styles.captureText}>{new Date(scan.scannedAt).toLocaleString()}</Text>
              </View>
            </View>
          )}

          <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && styles.btnDisabled]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete contact</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 6 },
  photo: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(127,127,127,0.15)' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 38, fontWeight: '700', color: 'rgba(60,60,67,0.6)' },
  name: { fontSize: 22, fontWeight: '600', marginTop: 8 },
  sub: { fontSize: 14, color: 'rgba(60,60,67,0.7)', textAlign: 'center' },
  liveBadge: { fontSize: 11, color: '#22A06B', marginTop: 6, fontWeight: '500' },
  quickRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: '#0A66C2' },
  quickLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  section: { gap: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, opacity: 0.55 },
  notesInput: { borderWidth: 1, borderColor: 'rgba(127,127,127,0.2)', borderRadius: 12, padding: 12, fontSize: 15, minHeight: 70, color: '#000' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(10,102,194,0.12)' },
  tagText: { fontSize: 13, color: '#0A66C2', fontWeight: '500' },
  tagInput: { paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, fontSize: 13, color: '#000' },
  suggestedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  suggestedChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.08)' },
  suggestedText: { fontSize: 12, color: 'rgba(60,60,67,0.8)' },
  captureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  captureText: { fontSize: 14, color: 'rgba(60,60,67,0.85)' },
  saveBtn: { padding: 16, borderRadius: 999, backgroundColor: '#0A66C2', alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  deleteBtn: { padding: 14, alignItems: 'center' },
  deleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '500' },
});
