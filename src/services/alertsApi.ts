// Frontend service for consuming the alerts API endpoint
import { supabase } from '@/integrations/supabase/client';

export interface AlertData {
  id: string;
  symbol: string;
  price_at_detection: number;
  price_change: number;
  volume_spike: number;
  risk_score: number;
  created_at: string;
  completed_at: string | null;
  // AI fields - may be null based on subscription
  summary?: string | null;
  likely_source?: string | null;
  actionable_insight?: string | null;
}

export interface SubscriptionFeatures {
  plan: string;
  active: boolean;
  features: {
    realTimeAlerts: boolean;
    aiQualitativeFields: boolean;
    canRunScanner: boolean;
    canViewAdvancedRisk: boolean;
    aiDailyLimit: number;
    timeDelayMinutes: number;
  };
}

export interface AlertsResponse {
  alerts: AlertData[];
  subscription: SubscriptionFeatures;
  timestamp: string;
}

/**
 * Fetch alerts from the protected API endpoint
 * The endpoint automatically applies subscription-based filtering
 */
export async function getAlerts(): Promise<AlertsResponse> {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('User not authenticated');
    }

    // Call the Edge Function with authorization header
    const { data, error } = await supabase.functions.invoke('alerts', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      }
    });

    if (error) {
      throw new Error(`API error: ${error.message}`);
    }

    return data as AlertsResponse;

  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw error;
  }
}

/**
 * Get user's subscription information only
 */
export async function getSubscriptionInfo(): Promise<SubscriptionFeatures> {
  try {
    const response = await getAlerts();
    return response.subscription;
  } catch (error) {
    console.error('Error fetching subscription info:', error);
    throw error;
  }
}

/**
 * Check if user has access to real-time alerts
 */
export async function hasRealTimeAccess(): Promise<boolean> {
  try {
    const subscription = await getSubscriptionInfo();
    return subscription.features.realTimeAlerts;
  } catch (error) {
    console.error('Error checking real-time access:', error);
    return false;
  }
}

/**
 * Check if user has access to AI qualitative fields
 */
export async function hasAIAccess(): Promise<boolean> {
  try {
    const subscription = await getSubscriptionInfo();
    return subscription.features.aiQualitativeFields;
  } catch (error) {
    console.error('Error checking AI access:', error);
    return false;
  }
}

/**
 * Example usage with error handling
 */
export async function loadAlertsWithFallback(): Promise<{
  alerts: AlertData[];
  subscription: SubscriptionFeatures;
  isLoading: boolean;
  error: string | null;
}> {
  try {
    const data = await getAlerts();
    return {
      alerts: data.alerts,
      subscription: data.subscription,
      isLoading: false,
      error: null
    };
  } catch (error) {
    return {
      alerts: [],
      subscription: {
        plan: 'free',
        active: true,
        features: {
          realTimeAlerts: false,
          aiQualitativeFields: false,
          canRunScanner: false,
          canViewAdvancedRisk: false,
          aiDailyLimit: 3,
          timeDelayMinutes: 15
        }
      },
      isLoading: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
