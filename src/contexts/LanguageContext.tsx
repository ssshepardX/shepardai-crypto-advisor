import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppLanguage = 'tr' | 'en' | 'de' | 'es' | 'fr' | 'ar' | 'ru';

const languages: Array<{ code: AppLanguage; label: string }> = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
];

type LanguageContextValue = {
  language: AppLanguage;
  languages: typeof languages;
  setLanguage: (language: AppLanguage) => void;
  translate: (text: string) => string;
  translateMany: (texts: string[]) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const storageKey = 'shepard-language';
const cacheKey = 'shepard-translation-cache';

function detectLanguage(): AppLanguage {
  const saved = window.localStorage.getItem(storageKey) as AppLanguage | null;
  if (saved && languages.some((item) => item.code === saved)) return saved;
  const browser = navigator.language.slice(0, 2) as AppLanguage;
  return languages.some((item) => item.code === browser) ? browser : 'tr';
}

function readCache(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(cacheKey) || '{}');
  } catch {
    return {};
  }
}

const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => detectLanguage());
  const [cache, setCache] = useState<Record<string, string>>(() => readCache());

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(storageKey, next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const translateMany = useCallback(async (texts: string[]) => {
    if (language === 'tr') return;
    const uniqueTexts = Array.from(new Set(texts.filter(Boolean)));
    const missing = uniqueTexts.filter((text) => !cache[`${language}:${text}`]);
    if (!missing.length) return;

    const { data, error } = await supabase.functions.invoke('translate-text', {
      method: 'POST',
      body: { texts: missing, targetLanguage: language },
    });
    if (error || !Array.isArray(data?.translations)) return;

    const nextCache = { ...cache };
    missing.forEach((text, index) => {
      nextCache[`${language}:${text}`] = String(data.translations[index] || text);
    });
    setCache(nextCache);
    window.localStorage.setItem(cacheKey, JSON.stringify(nextCache));
  }, [cache, language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    languages,
    setLanguage,
    translate: (text: string) => language === 'tr' ? text : cache[`${language}:${text}`] || text,
    translateMany,
  }), [cache, language, setLanguage, translateMany]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}

export function Trans({ text }: { text: string }) {
  const { translate, translateMany, language } = useLanguage();
  useEffect(() => {
    if (language !== 'tr') void translateMany([text]);
  }, [language, text, translateMany]);
  return <>{translate(text)}</>;
}

export default LanguageProvider;
