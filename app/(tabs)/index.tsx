// Cards list — primary screen. Shows the user's stack of cards. Tap a
// card to open its detail/QR view; "+" creates a new card.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listCardsRemoteOrLocal } from '@/lib/sync';
import type { Card } from '@/lib/types';

export default function CardsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [source, setSource] = useState<'remote' | 'local'>('local');

  // Refresh on focus. Local + remote in parallel — local renders immediately,
  // remote replaces it once it arrives so the screen never feels blocked.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listCardsRemoteOrLocal().then(r => {
        if (cancelled) return;
        setCards(r.cards);
        setSource(r.source);
      });
      return () => { cancelled = true; };
    }, []),
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Your cards</Text>
        <Pressable onPress={() => router.push('/card/new')} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>
      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptyBody}>Create your first card to get a QR you can share at events.</Text>
          <Pressable onPress={() => router.push('/card/new')} style={styles.cta}>
            <Text style={styles.ctaText}>Create card</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={cards}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/card/${item.id}`)}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowName}>{item.name || '(no name)'}</Text>
              {item.title && <Text style={styles.rowSub}>{item.title}{item.company ? ` · ${item.company}` : ''}</Text>}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '700' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600' },
  emptyBody: { fontSize: 15, textAlign: 'center', opacity: 0.7 },
  cta: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  row: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.08)' },
  rowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, opacity: 0.6, textTransform: 'uppercase' },
  rowName: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  rowSub: { fontSize: 13, opacity: 0.7, marginTop: 2 },
});
