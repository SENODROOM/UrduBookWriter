export interface FontOption {
  key: string;
  label: string;
  stack: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "notoNastaliqUrdu", label: "Noto Nastaliq Urdu (classic)", stack: '"Noto Nastaliq Urdu", serif' },
  { key: "notoNaskhArabic", label: "Noto Naskh Arabic (naskh)", stack: '"Noto Naskh Arabic", serif' },
  { key: "gulzar", label: "Gulzar (decorative)", stack: '"Gulzar", serif' },
];

export const DEFAULT_FONT_KEY = FONT_OPTIONS[0].key;

export function fontStackFor(key: string | undefined): string {
  return FONT_OPTIONS.find((f) => f.key === key)?.stack ?? FONT_OPTIONS[0].stack;
}
