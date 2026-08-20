// @ts-nocheck
import React from 'react';

export const QUIZ_ACCESSORIES = [
  { id: 'crown', label: 'Crown' },
  { id: 'graduation_cap', label: 'Graduation cap' },
  { id: 'headphones', label: 'Headset' },
  { id: 'sunglasses', label: 'Sunglasses' },
  { id: 'tie', label: 'Tie' },
  { id: 'bow_tie', label: 'Bow tie' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'sparkle', label: 'Sparkle' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'cap', label: 'Cap' },
  { id: 'lightbulb', label: 'Idea' },
  { id: 'badge', label: 'Badge' },
  { id: 'pencil', label: 'Pencil' },
  { id: 'lanyard', label: 'Lanyard' },
  { id: 'visor', label: 'Visor' },
];

const QUIZ_ACCESSORY_LEGACY = {
  party_hat: 'sparkle',
  wizard_hat: 'cap',
  cowboy_hat: 'cap',
  cat_ears: 'bow_tie',
  bunny_ears: 'sparkle',
  flower_crown: 'sparkle',
  chef_hat: 'cap',
  detective_hat: 'glasses',
  halo: 'sparkle',
  devil_horns: 'sparkle',
  birthday_hat: 'sparkle',
};

export function normalizeQuizAccessoryId(id) {
  if (!id || id === 'none') return null;
  if (QUIZ_ACCESSORIES.some((item) => item.id === id)) return id;
  return QUIZ_ACCESSORY_LEGACY[id] || null;
}

function SvgFrame({ children }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
      {children}
    </svg>
  );
}

export function QuizAccessoryLayer({ id }) {
  const resolved = normalizeQuizAccessoryId(id);
  if (!resolved) return null;

  switch (resolved) {
    case 'crown':
      return (
        <SvgFrame>
          <path d="M22 40 L30 18 L42 34 L50 12 L58 34 L70 18 L78 40 Z" fill="#FACC15" stroke="#B45309" strokeWidth="2" />
          <rect x="22" y="38" width="56" height="8" rx="2" fill="#EAB308" />
        </SvgFrame>
      );
    case 'graduation_cap':
      return (
        <SvgFrame>
          <polygon points="18,32 50,18 82,32 50,44" fill="#111827" />
          <rect x="38" y="32" width="24" height="10" fill="#1F2937" />
          <line x1="82" y1="32" x2="88" y2="52" stroke="#FACC15" strokeWidth="3" />
          <circle cx="88" cy="54" r="3" fill="#FACC15" />
        </SvgFrame>
      );
    case 'headphones':
      return (
        <SvgFrame>
          <path d="M22 48 A28 28 0 0 1 78 48" fill="none" stroke="#111827" strokeWidth="7" />
          <rect x="14" y="46" width="14" height="22" rx="6" fill="#2563EB" />
          <rect x="72" y="46" width="14" height="22" rx="6" fill="#2563EB" />
        </SvgFrame>
      );
    case 'sunglasses':
      return (
        <SvgFrame>
          <rect x="18" y="46" width="26" height="16" rx="6" fill="#111827" />
          <rect x="56" y="46" width="26" height="16" rx="6" fill="#111827" />
          <rect x="42" y="50" width="16" height="4" fill="#111827" />
        </SvgFrame>
      );
    case 'tie':
      return (
        <SvgFrame>
          <polygon points="50,58 58,66 50,96 42,66" fill="#1D4ED8" />
          <polygon points="44,58 56,58 50,66" fill="#1E3A8A" />
        </SvgFrame>
      );
    case 'bow_tie':
      return (
        <SvgFrame>
          <polygon points="22,70 48,62 48,78" fill="#0F766E" />
          <polygon points="78,70 52,62 52,78" fill="#0F766E" />
          <rect x="44" y="64" width="12" height="12" rx="2" fill="#134E4A" />
        </SvgFrame>
      );
    case 'glasses':
      return (
        <SvgFrame>
          <rect x="16" y="46" width="28" height="16" rx="5" fill="none" stroke="#334155" strokeWidth="4" />
          <rect x="56" y="46" width="28" height="16" rx="5" fill="none" stroke="#334155" strokeWidth="4" />
          <rect x="44" y="51" width="12" height="4" fill="#334155" />
        </SvgFrame>
      );
    case 'sparkle':
      return (
        <SvgFrame>
          <polygon points="78,8 82,18 92,22 82,26 78,36 74,26 64,22 74,18" fill="#FACC15" />
          <polygon points="18,14 20,20 26,22 20,24 18,30 16,24 10,22 16,20" fill="#FDE68A" />
        </SvgFrame>
      );
    case 'coffee':
      return (
        <SvgFrame>
          <rect x="64" y="8" width="22" height="18" rx="3" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
          <path d="M86 12 H92 A6 6 0 0 1 92 22 H86" fill="none" stroke="#94A3B8" strokeWidth="3" />
          <rect x="68" y="12" width="14" height="10" fill="#92400E" />
          <path d="M72 4 C74 1 78 1 80 4" fill="none" stroke="#94A3B8" strokeWidth="2" />
        </SvgFrame>
      );
    case 'cap':
      return (
        <SvgFrame>
          <ellipse cx="50" cy="38" rx="36" ry="8" fill="#1E3A8A" />
          <path d="M28 38 C32 16 68 16 72 38" fill="#1D4ED8" />
          <rect x="22" y="36" width="40" height="6" rx="2" fill="#1E40AF" />
        </SvgFrame>
      );
    case 'lightbulb':
      return (
        <SvgFrame>
          <circle cx="78" cy="18" r="12" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2" />
          <rect x="73" y="28" width="10" height="8" rx="1" fill="#D97706" />
          <line x1="78" y1="4" x2="78" y2="0" stroke="#FACC15" strokeWidth="2" />
          <line x1="66" y1="10" x2="62" y2="6" stroke="#FACC15" strokeWidth="2" />
          <line x1="90" y1="10" x2="94" y2="6" stroke="#FACC15" strokeWidth="2" />
        </SvgFrame>
      );
    case 'badge':
      return (
        <SvgFrame>
          <rect x="62" y="6" width="28" height="20" rx="3" fill="#EFF6FF" stroke="#2563EB" strokeWidth="2" />
          <rect x="66" y="10" width="20" height="4" fill="#93C5FD" />
          <rect x="66" y="16" width="14" height="3" fill="#BFDBFE" />
        </SvgFrame>
      );
    case 'pencil':
      return (
        <SvgFrame>
          <rect x="78" y="6" width="8" height="36" rx="1" transform="rotate(28 82 24)" fill="#F59E0B" />
          <polygon points="88,40 94,52 80,46" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
          <rect x="80" y="4" width="10" height="6" rx="1" transform="rotate(28 85 7)" fill="#EF4444" />
        </SvgFrame>
      );
    case 'lanyard':
      return (
        <SvgFrame>
          <path d="M38 42 Q50 70 62 42" fill="none" stroke="#2563EB" strokeWidth="4" />
          <rect x="42" y="68" width="16" height="20" rx="2" fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="2" />
          <rect x="45" y="72" width="10" height="3" fill="#93C5FD" />
        </SvgFrame>
      );
    case 'visor':
      return (
        <SvgFrame>
          <ellipse cx="50" cy="40" rx="34" ry="7" fill="#0F766E" />
          <path d="M24 40 C30 28 70 28 76 40" fill="#14B8A6" />
          <path d="M18 42 C28 48 50 50 72 44" fill="#115E59" />
        </SvgFrame>
      );
    default:
      return null;
  }
}
