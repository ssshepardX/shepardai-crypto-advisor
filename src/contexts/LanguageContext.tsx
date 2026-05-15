/* eslint-disable react-refresh/only-export-components */
import { I18nProvider, Trans, useTranslation } from '@/i18n/I18nProvider';
import type { AppLanguage, TranslateValues } from '@/i18n/types';

export type { AppLanguage, TranslateValues };

export function useLanguage() {
  return useTranslation();
}

export { Trans };

export default I18nProvider;
