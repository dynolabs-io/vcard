// Card templates — visual styles applied to the card detail screen and
// (later) embedded in the .pkpass design. Each template returns a
// computed style block plus an accent color the QR frame uses.

import type { CardTemplate } from './types';

export type TemplateStyle = {
  card:   { backgroundColor?: string; backgroundGradient?: [string, string] };
  label:  { color: string };
  name:   { color: string };
  title:  { color: string };
  company:{ color: string };
  qrAccent: string;
};

const MONO: TemplateStyle = {
  card:    { backgroundColor: '#0B0B0F' },
  label:   { color: 'rgba(255,255,255,0.5)' },
  name:    { color: '#fff' },
  title:   { color: 'rgba(255,255,255,0.85)' },
  company: { color: 'rgba(255,255,255,0.7)' },
  qrAccent:'#fff',
};

const GRADIENT: TemplateStyle = {
  card:    { backgroundGradient: ['#1f2533', '#0b1024'] },
  label:   { color: 'rgba(255,255,255,0.5)' },
  name:    { color: '#fff' },
  title:   { color: 'rgba(255,255,255,0.85)' },
  company: { color: 'rgba(255,255,255,0.7)' },
  qrAccent:'#5b8def',
};

const GLASS: TemplateStyle = {
  card:    { backgroundGradient: ['#101012', '#1c1c22'] },
  label:   { color: 'rgba(255,255,255,0.6)' },
  name:    { color: '#fff' },
  title:   { color: 'rgba(255,255,255,0.85)' },
  company: { color: 'rgba(255,255,255,0.7)' },
  qrAccent:'#fff',
};

export function templateStyle(t: CardTemplate, customColor?: string): TemplateStyle {
  if (t === 'gradient') return GRADIENT;
  if (t === 'glass')    return GLASS;
  if (t === 'custom') {
    const accent = customColor || '#0A66C2';
    return {
      card:    { backgroundColor: accent },
      label:   { color: 'rgba(255,255,255,0.6)' },
      name:    { color: '#fff' },
      title:   { color: 'rgba(255,255,255,0.85)' },
      company: { color: 'rgba(255,255,255,0.7)' },
      qrAccent:'#fff',
    };
  }
  return MONO;
}

export const TEMPLATES: { id: CardTemplate; name: string; preview: TemplateStyle }[] = [
  { id: 'mono',     name: 'Mono',     preview: MONO },
  { id: 'gradient', name: 'Gradient', preview: GRADIENT },
  { id: 'glass',    name: 'Glass',    preview: GLASS },
  { id: 'custom',   name: 'Custom',   preview: { ...MONO, card: { backgroundColor: '#0A66C2' } } },
];

// 8 preset accent colours for the custom template.
export const CUSTOM_COLORS = [
  '#0A66C2', '#7C3AED', '#DB2777', '#DC2626',
  '#EA580C', '#16A34A', '#0891B2', '#1E293B',
];
