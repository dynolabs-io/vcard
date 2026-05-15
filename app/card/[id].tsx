// Card detail — Apple Contacts inspired layout.
//
// Header:   ← Cards          <Name>          Edit
// Body:     centered photo + name + subtitle (title · company)
//           inline round action buttons: Call / Email / Share / Wallet / Web
//           full-width QR (square, edge-to-edge)
// Deletion: happens inside the Edit form, NOT on this page.

import * as Linking from 'expo-linking';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { api, profileUrl } from '@/lib/api';
import { config } from '@/lib/config';
import { sharePNGFromBase64, shareVCard, shareLink } from '@/lib/share';
import { getCard, saveCard as saveLocal } from '@/lib/storage';
import { refetchCardIfMissingSlug } from '@/lib/sync';
import { templateStyle } from '@/lib/templates';
import { trace } from '@/lib/telemetry';
import type { Card } from '@/lib/types';
import { buildVCard, onlineVCardURL } from '@/lib/vcard';

const PAGE_PADDING = 20;

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [card, setCard] = useState<Card | null>(null);
  // Online (rich) = QR is a URL → recipient online → Safari → vCard
  // with full-res embedded photo → contact saved with avatar.
  // Offline (basic) = QR is text vCard → instant save, no photo.
  // Default Online — most use cases have network at scan time.
  const [qrMode, setQrMode] = useState<'offline' | 'online'>('online');
  const qrRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      (async () => {
        const local = await getCard(id);
        if (cancelled || !local) { setCard(local ?? null); return; }
        setCard(local);
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
      <>
        <Stack.Screen options={{ title: '' }} />
        <SafeAreaView style={styles.center}>
          <Text>Card not found.</Text>
          <Pressable onPress={() => router.back()} style={styles.cta}>
            <Text style={styles.ctaText}>Back</Text>
          </Pressable>
        </SafeAreaView>
      </>
    );
  }

  const tmpl = templateStyle(card.template, card.customColor);
  // QR payload swaps between modes. Online mode requires a slug
  // (server-side .vcf URL), so if we don't have one yet, force Offline.
  const effectiveMode: 'offline' | 'online' = card.slug ? qrMode : 'offline';
  const qrPayload =
    effectiveMode === 'online' && card.slug
      ? onlineVCardURL(card.slug, { apiBase: config.apiBase })
      : buildVCard(card, {
          profileUrl: card.slug ? profileUrl(card.slug) : undefined,
        });
  const slugUrl = card.slug ? profileUrl(card.slug) : null;
  const accent = card.customColor || (tmpl.card.backgroundColor || '#0A66C2');

  const primaryEmail = card.emails?.[0];
  const primaryPhone = card.phones?.[0];
  const websiteSocial = card.socials?.find(s => s.kind === 'website');
  const linkedinSocial = card.socials?.find(s => s.kind === 'linkedin');

  const onShare = () =>
    Alert.alert('Share contact', undefined, [
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

  // QR fills the screen width minus page padding on both sides.
  const qrSize = Math.floor(width - PAGE_PADDING * 2);

  // Action buttons row — circular SF Symbol icons, brand-accent fill.
  // Only show buttons backed by real data on the card.
  // Visible label is lowercase (Apple Contacts style), accessibility label
  // is capitalized so screen readers / Maestro can find "Share", "Wallet" etc.
  type Action = { id: string; symbol: SymbolViewProps['name']; label: string; a11y: string; onPress: () => void; disabled?: boolean; };
  const actions: Action[] = [];
  if (primaryPhone) actions.push({
    id: 'call', symbol: 'phone.fill', label: 'call', a11y: 'Call',
    onPress: () => Linking.openURL(`tel:${primaryPhone}`).catch(() => {}),
  });
  if (primaryEmail) actions.push({
    id: 'email', symbol: 'envelope.fill', label: 'mail', a11y: 'Email',
    onPress: () => Linking.openURL(`mailto:${primaryEmail}`).catch(() => {}),
  });
  actions.push({
    id: 'share', symbol: 'square.and.arrow.up', label: 'share', a11y: 'Share',
    onPress: onShare,
  });
  // ONE Wallet button that opens a chooser — tap → pick which pass.
  // Each pass has its own QR mode and its own serial number, so both
  // can sit in Apple Wallet at the same time.
  const onWallet = () => {
    if (!card.slug) return;
    Alert.alert(
      'Add to Apple Wallet',
      'Both passes can coexist in Wallet. Pick which to add now.',
      [
        {
          text: 'Online (rich) — recipient saves with full photo',
          onPress: () =>
            trace('wallet-open', { cardId: card.id, slug: card.slug, mode: 'online', url: api.applePassUrl(card.slug!, 'online') },
              () => Linking.openURL(api.applePassUrl(card.slug!, 'online')))
              .catch(e => Alert.alert('Could not open Wallet', String(e))),
        },
        {
          text: 'Offline (basic) — instant save, no photo, no network',
          onPress: () =>
            trace('wallet-open', { cardId: card.id, slug: card.slug, mode: 'offline', url: api.applePassUrl(card.slug!, 'offline') },
              () => Linking.openURL(api.applePassUrl(card.slug!, 'offline')))
              .catch(e => Alert.alert('Could not open Wallet', String(e))),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };
  actions.push({
    id: 'wallet', symbol: 'wallet.pass.fill', label: card.slug ? 'wallet' : 'syncing',
    a11y: card.slug ? 'Wallet' : 'Syncing',
    disabled: !card.slug,
    onPress: onWallet,
  });
  if (websiteSocial) actions.push({
    id: 'website', symbol: 'safari.fill', label: 'web', a11y: 'Website',
    onPress: () => Linking.openURL(websiteSocial.url).catch(() => {}),
  });
  if (linkedinSocial) actions.push({
    id: 'linkedin', symbol: 'link', label: 'linkedin', a11y: 'LinkedIn',
    onPress: () => Linking.openURL(linkedinSocial.url).catch(() => {}),
  });

  return (
    <>
      {/* Dynamic title (card's unique name) + custom Back / Edit buttons.
          We override the default chevron because iOS 26's auto back-button
          resource-id flips between 'BackButton' and absent after a couple
          navigation cycles, making it impossible for Maestro to find
          reliably. A labeled Pressable is stable. */}
      <Stack.Screen
        options={{
          title: card.name || ' ',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Back"
              accessibilityRole="button"
              testID="card-back"
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, flexDirection: 'row', alignItems: 'center' })}
            >
              <SymbolView name="chevron.left" tintColor="#0A66C2" resizeMode="scaleAspectFit" style={styles.headerChevron} />
              <Text style={styles.headerBackLabel}>Cards</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/card/edit/${card.id}`)}
              accessibilityLabel="Edit"
              accessibilityRole="button"
              testID="card-edit"
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={styles.headerEdit}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Centered avatar + name block, Apple Contacts style. */}
          <View style={styles.avatarBlock}>
            {card.photoUrl ? (
              <Image source={{ uri: card.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: accent }]}>
                <Text style={styles.avatarInitial}>{(card.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.displayName} numberOfLines={1}>{card.name || '(no name)'}</Text>
            {(card.title || card.company) && (
              <Text style={styles.displaySub} numberOfLines={1}>
                {[card.title, card.company].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>

          {/* Single row of round action buttons. */}
          {actions.length > 0 && (
            <View style={styles.actionsRow}>
              {actions.map(a => (
                <Pressable
                  key={a.id}
                  onPress={a.onPress}
                  disabled={a.disabled}
                  accessibilityLabel={a.a11y}
                  accessibilityRole="button"
                  testID={`card-action-${a.id}`}
                  style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionCircle, { backgroundColor: accent, opacity: a.disabled ? 0.4 : 1 }]}>
                    <SymbolView
                      name={a.symbol}
                      tintColor="#fff"
                      resizeMode="scaleAspectFit"
                      weight="semibold"
                      style={styles.actionSymbol}
                    />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Full-width QR. Square — same size as screen width minus page padding. */}
          <View ref={qrRef} collapsable={false} style={[styles.qrFrame, { width: qrSize, height: qrSize }]}>
            <QRCode value={qrPayload} size={qrSize - 28} backgroundColor="#fff" />
          </View>

          {/* Mode switcher — visible only when we have a slug (offline
              mode is always usable; online needs the server endpoint). */}
          {card.slug && (
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setQrMode('offline')}
                accessibilityLabel="Offline QR mode"
                accessibilityRole="button"
                style={[styles.modeChip, effectiveMode === 'offline' && styles.modeChipActive]}
              >
                <Text style={[styles.modeLabel, effectiveMode === 'offline' && styles.modeLabelActive]}>Offline (basic)</Text>
              </Pressable>
              <Pressable
                onPress={() => setQrMode('online')}
                accessibilityLabel="Online QR mode"
                accessibilityRole="button"
                style={[styles.modeChip, effectiveMode === 'online' && styles.modeChipActive]}
              >
                <Text style={[styles.modeLabel, effectiveMode === 'online' && styles.modeLabelActive]}>Online (rich)</Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.hint}>
            {effectiveMode === 'online'
              ? 'Recipient online → contact saves with your photo.'
              : 'Saves instantly, no network. No photo on saved contact.'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scroll: { paddingHorizontal: PAGE_PADDING, paddingTop: 18, paddingBottom: 40, alignItems: 'center', gap: 24 },

  headerEdit: { fontSize: 17, color: '#0A66C2', fontWeight: '500' },
  headerChevron: { width: 14, height: 22 },
  headerBackLabel: { fontSize: 17, color: '#0A66C2', fontWeight: '400', marginLeft: 2 },

  avatarBlock: { alignItems: 'center', gap: 10 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 40, fontWeight: '600' },
  displayName: { fontSize: 24, fontWeight: '600', textAlign: 'center', letterSpacing: -0.3 },
  displaySub: { fontSize: 15, color: 'rgba(60,60,67,0.7)', textAlign: 'center' },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignSelf: 'stretch' },
  actionItem: { alignItems: 'center', gap: 6, flexShrink: 1 },
  actionCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionSymbol: { width: 24, height: 24 },
  actionLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(60,60,67,0.85)', textTransform: 'lowercase' },

  qrFrame: { backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(127,127,127,0.15)' },
  modeRow: { flexDirection: 'row', gap: 8, alignSelf: 'center', backgroundColor: 'rgba(127,127,127,0.10)', borderRadius: 12, padding: 4 },
  modeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9 },
  modeChipActive: { backgroundColor: '#fff' },
  modeLabel: { fontSize: 13, fontWeight: '500', color: 'rgba(60,60,67,0.85)' },
  modeLabelActive: { color: '#0A66C2', fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.5, textAlign: 'center' },

  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
