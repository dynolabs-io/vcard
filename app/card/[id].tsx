// Card detail. QR (full vCard, offline-scannable), Edit, Share menu
// (vCard / QR PNG / link), Add to Apple Wallet, Delete.
//
// Layout priority: the 3 critical actions (Share / Wallet / Edit) sit
// IMMEDIATELY below the hero so they're visible without scrolling on a
// standard iPhone. QR is below — secondary use case.

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
import { deleteCard, getCard, saveCard as saveLocal } from '@/lib/storage';
import { refetchCardIfMissingSlug } from '@/lib/sync';
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
      (async () => {
        const local = await getCard(id);
        if (cancelled || !local) { setCard(local ?? null); return; }
        setCard(local);
        // If local copy is missing the server slug (timed-out create) we
        // fix it up here so "Add to Apple Wallet" actually becomes tappable.
        if (!local.slug) {
          const fresh = await refetchCardIfMissingSlug(local);
          if (!cancelled && fresh.slug) {
            setCard(fresh);
            await saveLocal(fresh);
          }
        }
      })();
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

  const accent = card.customColor || (tmpl.card.backgroundColor || '#0B0B0F');
  const primaryEmail = card.emails?.[0];
  const primaryPhone = card.phones?.[0];
  const websiteSocial = card.socials?.find(s => s.kind === 'website');
  const linkedinSocial = card.socials?.find(s => s.kind === 'linkedin');

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* COMPACT HERO — photo + name side-by-side. Lets the 3 critical
            action buttons sit above the fold on a standard iPhone. */}
        <View style={[styles.hero, { backgroundColor: accent }]}>
          <View style={styles.heroPhotoWrap}>
            {card.photoUrl ? (
              <Image source={{ uri: card.photoUrl }} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhoto, styles.heroPhotoFallback]}>
                <Text style={styles.heroInitial}>{(card.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroName} numberOfLines={1}>{card.name || '(no name)'}</Text>
            {!!card.title && <Text style={styles.heroSub} numberOfLines={1}>{card.title}</Text>}
            {!!card.company && <Text style={styles.heroSub} numberOfLines={1}>{card.company}</Text>}
          </View>
          {card.brandLogoUrl && (
            <View style={styles.brandBadge}>
              <Image source={{ uri: card.brandLogoUrl }} style={styles.brandBadgeImg} resizeMode="contain" />
            </View>
          )}
        </View>

        {/* 3 CRITICAL ACTIONS — above the fold. Each Pressable has an
            explicit accessibilityLabel so children with emoji + text
            don't get collapsed into "<emoji> Edit" (Maestro looks up by
            label string and was failing on the combined form). */}
        <View style={styles.criticalRow}>
          <Pressable
            accessibilityLabel="Share"
            accessibilityRole="button"
            testID="card-share"
            style={[styles.criticalBtn, { backgroundColor: accent }]}
            onPress={onShare}
          >
            <Text style={styles.criticalIcon}>📤</Text>
            <Text style={styles.criticalLabelOn}>Share</Text>
          </Pressable>
          {card.slug ? (
            <Pressable
              accessibilityLabel="Wallet"
              accessibilityRole="button"
              testID="card-wallet"
              style={styles.criticalBtn}
              onPress={() =>
                trace('wallet-open', { cardId: card.id, slug: card.slug, url: api.applePassUrl(card.slug!) },
                  () => Linking.openURL(api.applePassUrl(card.slug!)))
                  .catch(e => Alert.alert('Could not open Wallet', String(e)))
              }
            >
              <Text style={styles.criticalIcon}>🍎</Text>
              <Text style={styles.criticalLabel}>Wallet</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Syncing"
              accessibilityRole="button"
              style={[styles.criticalBtn, { opacity: 0.5 }]}
              disabled
            >
              <Text style={styles.criticalIcon}>🍎</Text>
              <Text style={styles.criticalLabel}>Syncing…</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel="Edit"
            accessibilityRole="button"
            testID="card-edit"
            style={styles.criticalBtn}
            onPress={() => router.push(`/card/edit/${card.id}`)}
          >
            <Text style={styles.criticalIcon}>✏️</Text>
            <Text style={styles.criticalLabel}>Edit</Text>
          </Pressable>
        </View>

        {/* Quick contact actions — only show buttons where data exists */}
        {(primaryPhone || primaryEmail || websiteSocial || linkedinSocial) && (
          <View style={styles.quickRow}>
            {primaryPhone && (
              <Pressable style={styles.quickBtn} onPress={() => Linking.openURL(`tel:${primaryPhone}`).catch(() => {})}>
                <Text style={styles.quickIcon}>📞</Text>
                <Text style={styles.quickLabel}>Call</Text>
              </Pressable>
            )}
            {primaryEmail && (
              <Pressable style={styles.quickBtn} onPress={() => Linking.openURL(`mailto:${primaryEmail}`).catch(() => {})}>
                <Text style={styles.quickIcon}>✉️</Text>
                <Text style={styles.quickLabel}>Email</Text>
              </Pressable>
            )}
            {linkedinSocial && (
              <Pressable style={styles.quickBtn} onPress={() => Linking.openURL(linkedinSocial.url).catch(() => {})}>
                <Text style={styles.quickIcon}>💼</Text>
                <Text style={styles.quickLabel}>LinkedIn</Text>
              </Pressable>
            )}
            {websiteSocial && (
              <Pressable style={styles.quickBtn} onPress={() => Linking.openURL(websiteSocial.url).catch(() => {})}>
                <Text style={styles.quickIcon}>🌐</Text>
                <Text style={styles.quickLabel}>Website</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* QR — below the fold, secondary use case. */}
        <View style={styles.qrFrame} ref={qrRef} collapsable={false}>
          <QRCode value={qrPayload} size={240} backgroundColor="#fff" />
        </View>
        <Text style={styles.hint}>Scan with any camera to save contact.</Text>

        <Pressable style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteText}>Delete card</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scroll: { padding: 16, alignItems: 'center', gap: 14, paddingBottom: 40 },

  // Compact horizontal hero (~100px tall) — leaves room for actions above fold.
  hero: { width: '100%', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroPhotoWrap: { },
  heroPhoto: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  heroPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  heroInitial: { color: '#fff', fontSize: 28, fontWeight: '700' },
  heroText: { flex: 1, justifyContent: 'center', gap: 2 },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  brandBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', padding: 4 },
  brandBadgeImg: { width: 36, height: 36 },

  // 3 critical buttons — equal width, sit immediately under hero.
  criticalRow: { flexDirection: 'row', gap: 10, width: '100%' },
  criticalBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: 'rgba(127,127,127,0.12)', gap: 4 },
  criticalIcon: { fontSize: 22 },
  criticalLabel: { fontSize: 13, fontWeight: '700' },
  criticalLabelOn: { color: '#fff', fontSize: 13, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  quickBtn: { minWidth: 68, padding: 10, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.10)', alignItems: 'center', gap: 4 },
  quickIcon: { fontSize: 20 },
  quickLabel: { fontSize: 11, fontWeight: '600' },

  qrFrame: { padding: 14, backgroundColor: '#fff', borderRadius: 16 },
  hint: { fontSize: 12, opacity: 0.6, textAlign: 'center' },

  deleteBtn: { padding: 12, alignItems: 'center', marginTop: 12 },
  deleteText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },

  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
