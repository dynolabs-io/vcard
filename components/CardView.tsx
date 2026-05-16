// CardView — single full-card view used as one page of the Cards
// horizontal peek-carousel. Each card is its own self-contained screen
// (header has Edit on the right when this card is active; the parent
// carousel reads which card is centered and wires the Edit button to it).

import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import QRCode from 'react-native-qrcode-svg';
import { api, profileUrl } from '@/lib/api';
import { config } from '@/lib/config';
import { sharePNGFromBase64, shareVCard, shareLink } from '@/lib/share';
import { templateStyle } from '@/lib/templates';
import { trace } from '@/lib/telemetry';
import type { Card } from '@/lib/types';
import { buildVCard, onlineVCardURL } from '@/lib/vcard';

type Action = {
  id: string;
  symbol: SymbolViewProps['name'];
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
};

export function CardView({
  card,
  qrMode,
  onQrModeChange,
  pageWidth,
}: {
  card: Card;
  qrMode: 'offline' | 'online';
  onQrModeChange: (m: 'offline' | 'online') => void;
  pageWidth: number;
}) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const qrRef = useRef<View>(null);

  const tmpl = templateStyle(card.template, card.customColor);
  const accent = card.customColor || (tmpl.card.backgroundColor || '#0A66C2');
  const effectiveMode: 'offline' | 'online' = card.slug ? qrMode : 'offline';
  const qrPayload =
    effectiveMode === 'online' && card.slug
      ? onlineVCardURL(card.slug, { apiBase: config.apiBase })
      : buildVCard(card, {
          profileUrl: card.slug ? profileUrl(card.slug) : undefined,
        });
  const slugUrl = card.slug ? profileUrl(card.slug) : null;

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
  // Wallet button — installs whichever mode is currently selected.
  // The chip below the QR is the SINGLE point of mode choice. No
  // additional chooser at tap time (per founder feedback).
  actions.push({
    id: 'wallet', symbol: 'wallet.pass.fill',
    label: card.slug ? 'wallet' : 'syncing',
    a11y: card.slug ? 'Wallet' : 'Syncing',
    disabled: !card.slug,
    onPress: () => {
      if (!card.slug) return;
      const url = api.applePassUrl(card.slug, effectiveMode);
      trace('wallet-open', { cardId: card.id, slug: card.slug, mode: effectiveMode, url },
        () => Linking.openURL(url))
        .catch(e => Alert.alert('Could not open Wallet', String(e)));
    },
  });
  if (websiteSocial) actions.push({
    id: 'website', symbol: 'safari.fill', label: 'web', a11y: 'Website',
    onPress: () => Linking.openURL(websiteSocial.url).catch(() => {}),
  });
  if (linkedinSocial) actions.push({
    id: 'linkedin', symbol: 'link', label: 'linkedin', a11y: 'LinkedIn',
    onPress: () => Linking.openURL(linkedinSocial.url).catch(() => {}),
  });

  // QR size: cap to a reasonable max so on tall phones the QR doesn't
  // expand past the visible viewport. The carousel page itself is
  // ScrollView-wrapped, so even small phones can reach the chip & hint
  // by flicking up.
  const qrSize = Math.min(Math.floor(pageWidth - PAGE_PADDING * 2), 320);

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      {/* Centered medallion: photo dead center on brand color */}
      <View style={[styles.hero, { backgroundColor: accent }]}>
        {card.photoUrl ? (
          <Image source={{ uri: card.photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.photoInitial}>{(card.name || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>{card.name || '(no name)'}</Text>
      {(card.title || card.company) && (
        <Text style={styles.sub} numberOfLines={1}>
          {[card.title, card.company].filter(Boolean).join(' · ')}
        </Text>
      )}

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
                <SymbolView name={a.symbol} tintColor="#fff" resizeMode="scaleAspectFit"
                  weight="semibold" style={styles.actionSymbol} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View ref={qrRef} collapsable={false} style={[styles.qrFrame, { width: qrSize, height: qrSize }]}>
        <QRCode value={qrPayload} size={qrSize - 28} backgroundColor="#fff" />
      </View>

      {card.slug && (
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => onQrModeChange('offline')}
            accessibilityLabel="Offline QR mode"
            style={[styles.modeChip, effectiveMode === 'offline' && styles.modeChipActive]}
          >
            <Text style={[styles.modeLabel, effectiveMode === 'offline' && styles.modeLabelActive]}>Offline</Text>
          </Pressable>
          <Pressable
            onPress={() => onQrModeChange('online')}
            accessibilityLabel="Online QR mode"
            style={[styles.modeChip, effectiveMode === 'online' && styles.modeChipActive]}
          >
            <Text style={[styles.modeLabel, effectiveMode === 'online' && styles.modeLabelActive]}>Online</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>
        {effectiveMode === 'online'
          ? 'Recipient online → contact saves with your photo.'
          : 'Saves instantly, no network. No photo on saved contact.'}
      </Text>
    </ScrollView>
  );
}

const PAGE_PADDING = 20;

const styles = StyleSheet.create({
  page: { paddingHorizontal: PAGE_PADDING, paddingTop: 8, paddingBottom: 24, alignItems: 'center', gap: 10 },
  hero: { width: '100%', borderRadius: 22, paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: '#fff' },
  photoFallback: { backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  photoInitial: { color: '#fff', fontSize: 44, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '600', textAlign: 'center', letterSpacing: -0.3 },
  sub: { fontSize: 14, color: 'rgba(60,60,67,0.7)', textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignSelf: 'stretch', marginTop: 2 },
  actionItem: { alignItems: 'center', gap: 4, flexShrink: 1 },
  actionCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  actionSymbol: { width: 20, height: 20 },
  actionLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(60,60,67,0.85)', textTransform: 'lowercase' },
  qrFrame: { backgroundColor: '#fff', borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(127,127,127,0.15)' },
  modeRow: { flexDirection: 'row', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(127,127,127,0.10)', borderRadius: 12, padding: 4 },
  modeChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 9 },
  modeChipActive: { backgroundColor: '#fff' },
  modeLabel: { fontSize: 14, fontWeight: '500', color: 'rgba(60,60,67,0.85)' },
  modeLabelActive: { color: '#0A66C2', fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.5, textAlign: 'center' },
});
