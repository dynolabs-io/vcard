// Card detail. QR (full vCard, offline-scannable), Edit, Share menu
// (vCard / QR PNG / link), Add to Apple Wallet, Delete.

import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { api, profileUrl } from '@/lib/api';
import { sharePNGFromBase64, shareVCard, shareLink } from '@/lib/share';
import { deleteCard, getCard } from '@/lib/storage';
import { templateStyle } from '@/lib/templates';
import { trace } from '@/lib/telemetry';
import type { Card } from '@/lib/types';
import { buildVCard } from '@/lib/vcard';

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const qrRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      getCard(id).then(c => { if (!cancelled) setCard(c ?? null); });
      return () => { cancelled = true; };
    }, [id]),
  );

  if (!card) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Card not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.cta}>
          <Text style={styles.ctaText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tmpl = templateStyle(card.template, card.customColor);
  // FULL vCard in the QR — recipient's camera reads offline and offers
  // Save to Contacts immediately. Profile URL appended as a URL field.
  const qrPayload = buildVCard(card, {
    profileUrl: card.slug ? profileUrl(card.slug) : undefined,
    photoUrl:   card.photoUrl,
  });
  const slugUrl = card.slug ? profileUrl(card.slug) : null;

  const onShare = () =>
    Alert.alert('Share card', undefined, [
      { text: 'Share as vCard', onPress: () =>
          trace('share-vcard', { cardId: card.id, slug: card.slug, hasProfileUrl: !!slugUrl },
            () => shareVCard(card, slugUrl ?? undefined))
          .catch(e => Alert.alert('Share failed', String(e))) },
      { text: 'Share as QR image', onPress: () =>
          trace('share-qr', { cardId: card.id }, async () => {
            const { captureRef } = require('react-native-view-shot');
            const b64 = await captureRef(qrRef, { format: 'png', quality: 1, result: 'base64' });
            const safe = (card.name || 'qr').replace(/[^a-zA-Z0-9_-]+/g, '_');
            await sharePNGFromBase64(b64, `${safe}.png`, 'Share QR image');
          }).catch(e => Alert.alert('Share failed', String(e))) },
      ...(slugUrl ? [{ text: 'Share as link', onPress: () =>
          trace('share-link', { cardId: card.id, slugUrl },
            () => shareLink(card.name, slugUrl))
          .catch(e => Alert.alert('Share failed', String(e))) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const onDelete = () =>
    Alert.alert('Delete card', `Remove "${card.label}: ${card.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await api.deleteCard(card.id); } catch { /* offline ok */ }
          await deleteCard(card.id);
          router.back();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.cardFace, { backgroundColor: tmpl.card.backgroundColor || '#0B0B0F' }]}>
          {tmpl.card.backgroundGradient && (
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor: tmpl.card.backgroundGradient[0],
              borderRadius: 24,
            }]} />
          )}
          <View style={styles.cardInner}>
            {card.photoUrl ? (
              <Image source={{ uri: card.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.photoInitial}>{(card.name || '?').slice(0,1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.label,   tmpl.label]}>{card.label}</Text>
            <Text style={[styles.name,    tmpl.name]}>{card.name || '(no name)'}</Text>
            {!!card.title   && <Text style={[styles.title,   tmpl.title]}>{card.title}</Text>}
            {!!card.company && <Text style={[styles.company, tmpl.company]}>{card.company}</Text>}
          </View>
        </View>

        <View style={styles.qrFrame} ref={qrRef} collapsable={false}>
          <QRCode value={qrPayload} size={260} backgroundColor="#fff" />
        </View>
        <Text style={styles.hint}>Anyone can scan this with their default camera.</Text>

        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={onShare}>
            <Text style={styles.actionText}>Share card</Text>
          </Pressable>
          {card.slug ? (
            <Pressable
              style={styles.actionSecondary}
              onPress={() =>
                trace('wallet-open', { cardId: card.id, slug: card.slug, url: api.applePassUrl(card.slug!) },
                  () => Linking.openURL(api.applePassUrl(card.slug!)))
                .catch(e => Alert.alert('Could not open Wallet', String(e)))
              }
            >
              <Text style={styles.actionSecondaryText}>Add to Apple Wallet</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.actionSecondary, { opacity: 0.5 }]} disabled>
              <Text style={styles.actionSecondaryText}>Saving card to cloud…</Text>
            </Pressable>
          )}
          <Pressable style={styles.actionSecondary} onPress={() => router.push(`/card/edit/${card.id}`)}>
            <Text style={styles.actionSecondaryText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete card</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scroll: { padding: 24, alignItems: 'center', gap: 20, paddingBottom: 40 },
  cardFace: { width: '100%', borderRadius: 24, overflow: 'hidden' },
  cardInner: { padding: 24 },
  photo: { width: 64, height: 64, borderRadius: 32, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoInitial: { color: '#fff', fontSize: 24, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  title: { fontSize: 16, marginTop: 4 },
  company: { fontSize: 14, marginTop: 2 },
  qrFrame: { padding: 16, backgroundColor: '#fff', borderRadius: 16 },
  hint: { fontSize: 13, opacity: 0.6, textAlign: 'center' },
  actions: { width: '100%', gap: 12, marginTop: 4 },
  action: { padding: 16, borderRadius: 999, backgroundColor: '#111', alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  actionSecondary: { padding: 14, borderRadius: 999, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center' },
  actionSecondaryText: { fontSize: 15, fontWeight: '600' },
  deleteBtn: { padding: 14, borderRadius: 999, alignItems: 'center', marginTop: 8 },
  deleteText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
