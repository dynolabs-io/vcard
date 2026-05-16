// Cards tab — horizontal peek-carousel of the user's cards.
//
// Each "page" is a full CardView (centered medallion photo + actions +
// full-width QR + mode chip). The carousel snaps to each card, with the
// previous/next cards peeking ~10% in from either side so the user
// always knows there's more to swipe to. Page dots at the bottom.
//
// Tap "+" → /card/new. Tap "Edit" (header right) when a card is active
// → /card/edit/<active.id>. Sign-in lives on the Account tab — never
// here — so the header is just title + add button.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList, Pressable, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { CardView } from '@/components/CardView';
import { listCardsRemoteOrLocal } from '@/lib/sync';
import type { Card } from '@/lib/types';

// Each page is the full screen width minus a small "peek" margin so
// the adjacent cards show ~6% on either side.
const PEEK = 16;

export default function CardsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  const [cards, setCards] = useState<Card[]>([]);
  const [active, setActive] = useState(0);
  // Per-card QR mode preference. Defaults to "online" for every card.
  const [qrModeByCard, setQrModeByCard] = useState<Record<string, 'offline' | 'online'>>({});
  const listRef = useRef<FlatList<Card>>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listCardsRemoteOrLocal().then(r => { if (!cancelled) setCards(r.cards); });
    return () => { cancelled = true; };
  }, []));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (idx !== active) setActive(idx);
  };

  const activeCard = cards[active];
  const setMode = (cardId: string) => (m: 'offline' | 'online') =>
    setQrModeByCard(prev => ({ ...prev, [cardId]: m }));

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Your cards</Text>
        <View style={styles.headerRight}>
          {activeCard && (
            <Pressable
              onPress={() => router.push(`/card/edit/${activeCard.id}`)}
              accessibilityLabel="Edit"
              accessibilityRole="button"
              testID="card-edit"
              hitSlop={8}
            >
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/card/new')}
            accessibilityLabel="Add card"
            testID="card-add"
            style={styles.addBtn}
          >
            <SymbolView name="plus" tintColor="#0A66C2" resizeMode="scaleAspectFit"
              style={{ width: 20, height: 20 }} weight="semibold" />
          </Pressable>
        </View>
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
        <>
          <FlatList
            ref={listRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={cards}
            keyExtractor={c => c.id}
            onMomentumScrollEnd={onScroll}
            renderItem={({ item }) => (
              <CardView
                card={item}
                qrMode={qrModeByCard[item.id] ?? 'online'}
                onQrModeChange={setMode(item.id)}
                pageWidth={pageWidth}
              />
            )}
            getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
            testID="cards-carousel"
          />
          {cards.length > 1 && (
            <View style={styles.dots}>
              {cards.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === active && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  edit: { color: '#0A66C2', fontSize: 17, fontWeight: '500' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600' },
  emptyBody: { fontSize: 15, textAlign: 'center', opacity: 0.7 },
  cta: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.3)' },
  dotActive: { backgroundColor: '#0A66C2', width: 18 },
});
