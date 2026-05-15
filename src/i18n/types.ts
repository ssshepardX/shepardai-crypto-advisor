export type AppLanguage = 'tr' | 'en';
export type TranslateValues = Record<string, string | number | null | undefined>;
export type TranslationCatalog = Record<string, string>;

export const languages: Array<{ code: AppLanguage; label: string }> = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

export const defaultLanguage: AppLanguage = 'tr';
export const storageKey = 'shepard-language';
