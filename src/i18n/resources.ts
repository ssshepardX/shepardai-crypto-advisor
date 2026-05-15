import { en } from './locales/en';
import { tr } from './locales/tr';
import type { AppLanguage, TranslationCatalog } from './types';

export const resources: Record<AppLanguage, TranslationCatalog> = {
  en,
  tr,
};
