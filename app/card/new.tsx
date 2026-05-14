// Create-card route. Renders the shared CardForm with an empty card.

import { useRouter } from 'expo-router';
import { CardForm } from '@/components/CardForm';
import { api } from '@/lib/api';
import { saveCard as saveLocal } from '@/lib/storage';
import { createCardSynced } from '@/lib/sync';
import { emptyCard, type Card } from '@/lib/types';

export default function NewCard() {
  const router = useRouter();

  const onSubmit = async (next: Card) => {
    const localPhoto = next.photoUrl?.startsWith('file:') ? next.photoUrl : undefined;
    const saved = await createCardSynced({ ...next, photoUrl: localPhoto ? undefined : next.photoUrl });
    if (!saved?.id) throw new Error('save returned empty');
    if (localPhoto && saved.slug) {
      try {
        const { uploadPhoto } = require('@/lib/photo');
        const url = await uploadPhoto(saved.slug, localPhoto);
        // PATCH server with photoUrl so web-profile + pass-signer can see it.
        // Previously we only saved locally — that's why dynolabs.io/c/<slug>
        // showed empty image, and Wallet pass had no thumbnail.
        try {
          const updated = await api.updateCard(saved.id, {
            label: saved.label,
            name: saved.name,
            title: saved.title,
            company: saved.company,
            emails: saved.emails,
            phones: saved.phones,
            socials: saved.socials,
            template: saved.template,
            customColor: saved.customColor,
            photoUrl: url,
          });
          await saveLocal(updated);
        } catch {
          // Server PATCH failed — keep local copy with the new photo URL
          await saveLocal({ ...saved, photoUrl: url });
        }
      } catch {/* picker upload failed — keep card without photo */}
    }
    router.back();
  };

  return <CardForm initial={emptyCard()} onSubmit={onSubmit} submitLabel="Save card" />;
}
