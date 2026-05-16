// Create-card route. Renders the shared CardForm with an empty card.
// After save we navigate to the new card's detail page so the Add to
// Apple Wallet button is one tap away.

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
    const localLogo  = next.brandLogoUrl?.startsWith('file:') ? next.brandLogoUrl : undefined;
    const saved = await createCardSynced({
      ...next,
      photoUrl: localPhoto ? undefined : next.photoUrl,
      brandLogoUrl: localLogo ? undefined : next.brandLogoUrl,
    });
    if (!saved?.id) throw new Error('save returned empty');

    if (saved.slug && (localPhoto || localLogo)) {
      try {
        const { uploadPhoto } = require('@/lib/photo');
        let photoUrl: string | undefined = saved.photoUrl;
        let brandLogoUrl: string | undefined = saved.brandLogoUrl;
        if (localPhoto) {
          try { photoUrl = await uploadPhoto(saved.slug, localPhoto); } catch {}
        }
        if (localLogo) {
          try { brandLogoUrl = await uploadPhoto(`${saved.slug}-brand`, localLogo); } catch {}
        }
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
            photoUrl,
            brandLogoUrl,
          });
          await saveLocal(updated);
        } catch {
          await saveLocal({ ...saved, photoUrl, brandLogoUrl });
        }
      } catch {/* picker upload failed — keep card without photo/logo */}
    }
    // After save, return to the Cards carousel — the new card is now in
    // the list. The carousel doesn't auto-scroll to the newest card today
    // (Build 127 follow-up: auto-scroll to it).
    router.back();
  };

  return <CardForm initial={emptyCard()} onSubmit={onSubmit} submitLabel="Save card" />;
}
