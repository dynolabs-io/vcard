// Create-card route. Renders the shared CardForm with an empty card.

import { useRouter } from 'expo-router';
import { CardForm } from '@/components/CardForm';
import { uploadPhoto } from '@/lib/photo';
import { saveCard as saveLocal } from '@/lib/storage';
import { createCardSynced } from '@/lib/sync';
import { emptyCard, type Card } from '@/lib/types';

export default function NewCard() {
  const router = useRouter();

  const onSubmit = async (next: Card) => {
    const localPhoto = next.photoUrl?.startsWith('file:') ? next.photoUrl : undefined;
    const saved = await createCardSynced({ ...next, photoUrl: localPhoto ? undefined : next.photoUrl });
    if (!saved?.id) throw new Error('save returned empty');
    // If the user picked a photo while offline, upload now that we have a slug.
    if (localPhoto && saved.slug) {
      try {
        const url = await uploadPhoto(saved.slug, localPhoto);
        await saveLocal({ ...saved, photoUrl: url });
      } catch {
        // ok — local file still works on this device; will retry next edit
      }
    }
    router.back();
  };

  return <CardForm initial={emptyCard()} onSubmit={onSubmit} submitLabel="Save card" enablePrefill />;
}
