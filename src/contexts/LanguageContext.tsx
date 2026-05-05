import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'tr' | 'en';

const languages: Array<{ code: AppLanguage; label: string }> = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
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
    // --- Navigation & Shell ---
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
    Supervisor: 'Denetçi',

    // --- Dashboard ---
    'Movement scanner': 'Hareket tarayıcı',
    'Checks recent market moves and classifies the likely cause.': 'Son piyasa hareketlerini kontrol eder ve olası kaynağı sınıflandırır.',
    'Scan Market': 'Piyasayı Tara',
    'Manual scanning is available on the Trader plan. Cached results remain visible.': 'Manuel tarama Trader planında aktiftir. Kayıtlı sonuçlar görünür kalır.',
    'Recent movement checks': 'Son hareket kontrolleri',
    'Scanner results': 'Tarayıcı sonuçları',
    'No scanner result yet.': 'Henüz tarayıcı sonucu yok.',
    Plan: 'Plan',
    'Daily checks': 'Günlük kontrol',
    Scanner: 'Tarayıcı',
    Renewal: 'Yenileme',

    // --- CoinAnalysis ---
    'Movement analysis': 'Hareket analizi',
    'Find the likely reason behind a sudden market move.': 'Ani bir piyasa hareketinin olası nedenini bul.',
    'Analysis setup': 'Analiz ayarları',
    Pair: 'Çift',
    Timeframe: 'Zaman dilimi',
    Analyze: 'Analiz et',
    'Market chart': 'Piyasa grafiği',
    Cause: 'Kaynak',
    'Cause signal': 'Kaynak sinyali',
    Confidence: 'Güven skoru',
    'Manipulation risk': 'Manipülasyon riski',
    'Risk and whale check': 'Risk ve balina kontrolü',
    'Technical summary': 'Teknik özet',
    'Movement cause': 'Hareket kaynağı',
    'Likely cause': 'Olası kaynak',
    'News and social catalyst': 'Haber ve sosyal katalizör',
    Summary: 'Özet',
    'Whale trace': 'Balina izi',
    Manipulation: 'Manipülasyon',
    'Daily analysis': 'Günlük analiz',
    'Saved result': 'Kayıtlı sonuç',
    'Saved summary': 'Kayıtlı özet',
    'New check': 'Yeni kontrol',
    'Advanced risk and whale details are available on Pro and Trader plans.': 'Gelişmiş risk ve balina detayları Pro ve Trader planlarında mevcuttur.',
    'News and social details are available on Pro and Trader plans.': 'Haber ve sosyal detaylar Pro ve Trader planlarında mevcuttur.',
    'Catalyst terms': 'Katalizör terimleri',
    'No catalyst term found yet.': 'Henüz katalizör terimi bulunamadı.',

    // --- ScanningCard ---
    'Checking market data...': 'Piyasa verisi kontrol ediliyor...',
    'Reading volume changes...': 'Hacim değişiklikleri okunuyor...',
    'Classifying movement cause...': 'Hareket kaynağı sınıflandırılıyor...',
    'Reading order book depth': 'Emir defteri derinliği okunuyor',
    'Checking whale and liquidity traces': 'Balina ve likidite izleri kontrol ediliyor',
    'Preparing short summary': 'Kısa özet hazırlanıyor',
    Alert: 'Uyarı',
    'Volume spike': 'Hacim artışı',

    // --- Pricing ---
    Plans: 'Planlar',
    'Choose limits for movement source analysis.': 'Hareket kaynağı analizi için limitleri seç.',
    Monthly: 'Aylık',
    '3 months': '3 aylık',
    Yearly: 'Yıllık',
    monthly: 'aylık',
    '3 months_lower': '3 aylık',
    yearly: 'yıllık',
    'Best value': 'En iyi değer',
    'Highest limit': 'En yüksek limit',
    'Basic access for trying the product.': 'Ürünü denemek için temel erişim.',
    'For users who check market moves regularly.': 'Piyasa hareketlerini düzenli kontrol eden kullanıcılar için.',
    'For higher daily use and manual market scans.': 'Daha yüksek günlük kullanım ve manuel piyasa taramaları için.',
    '3 movement checks per day': 'Günde 3 hareket kontrolü',
    'Delayed scanner': 'Gecikmeli tarayıcı',
    'Basic chart and scores': 'Temel grafik ve skorlar',
    'Advanced risk details hidden': 'Gelişmiş risk detayları gizli',
    '50 movement checks per day': 'Günde 50 hareket kontrolü',
    'Live scanner view': 'Canlı tarayıcı görünümü',
    'Supervisor summary': 'Denetçi özeti',
    'Risk and whale details': 'Risk ve balina detayları',
    '250 movement checks per day': 'Günde 250 hareket kontrolü',
    'Manual market scanner': 'Manuel piyasa tarayıcı',
    'All advanced details': 'Tüm gelişmiş detaylar',
    'Higher product limits': 'Daha yüksek ürün limitleri',
    'Use Free': 'Ücretsiz Kullan',
    'Start PRO': 'PRO Başlat',
    'Start TRADER': 'TRADER Başlat',
    '25% discount included in total price': 'Toplam fiyata %25 indirim dahil',
    '50% discount included in total price': 'Toplam fiyata %50 indirim dahil',

    // --- Index / Landing ---
    'Crypto Movement Intelligence': 'Kripto Hareket İstihbaratı',
    'See why a coin moved. Check demand, whale activity, low liquidity, and news or social catalysts.': 'Bir coinin neden hareket ettiğini gör. Talep, balina aktivitesi, düşük likidite ve haber veya sosyal katalizörleri kontrol et.',
    'Check movements': 'Hareketleri kontrol et',
    'Movement Intelligence': 'Hareket İstihbaratı',
    'Not a trade signal. The product explains likely cause, manipulation risk, and source confidence.': 'Bu bir alım-satım sinyali değil. Ürün, olası kaynağı, manipülasyon riskini ve kaynak güvenini açıklar.',
    'Classifies sudden moves using technical, volume, order book, news, and social signals.': 'Ani hareketleri teknik, hacim, emir defteri, haber ve sosyal sinyaller kullanarak sınıflandırır.',
    'Reads whale traces, thin liquidity, wick rejection, and volume anomalies together.': 'Balina izleri, zayıf likidite, fitil reddi ve hacim anomalilerini birlikte okur.',
    'Catalyst tracking': 'Katalizör takibi',
    'Summarizes aggregate news and Reddit signals without storing raw posts.': 'Ham gönderileri saklamadan toplu haber ve Reddit sinyallerini özetler.',
    'Market overview': 'Piyasa genel görünümü',

    // --- Contact & Admin ---
    'Contact messages': 'İletişim mesajları',
    'Contact form': 'İletişim formu',
    'Payment complete': 'Ödeme tamamlandı',
    'Payment canceled': 'Ödeme iptal edildi',
    'Admin login': 'Admin girişi',
    'Private access.': 'Özel erişim.',
    'Users, plans, messages.': 'Kullanıcılar, planlar, mesajlar.',
    'Send feedback or support request.': 'Geri bildirim veya destek talebi gönder.',
    'Message sent.': 'Mesaj gönderildi.',
    'Message failed.': 'Mesaj gönderilemedi.',

    // --- Misc ---
    'AI Market Analyst - Crypto AI Advisor Platform': 'AI Piyasa Analisti - Kripto AI Danışman Platformu',
    'Crypto market movement intelligence platform. Understand sudden price moves, whale traces, fraud risk, and social/news catalysts.': 'Kripto piyasa hareket istihbarat platformu. Ani fiyat hareketlerini, balina izlerini, dolandırıcılık riskini ve sosyal/haber katalizörlerini anlayın.',
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
    document.documentElement.dir = 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
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
