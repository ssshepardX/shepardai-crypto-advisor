export type TelegramMiniAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type TelegramMiniApp = {
  initData: string;
  initDataUnsafe?: {
    user?: TelegramMiniAppUser;
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme?: 'light' | 'dark';
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramMiniApp;
    };
  }
}

export function telegramWebApp() {
  return window.Telegram?.WebApp || null;
}

export function isTelegramMiniApp() {
  return Boolean(telegramWebApp()?.initData);
}

export function initTelegramMiniApp() {
  const app = telegramWebApp();
  if (!app) return null;
  app.ready();
  app.expand();
  return app;
}
