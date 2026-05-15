// Edit existing card. Loads from local storage, presents the same form,
// PATCHes server + saves local on submit.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { CardForm } from '@/components/CardForm';
import { api } from '@/lib/api';
import { deleteCard, getCard, saveCard as saveLocal } from '@/lib/storage';
import type { Card } from '@/lib/types';

export default function EditCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<Card | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCard(id).then(c => { if (!cancelled) setInitial(c ?? null); });
    return () => { cancelled = true; };
  }, [id]);

  if (!initial) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const onSubmit = async (next: Card) => {
    let photoUrl = next.photoUrl;
    let brandLogoUrl = next.brandLogoUrl;
    if (next.slug) {
      if (next.photoUrl?.startsWith('file:')) {
        try {
          const { uploadPhoto } = require('@/lib/photo');
          photoUrl = await uploadPhoto(next.slug, next.photoUrl);
        } catch { /* keep local */ }
      }
      if (next.brandLogoUrl?.startsWith('file:')) {
        try {
          const { uploadPhoto } = require('@/lib/photo');
          brandLogoUrl = await uploadPhoto(`${next.slug}-brand`, next.brandLogoUrl);
        } catch { /* keep local */ }
      }
    }
    const merged = { ...next, photoUrl, brandLogoUrl };
    // Strip server-managed fields. The server's Card has createdAt/updatedAt
    // as time.Time and we send them as numbers (epoch ms) — JSON unmarshal
    // would reject the whole body with 400, the catch below would silently
    // fall back to local-only save, and the user would see "wallet shows
    // stale data" because the server never received the edit.
    // ID is the path param; deviceId never changes; timestamps are server-side.
    const { createdAt, updatedAt, id, deviceId, ...patch } = merged;
    void createdAt; void updatedAt; void id; void deviceId;
    let saved: Card = merged;
    try {
      saved = await api.updateCard(initial.id, patch);
    } catch (e) {
      // Best-effort log so we see API failures server-side
      try {
        await fetch(`${require('@/lib/config').config.apiBase}/v1/crash`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ where: 'edit-card-patch', error: String(e), stack: (e as Error)?.stack, cardId: initial.id }),
        });
      } catch {}
    }
    await saveLocal(saved);
    router.back();
  };

  const onDelete = () =>
    Alert.alert(
      'Delete card',
      `Remove "${initial.label}: ${initial.name || '(no name)'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { await api.deleteCard(initial.id); } catch { /* offline ok */ }
            await deleteCard(initial.id);
            // Pop the edit modal AND the detail screen so we land back
            // on /cards. dismissAll first (modal), then back from detail.
            router.dismissAll?.();
            router.back();
          },
        },
      ],
    );

  return <CardForm initial={initial} onSubmit={onSubmit} onDelete={onDelete} submitLabel="Save changes" />;
}
