/* eslint-disable react-refresh/only-export-components */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resources } from './resources';
import { defaultLanguage, languages, storageKey, type AppLanguage, type TranslateValues, type TranslationCatalog } from './types';

type I18nContextValue = {
  language: AppLanguage;
  languages: typeof languages;
  setLanguage: (language: AppLanguage) => void;
  translate: (key: string, values?: TranslateValues, fallback?: string) => string;
  t: (key: string, values?: TranslateValues, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLanguage(): AppLanguage {
  const saved = window.localStorage.getItem(storageKey) as AppLanguage | null;
  if (saved && languages.some((item) => item.code === saved)) return saved;
  const browser = navigator.language.slice(0, 2) as AppLanguage;
  return languages.some((item) => item.code === browser) ? browser : defaultLanguage;
}

function applyValues(text: string, values?: TranslateValues) {
  if (!values) return text;
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

async function loadRuntimeCatalog(language: AppLanguage): Promise<TranslationCatalog> {
  try {
    const response = await fetch(`/locales/${language}.json`, { cache: 'no-store' });
    if (!response.ok) return {};
    const data = await response.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data as TranslationCatalog : {};
  } catch {
    return {};
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => detectLanguage());
  const [runtimeCatalogs, setRuntimeCatalogs] = useState<Partial<Record<AppLanguage, TranslationCatalog>>>({});

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(storageKey, next);
    document.documentElement.lang = next;
    document.documentElement.dir = 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    let cancelled = false;
    loadRuntimeCatalog(language).then((catalog) => {
      if (cancelled) return;
      setRuntimeCatalogs((current) => ({ ...current, [language]: catalog }));
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const translate = useCallback((key: string, values?: TranslateValues, fallback?: string) => {
    const runtime = runtimeCatalogs[language]?.[key];
    const staticText = resources[language]?.[key];
    const englishRuntime = runtimeCatalogs.en?.[key];
    const englishStatic = resources.en?.[key];
    return applyValues(runtime || staticText || englishRuntime || englishStatic || fallback || key, values);
  }, [language, runtimeCatalogs]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    languages,
    setLanguage,
    translate,
    t: translate,
  }), [language, setLanguage, translate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used inside I18nProvider');
  return context;
}

export function Trans({ text, values, fallback }: { text: string; values?: TranslateValues; fallback?: string }) {
  const { translate } = useTranslation();
  return <>{translate(text, values, fallback)}</>;
}
