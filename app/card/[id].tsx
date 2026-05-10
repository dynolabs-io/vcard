// Card detail / QR view. Tapping a card from the list opens here. The QR
// encodes a profile URL (after sync) or raw vCard 3.0 (offline).

import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { api, profileUrl } from '@/lib/api';
import { deleteCard, getCard } from '@/lib/storage';
import { templateStyle } from '@/lib/templates';
import type { Card } from '@/lib/types';
import { buildVCard } from '@/lib/vcard';

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);

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
  const qrPayload = card.slug ? profileUrl(card.slug) : buildVCard(card);
  const shareUrl = card.slug ? profileUrl(card.slug) : null;

  const onCopy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Copied', shareUrl);
  };
  const onShare = async () => {
    if (!shareUrl) return;
    await Share.share({ message: `${card.name} — ${shareUrl}`, url: shareUrl });
  };
  const onDelete = () =>
    Alert.alert('Delete card', `Remove "${card.label}: ${card.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteCard(card.id); router.back(); },
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

        <View style={styles.qrFrame}>
          <QRCode value={qrPayload} size={240} backgroundColor="#fff" />
        </View>
        <Text style={styles.hint}>Anyone can scan this with their default camera.</Text>

        {shareUrl && (
          <View style={styles.row}>
            <Pressable style={[styles.iconBtn, { flex: 1 }]} onPress={onCopy}>
              <Text style={styles.iconBtnText}>Copy link</Text>
            </Pressable>
            <Pressable style={[styles.iconBtn, { flex: 1 }]} onPress={onShare}>
              <Text style={styles.iconBtnText}>Share</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.actions}>
          {card.slug ? (
            <Pressable
              style={styles.action}
              onPress={async () => {
                try {
                  await Linking.openURL(api.applePassUrl(card.slug!));
                } catch (e: unknown) {
                  Alert.alert('Could not open Wallet', (e as { message?: string })?.message || 'unknown error');
                }
              }}
            >
              <Text style={styles.actionText}>Add to Apple Wallet</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.action, { opacity: 0.5 }]} disabled>
              <Text style={styles.actionText}>Saving card to cloud…</Text>
            </Pressable>
          )}
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
  row: { flexDirection: 'row', gap: 12, width: '100%' },
  iconBtn: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.08)', alignItems: 'center' },
  iconBtnText: { fontSize: 14, fontWeight: '600' },
  actions: { width: '100%', gap: 12, marginTop: 4 },
  action: { padding: 16, borderRadius: 999, backgroundColor: '#111', alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 14, borderRadius: 999, alignItems: 'center', marginTop: 8 },
  deleteText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
