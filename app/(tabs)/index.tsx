// Cards list — primary screen. Shows the user's stack of cards. Tap a
// card to open its detail/QR view; "+" creates a new card; swipe a row
// left to reveal Delete.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, FlatList, PanResponder, Pressable, StyleSheet, Text, View,
} from 'react-native';
import type { PanResponderInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { deleteCard } from '@/lib/storage';
import { listCardsRemoteOrLocal } from '@/lib/sync';
import type { Card } from '@/lib/types';

const SWIPE_REVEAL_WIDTH = 96;          // delete button width
const SWIPE_OPEN_THRESHOLD = 60;        // drag must exceed this to snap open
const SWIPE_CLOSE_THRESHOLD = -60;      // drag must exceed this (positive) to snap closed

export default function CardsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  // Track which row id is currently open so a tap-anywhere closes it.
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await listCardsRemoteOrLocal();
    setCards(r.cards);
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listCardsRemoteOrLocal().then(r => { if (!cancelled) setCards(r.cards); });
    return () => { cancelled = true; };
  }, []));

  const doDelete = (card: Card) => {
    Alert.alert(
      'Delete card',
      `Remove "${card.label}: ${card.name || '(no name)'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setOpenId(null);
            try { await api.deleteCard(card.id); } catch { /* offline ok */ }
            await deleteCard(card.id);
            await refresh();
          },
        },
      ],
    );
  };

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
          extraData={openId}
          renderItem={({ item }) => (
            <SwipeRow
              card={item}
              isOpen={openId === item.id}
              onOpen={() => setOpenId(item.id)}
              onClose={() => setOpenId(prev => prev === item.id ? null : prev)}
              onPress={() => {
                if (openId) { setOpenId(null); return; }
                router.push(`/card/${item.id}`);
              }}
              onDelete={() => doDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// Single row with horizontal-pan reveal. Pure RN PanResponder so no
// dependency on react-native-gesture-handler (which conflicts with the
// modal presentation on iOS 26 — wrapping the app in GestureHandlerRootView
// caused /card/new to silently dismiss after open).
function SwipeRow({ card, isOpen, onOpen, onClose, onPress, onDelete }: {
  card: Card;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPress: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  // Keep the displayed offset in sync with the open/closed prop so
  // tapping another row collapses this one even mid-animation.
  if (isOpen) startX.current = -SWIPE_REVEAL_WIDTH;
  else startX.current = 0;

  const panResponder = useRef<PanResponderInstance | null>(null);
  if (!panResponder.current) {
    panResponder.current = PanResponder.create({
      // Only claim horizontal gestures. Lets vertical FlatList scroll
      // continue unimpeded.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((v) => { startX.current = v; });
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, startX.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const total = startX.current + g.dx;
        if (total <= -SWIPE_OPEN_THRESHOLD) {
          Animated.spring(translateX, { toValue: -SWIPE_REVEAL_WIDTH, useNativeDriver: true, bounciness: 0 }).start();
          onOpen();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          onClose();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: isOpen ? -SWIPE_REVEAL_WIDTH : 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    });
  }

  // Snap to the prop-driven state when isOpen changes externally (e.g.
  // another row was opened).
  useEffect(() => {
    Animated.spring(translateX, { toValue: isOpen ? -SWIPE_REVEAL_WIDTH : 0, useNativeDriver: true, bounciness: 0 }).start();
  }, [isOpen, translateX]);

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteUnderlay}>
        <Pressable
          onPress={onDelete}
          accessibilityLabel="Delete"
          accessibilityRole="button"
          testID={`card-delete-${card.id}`}
          style={styles.deleteUnderlayBtn}
        >
          <Text style={styles.deleteUnderlayIcon}>🗑</Text>
          <Text style={styles.deleteUnderlayLabel}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View
        style={[styles.swipeForeground, { transform: [{ translateX }] }]}
        {...panResponder.current.panHandlers}
      >
        <Pressable
          style={styles.row}
          onPress={onPress}
          accessible
          accessibilityLabel={card.name || '(no name)'}
          testID={`card-row-${card.name}`}
        >
          <Text style={styles.rowLabel}>{card.label}</Text>
          <Text style={styles.rowName}>{card.name || '(no name)'}</Text>
          {card.title && <Text style={styles.rowSub}>{card.title}{card.company ? ` · ${card.company}` : ''}</Text>}
        </Pressable>
      </Animated.View>
    </View>
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

  swipeContainer: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  deleteUnderlay: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: SWIPE_REVEAL_WIDTH,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteUnderlayBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  deleteUnderlayIcon: { fontSize: 22 },
  deleteUnderlayLabel: { color: '#fff', fontWeight: '700', marginTop: 4 },
  swipeForeground: { width: '100%' },
});
