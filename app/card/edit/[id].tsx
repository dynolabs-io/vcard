// Edit existing card. Loads from local storage, presents the same form,
// PATCHes server + saves local on submit.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CardForm } from '@/components/CardForm';
import { api } from '@/lib/api';
import { getCard, saveCard as saveLocal } from '@/lib/storage';
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
    if (next.slug && next.photoUrl?.startsWith('file:')) {
      try {
        const { uploadPhoto } = require('@/lib/photo');
        photoUrl = await uploadPhoto(next.slug, next.photoUrl);
      } catch { /* keep local */ }
    }
    const merged = { ...next, photoUrl };
    try {
      const updated = await api.updateCard(initial.id, merged);
      await saveLocal(updated);
    } catch {
      await saveLocal(merged);
    }
    router.back();
  };

  return <CardForm initial={initial} onSubmit={onSubmit} submitLabel="Save changes" />;
}
