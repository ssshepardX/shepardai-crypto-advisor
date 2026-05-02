// Notification Service for sending alerts to users

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

class NotificationService {
  private static instance: NotificationService;
  private permissionGranted: boolean = false;

  private constructor() {
    this.initializeNotifications();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializeNotifications() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';
      
      if (this.permissionGranted) {
        console.log('✅ Notification permission granted');
      } else {
        console.warn('⚠️ Notification permission denied');
      }
    } else {
      console.warn('⚠️ Browser does not support notifications');
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    this.permissionGranted = permission === 'granted';
    return this.permissionGranted;
  }

  async notify(options: NotificationOptions): Promise<void> {
    if (!this.permissionGranted) {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        tag: options.tag || 'crypto-alert',
        requireInteraction: options.requireInteraction || false,
        badge: '/icon-192.png'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  // High-risk alert with sound
  async notifyHighRisk(symbol: string, riskScore: number, summary: string): Promise<void> {
    await this.notify({
      title: `${symbol} Yüksek Risk Uyarısı`,
      body: `Risk Skoru: ${riskScore}/100\n${summary}`,
      requireInteraction: true,
      tag: `high-risk-${symbol}`
    });

    // Play alert sound if available
    this.playAlertSound();
  }

  // Critical risk alert
  async notifyCriticalRisk(symbol: string, summary: string): Promise<void> {
    await this.notify({
      title: `⛔ ${symbol} KRİTİK RİSK!`,
      body: summary,
      requireInteraction: true,
      tag: `critical-${symbol}`
    });

    this.playAlertSound();
  }

  // Moderate opportunity alert
  async notifyOpportunity(symbol: string, insight: string): Promise<void> {
    await this.notify({
      title: `💡 ${symbol} Fırsat Tespit Edildi`,
      body: insight,
      tag: `opportunity-${symbol}`
    });
  }

  private playAlertSound(): void {
    try {
      const audio = new Audio('/alert-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
      console.log('Sound playback not available');
    }
  }

  isEnabled(): boolean {
    return this.permissionGranted;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Helper function to send notifications
export async function notifyUsers(title: string, body: string, options?: Partial<NotificationOptions>): Promise<void> {
  await notificationService.notify({
    title,
    body,
    ...options
  });
}
