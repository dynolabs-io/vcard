// Scan-save sheet — after the camera captures a QR, this screen previews
// the card and lets the user add notes / tags before saving to the
// rolodex. GPS + calendar context are captured automatically when
// permission is granted.

import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { createScan, knownTags } from '@/lib/scans';
import { createContactFromCard } from '@/lib/iosContacts';

export default function ScanSaveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug?: string;
    name?: string;
    title?: string;
    company?: string;
    phone?: string;
    email?: string;
    photoUrl?: string;
  }>();

  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [placeName, setPlaceName] = useState<string>('');
  const [lat, setLat] = useState<number | undefined>();
  const [lon, setLon] = useState<number | undefined>();
  const [eventName, setEventName] = useState<string>('');
  const [saveToContacts, setSaveToContacts] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    knownTags().then(setSuggested).catch(() => {});
    void captureContext();
  }, []);

  async function captureContext(): Promise<void> {
    // GPS — opt-in via permission, silently skip if denied.
    try {
      const loc = await Location.getForegroundPermissionsAsync();
      if (loc.status !== 'granted' && loc.canAskAgain) {
        const r = await Location.requestForegroundPermissionsAsync();
        if (r.status !== 'granted') return;
      } else if (loc.status !== 'granted') {
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const place = places[0];
        if (place) {
          const parts = [place.name, place.city, place.region].filter(Boolean);
          setPlaceName(parts.join(', '));
        }
      } catch {}
    } catch {}

    // Calendar — match a currently-running or recent event.
    try {
      const cal = await Calendar.getCalendarPermissionsAsync();
      if (cal.status !== 'granted' && cal.canAskAgain) {
        const r = await Calendar.requestCalendarPermissionsAsync();
        if (r.status !== 'granted') return;
      } else if (cal.status !== 'granted') {
        return;
      }
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      if (cals.length === 0) return;
      const now = new Date();
      const windowStart = new Date(now.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
      const events = await Calendar.getEventsAsync(
        cals.map(c => c.id),
        windowStart,
        windowEnd,
      );
      const match = events.find(e => {
        const s = new Date(e.startDate);
        const f = new Date(e.endDate);
        return s <= now && f >= now;
      }) || events[0];
      if (match) {
        setEventName(match.title);
      }
    } catch {}
  }

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags(prev => [...prev, v]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const slug = params.slug || '';
      await createScan({
        targetSlug: slug,
        cardSnapshot: {
          name: params.name || '',
          title: params.title || undefined,
          company: params.company || undefined,
          phones: params.phone ? [params.phone] : [],
          emails: params.email ? [params.email] : [],
          photoUrl: params.photoUrl || undefined,
        },
        notes,
        tags,
        lat,
        lon,
        placeName,
        eventName,
        reveal,
        scannedAt: new Date().toISOString(),
      });
      if (saveToContacts) {
        await createContactFromCard({
          name: params.name || '',
          title: params.title,
          company: params.company,
          phones: params.phone ? [params.phone] : [],
          emails: params.email ? [params.email] : [],
          slug: params.slug,
          photoUrl: params.photoUrl,
        });
      }
      router.replace('/(tabs)/scanned');
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Save contact' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.preview}>
            {params.photoUrl ? (
              <Image source={{ uri: params.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.initial}>{(params.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.name}>{params.name || '(no name)'}</Text>
            {(params.title || params.company) ? (
              <Text style={styles.sub}>
                {[params.title, params.company].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {(params.phone || params.email) ? (
              <Text style={styles.sub}>
                {[params.phone, params.email].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>NOTES (private)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Met at the OpenAI booth, follow up about Series A"
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
            {suggested.length > 0 && (
              <View style={styles.suggestedRow}>
                {suggested.filter(s => !tags.includes(s)).slice(0, 8).map(s => (
                  <Pressable key={s} style={styles.suggestedChip} onPress={() => addTag(s)}>
                    <Text style={styles.suggestedText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {(placeName || eventName) ? (
            <View style={styles.section}>
              <Text style={styles.label}>AUTO-CAPTURED</Text>
              {placeName ? (
                <View style={styles.captureRow}>
                  <SymbolView name="mappin.circle.fill" tintColor="#0A66C2"
                    resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
                  <Text style={styles.captureText}>{placeName}</Text>
                </View>
              ) : null}
              {eventName ? (
                <View style={styles.captureRow}>
                  <SymbolView name="calendar" tintColor="#0A66C2"
                    resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
                  <Text style={styles.captureText}>{eventName}</Text>
                </View>
              ) : null}
              <View style={styles.captureRow}>
                <SymbolView name="clock.fill" tintColor="#0A66C2"
                  resizeMode="scaleAspectFit" style={{ width: 18, height: 18 }} />
                <Text style={styles.captureText}>{new Date().toLocaleString()}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Save to iPhone Contacts</Text>
              <Switch value={saveToContacts} onValueChange={setSaveToContacts} />
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Reveal me to {params.name || 'this contact'}</Text>
                <Text style={styles.rowHint}>
                  Default: anonymous. Turn on so they see you in their Inbox.
                </Text>
              </View>
              <Switch value={reveal} onValueChange={setReveal} />
            </View>
          </View>

          <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  preview: { alignItems: 'center', gap: 6 },
  photo: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(127,127,127,0.15)' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 32, fontWeight: '700', color: 'rgba(60,60,67,0.6)' },
  name: { fontSize: 22, fontWeight: '600', marginTop: 8 },
  sub: { fontSize: 14, color: 'rgba(60,60,67,0.7)', textAlign: 'center' },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 },
  rowLabel: { fontSize: 15 },
  rowHint: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  saveBtn: { padding: 16, borderRadius: 999, backgroundColor: '#0A66C2', alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
