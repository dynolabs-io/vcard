// Merge sheet — shown after Sign-in-with-Apple if the just-claimed
// state has slug conflicts (same slug on both the device AND the
// signed-in account, with different content). User picks per-conflict
// which version wins; we POST those resolutions back to /v1/cards/claim
// and the server makes it canonical.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyMergeResolutions, type MergeConflict, getAuthSnapshot } from '@/lib/auth';
import { listCards as listLocal } from '@/lib/storage';
import type { Card } from '@/lib/types';
import type { ConflictResolution } from '@/lib/api';

// We re-compute conflicts on mount instead of passing through navigation
// params (which would force serializing Card → string → Card again).
async function recomputeConflicts(): Promise<MergeConflict[]> {
  const local = await listLocal();
  // After sign-in, listCardsRemoteOrLocal already pulled the user's
  // remote set into local storage where possible. Conflicts are local
  // cards whose slug appears in the remote set but with different ID.
  // We approximate by re-listing local and matching by slug + checking
  // saved-against-server consistency. The auth flow populates local
  // with both, so the duplicates-by-slug are the conflicts.
  const bySlug = new Map<string, Card[]>();
  for (const c of local) {
    if (!c.slug) continue;
    const arr = bySlug.get(c.slug) || [];
    arr.push(c);
    bySlug.set(c.slug, arr);
  }
  const out: MergeConflict[] = [];
  for (const arr of bySlug.values()) {
    if (arr.length < 2) continue;
    const [a, b] = arr;
    // Heuristic: the one with a user_id is "remote"; the one without
    // is "local" — that's the typical pre-merge state.
    const remote = a.userId ? a : b.userId ? b : a;
    const local2 = remote === a ? b : a;
    out.push({ slug: remote.slug!, local: local2, remote });
  }
  return out;
}

type Choice = 'local' | 'remote' | 'both';

export default function MergeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!getAuthSnapshot().signedIn) {
      router.back();
      return;
    }
    recomputeConflicts().then(c => {
      setConflicts(c);
      // Default each row to "remote" (server's version) — the safer
      // choice if the user just bounces through.
      const init: Record<string, Choice> = {};
      for (const x of c) init[x.slug] = 'remote';
      setChoices(init);
      setLoading(false);
    });
  }, [router]);

  const onApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const resolutions: ConflictResolution[] = conflicts.map(c => ({
        slug: c.slug,
        winner: choices[c.slug] || 'remote',
        local: c.local,
      }));
      await applyMergeResolutions(resolutions);
      router.back();
    } catch (e) {
      Alert.alert('Merge failed', String(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sync your cards' }} />
      <SafeAreaView style={styles.root} edges={['bottom']}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : conflicts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No conflicts to resolve.</Text>
            <Pressable onPress={() => router.back()} style={styles.cta}>
              <Text style={styles.ctaText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.intro}>
              {conflicts.length} card{conflicts.length === 1 ? '' : 's'} appear
              on this device AND your account with different content. Pick
              which version to keep.
            </Text>
            {conflicts.map(c => (
              <ConflictRow
                key={c.slug}
                conflict={c}
                choice={choices[c.slug] || 'remote'}
                onChoose={ch => setChoices(prev => ({ ...prev, [c.slug]: ch }))}
              />
            ))}
            <Pressable
              onPress={onApply}
              disabled={applying}
              accessibilityLabel="Apply merge"
              style={[styles.applyBtn, applying && { opacity: 0.5 }]}
            >
              <Text style={styles.applyText}>{applying ? 'Applying…' : 'Apply merge'}</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel — resolve later</Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

function ConflictRow({ conflict, choice, onChoose }: {
  conflict: MergeConflict;
  choice: Choice;
  onChoose: (c: Choice) => void;
}) {
  const summary = (c: Card) =>
    [c.title, c.company].filter(Boolean).join(' · ') || '(no title)';
  return (
    <View style={styles.conflict}>
      <Text style={styles.conflictName}>{conflict.remote.name}</Text>

      <ChoiceButton
        title="Keep this device's version"
        sub={summary(conflict.local)}
        active={choice === 'local'}
        onPress={() => onChoose('local')}
      />
      <ChoiceButton
        title="Keep account version"
        sub={summary(conflict.remote)}
        active={choice === 'remote'}
        onPress={() => onChoose('remote')}
      />
      <ChoiceButton
        title="Keep both as separate cards"
        sub="Local copy gets a new slug"
        active={choice === 'both'}
        onPress={() => onChoose('both')}
      />
    </View>
  );
}

function ChoiceButton({ title, sub, active, onPress }: {
  title: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
      accessibilityLabel={title}
    >
      <View style={[styles.radio, active && styles.radioActive]}>
        {active && <View style={styles.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>{title}</Text>
        <Text style={styles.choiceSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  empty: { fontSize: 16, opacity: 0.6 },
  scroll: { padding: 20, gap: 16 },
  intro: { fontSize: 14, opacity: 0.7, lineHeight: 20 },

  conflict: { backgroundColor: 'rgba(127,127,127,0.06)', borderRadius: 16, padding: 16, gap: 8 },
  conflictName: { fontSize: 17, fontWeight: '700', marginBottom: 6 },

  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)' },
  choiceActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#0A66C2' },
  choiceTitle: { fontSize: 14, fontWeight: '500' },
  choiceTitleActive: { color: '#0A66C2', fontWeight: '600' },
  choiceSub: { fontSize: 12, opacity: 0.6, marginTop: 2 },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(127,127,127,0.4)', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#0A66C2' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0A66C2' },

  applyBtn: { padding: 16, borderRadius: 999, backgroundColor: '#0A66C2', alignItems: 'center', marginTop: 8 },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#0A66C2', fontSize: 14 },

  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#0A66C2' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
