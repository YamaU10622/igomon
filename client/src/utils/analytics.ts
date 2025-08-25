// Google Analytics ヘルパー関数

declare global {
  interface Window {
    gtag: (command: string, ...args: any[]) => void;
  }
}

// ページビューをトラッキング
export const trackPageView = (path: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
      page_path: path,
    });
  }
};

// イベントをトラッキング
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// カスタムイベントの例
export const trackButtonClick = (buttonName: string) => {
  trackEvent('click', 'button', buttonName);
};

export const trackFormSubmit = (formName: string) => {
  trackEvent('submit', 'form', formName);
};

export const trackGameStart = () => {
  trackEvent('game_start', 'game');
};

export const trackGameComplete = (score?: number) => {
  trackEvent('game_complete', 'game', undefined, score);
};