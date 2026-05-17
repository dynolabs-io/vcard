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

  // QR size relative to the inner card width — capped so on tall phones
  // the QR doesn't expand past the visible viewport (ScrollView still
  // allows scroll if it overflows).
  const cardWidth = pageWidth - PAGE_PADDING * 2;
  const qrInsetWidth = cardWidth - INSET_PAD * 2;
  const qrSize = Math.min(qrInsetWidth, 280);

  // Choose readable foreground for the brand color. Light backgrounds
  // need dark text; dark backgrounds need white. Simple luminance check.
  const fgOnBrand = isLight(accent) ? '#0B0B0F' : '#FFFFFF';
  const fgOnBrandSoft = isLight(accent) ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.80)';

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      {/* ONE unified branded card surface — the whole carousel page is
          this single card (Apple Wallet inspired). Company logo top-left
          badge, photo medallion centered, name/title in brand-color text
          area, action row + QR + mode chip all live inside the card. */}
      <View style={[styles.cardSurface, { backgroundColor: accent, width: cardWidth }]}>
        {/* Top row — company logo badge (only when uploaded) */}
        <View style={styles.topRow}>
          {card.brandLogoUrl ? (
            <View style={styles.logoBadge}>
              <Image source={{ uri: card.brandLogoUrl }} style={styles.logoBadgeImg} resizeMode="contain" />
            </View>
          ) : null}
        </View>

        {/* Photo medallion */}
        <View style={styles.medallionWrap}>
          {card.photoUrl ? (
            <Image source={{ uri: card.photoUrl }} style={styles.medallion} />
          ) : (
            <View style={[styles.medallion, styles.medallionFallback]}>
              <Text style={styles.medallionInitial}>{(card.name || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Name + title on brand background */}
        <Text style={[styles.brandName, { color: fgOnBrand }]} numberOfLines={1}>
          {card.name || '(no name)'}
        </Text>
        {(card.title || card.company) && (
          <Text style={[styles.brandSub, { color: fgOnBrandSoft }]} numberOfLines={1}>
            {[card.title, card.company].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Action row — translucent pills on brand color */}
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
                <View style={[
                  styles.actionCircle,
                  { backgroundColor: isLight(accent) ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)',
                    opacity: a.disabled ? 0.4 : 1 },
                ]}>
                  <SymbolView name={a.symbol} tintColor={fgOnBrand} resizeMode="scaleAspectFit"
                    weight="semibold" style={styles.actionSymbol} />
                </View>
                <Text style={[styles.actionLabel, { color: fgOnBrandSoft }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* QR inset — white panel sits inside the brand card */}
        <View ref={qrRef} collapsable={false} style={[styles.qrInset, { width: qrSize + 28, height: qrSize + 28 }]}>
          <QRCode value={qrPayload} size={qrSize} backgroundColor="#fff" />
        </View>

        {/* Mode chip — translucent on brand */}
        {card.slug && (
          <View style={[styles.modeRow, { backgroundColor: isLight(accent) ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.16)' }]}>
            <Pressable
              onPress={() => onQrModeChange('offline')}
              accessibilityLabel="Offline QR mode"
              style={[styles.modeChip, effectiveMode === 'offline' && { backgroundColor: '#fff' }]}
            >
              <Text style={[
                styles.modeLabel,
                { color: effectiveMode === 'offline' ? accent : fgOnBrandSoft },
              ]}>Offline</Text>
            </Pressable>
            <Pressable
              onPress={() => onQrModeChange('online')}
              accessibilityLabel="Online QR mode"
              style={[styles.modeChip, effectiveMode === 'online' && { backgroundColor: '#fff' }]}
            >
              <Text style={[
                styles.modeLabel,
                { color: effectiveMode === 'online' ? accent : fgOnBrandSoft },
              ]}>Online</Text>
            </Pressable>
          </View>
        )}
        <Text style={[styles.brandHint, { color: fgOnBrandSoft }]}>
          {effectiveMode === 'online'
            ? 'Recipient online → contact saves with your photo.'
            : 'Saves instantly, no network. No photo on saved contact.'}
        </Text>
      </View>
    </ScrollView>
  );
}

/** Quick luminance check for picking dark vs light foreground on
 *  arbitrary brand background colors. Accepts #rrggbb. */
function isLight(hex: string): boolean {
  const s = hex.replace('#', '');
  if (s.length !== 6) return false;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  // Rec. 709 luma
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 160;
}

const PAGE_PADDING = 16;
const INSET_PAD = 18;

const styles = StyleSheet.create({
  page: { paddingHorizontal: PAGE_PADDING, paddingTop: 8, paddingBottom: 24, alignItems: 'center' },

  // The single unified card surface (Apple-Wallet-like)
  cardSurface: {
    borderRadius: 28,
    paddingTop: 14,
    paddingHorizontal: INSET_PAD,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 10,
    // Subtle outer shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  topRow: { width: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  logoBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    padding: 5,
  },
  logoBadgeImg: { width: 28, height: 28 },

  medallionWrap: { marginTop: 4, marginBottom: 4 },
  medallion: { width: 124, height: 124, borderRadius: 62, borderWidth: 4, borderColor: '#fff' },
  medallionFallback: { backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  medallionInitial: { color: '#fff', fontSize: 48, fontWeight: '700' },

  brandName: { fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  brandSub:  { fontSize: 14, textAlign: 'center', marginTop: -2 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignSelf: 'stretch', marginTop: 6 },
  actionItem: { alignItems: 'center', gap: 4, flexShrink: 1 },
  actionCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionSymbol: { width: 20, height: 20 },
  actionLabel: { fontSize: 11, fontWeight: '500', textTransform: 'lowercase' },

  qrInset: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  modeRow: { flexDirection: 'row', gap: 6, alignSelf: 'center', borderRadius: 12, padding: 4, marginTop: 4 },
  modeChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 9 },
  modeLabel: { fontSize: 13, fontWeight: '600' },

  brandHint: { fontSize: 11, textAlign: 'center', marginTop: 2, paddingHorizontal: 6 },
});
