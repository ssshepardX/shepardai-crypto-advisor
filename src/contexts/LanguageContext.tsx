import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const storageKey = 'shepard-language';
const dictionary: Partial<Record<AppLanguage, Record<string, string>>> = {
  tr: {
    'Market intelligence': 'Piyasa istihbaratı',
    Dashboard: 'Panel',
    'Market lab': 'Market lab',
    Pricing: 'Fiyatlar',
    'Log out': 'Çıkış',
    'Log in': 'Giriş',
    Admin: 'Admin',
    Contact: 'İletişim',
    Send: 'Gönder',
    Sending: 'Gönderiliyor',
    Refresh: 'Yenile',
    Users: 'Kullanıcılar',
    Private: 'Özel',
    'Contact messages': 'İletişim mesajları',
    'Contact form': 'İletişim formu',
    'Payment complete': 'Ödeme tamamlandı',
    'Payment canceled': 'Ödeme iptal edildi',
  },
};

function detectLanguage(): AppLanguage {
  const saved = window.localStorage.getItem(storageKey) as AppLanguage | null;
  if (saved && languages.some((item) => item.code === saved)) return saved;
  const browser = navigator.language.slice(0, 2) as AppLanguage;
  return languages.some((item) => item.code === browser) ? browser : 'tr';
}

const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => detectLanguage());

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

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    languages,
    setLanguage,
    translate: (text: string) => dictionary[language]?.[text] || text,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}

export function Trans({ text }: { text: string }) {
  const { translate } = useLanguage();
  return <>{translate(text)}</>;
}

export default LanguageProvider;
