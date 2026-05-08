// Card detail / QR view. Tapping a card from the list opens here. The QR
// encodes a full vCard 3.0 string so the recipient's default camera app
// (iOS / Android) offers "Add to Contacts" with no app install needed.
//
// "Add to Wallet" buttons hit pass-signer in Phase 6 — currently they
// surface the stub-mode 503 message verbatim so we can verify the wire.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { getCard } from '@/lib/storage';
import { profileUrl } from '@/lib/api';
import { buildVCard } from '@/lib/vcard';
import type { Card } from '@/lib/types';

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    if (!id) return;
    const c = getCard(id);
    setCard(c ?? null);
  }, [id]);

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

  // If the card has a server slug, the QR encodes the short
  // dynolabs.io/c/<slug> URL — recipient lands on the styled web profile,
  // taps "Save to Contacts", and gets the full vCard with photo. If the
  // card hasn't synced yet (offline create), fall back to embedding the
  // raw vCard text so the recipient still gets a save prompt.
  const qrPayload = card.slug ? profileUrl(card.slug) : buildVCard(card);
  const shareUrl = card.slug ? profileUrl(card.slug) : null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cardFace}>
          <Text style={styles.label}>{card.label}</Text>
          <Text style={styles.name}>{card.name || '(no name)'}</Text>
          {card.title && <Text style={styles.title}>{card.title}</Text>}
          {card.company && <Text style={styles.company}>{card.company}</Text>}
        </View>

        <View style={styles.qrFrame}>
          <QRCode value={qrPayload} size={240} backgroundColor="#fff" />
        </View>
        <Text style={styles.hint}>Anyone can scan this with their default camera.</Text>

        {shareUrl && (
          <Pressable
            style={styles.shareRow}
            onPress={async () => {
              await Clipboard.setStringAsync(shareUrl);
              alert('Link copied');
            }}
          >
            <Text style={styles.shareLabel}>Share link</Text>
            <Text numberOfLines={1} style={styles.shareUrl}>{shareUrl}</Text>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.action, { opacity: 0.5 }]}
            onPress={() => alert('Apple Wallet — pass-signer is in stub mode until the Pass Type ID cert is provisioned (Phase 6).')}
          >
            <Text style={styles.actionText}>Add to Apple Wallet</Text>
          </Pressable>
          <Pressable
            style={[styles.action, { opacity: 0.5 }]}
            onPress={() => alert('Google Wallet — pass-signer is in stub mode until the Wallet API issuer is provisioned (Phase 6).')}
          >
            <Text style={styles.actionText}>Add to Google Wallet</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scroll: { padding: 24, alignItems: 'center', gap: 24 },
  cardFace: { width: '100%', padding: 24, borderRadius: 24, backgroundColor: '#0B0B0F' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 8 },
  title: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 4 },
  company: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },
  qrFrame: { padding: 16, backgroundColor: '#fff', borderRadius: 16 },
  hint: { fontSize: 13, opacity: 0.6, textAlign: 'center' },
  actions: { width: '100%', gap: 12, marginTop: 8 },
  action: { padding: 16, borderRadius: 999, backgroundColor: '#111', alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cta: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#111' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  shareRow: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.08)' },
  shareLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, opacity: 0.6, textTransform: 'uppercase' },
  shareUrl: { fontSize: 14, marginTop: 4 },
});
