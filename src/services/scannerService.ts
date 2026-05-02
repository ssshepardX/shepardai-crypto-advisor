import { supabase } from '@/integrations/supabase/client';

export interface ScanData {
  id: string;
  symbol: string;
  risk_score: number;
  summary: string;
  likely_source?: string;
  actionable_insight?: string;
  created_at: string;
}

export interface ScannerResponse {
  scans: ScanData[];
  totalScans: number;
  lastUpdate: string;
}

export interface ScanStatus {
  isActive: boolean;
  lastScanTime: string | null;
  totalScans: number;
}

// Fetch scan results from Supabase Edge Function
export async function getScanResults(): Promise<ScannerResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('scanner', {
      method: 'GET'
    });

    if (error) {
      console.error('Scanner API error:', error);
      return { scans: [], totalScans: 0, lastUpdate: new Date().toISOString() };
    }

    return data as ScannerResponse;
  } catch (error) {
    console.error('Failed to fetch scan results:', error);
    return { scans: [], totalScans: 0, lastUpdate: new Date().toISOString() };
  }
}

// Trigger a manual scan (for development/testing)
export async function triggerManualScan(): Promise<{ message: string; status: 'success' | 'error' }> {
  try {
    console.log('Triggering manual scan...');

    const { data, error } = await supabase.functions.invoke('scanner', {
      method: 'POST'
    });

    if (error) {
      console.error('Manual scan trigger error:', error);
      return { message: error.message || 'Unknown error', status: 'error' };
    }

    console.log('✅ Manual scan completed:', data);
    return {
      message: data?.message || 'Scan completed successfully',
      status: 'success'
    };
  } catch (error) {
    console.error('Manual scan failed:', error);
    return {
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    };
  }
}

// Get scanner status
export async function getScannerStatus(): Promise<ScanStatus> {
  try {
    const { data, error } = await supabase.functions.invoke('scanner');

    if (error) {
      return {
        isActive: false,
        lastScanTime: null,
        totalScans: 0
      };
    }

    return {
      isActive: true,
      lastScanTime: data?.lastUpdate || null,
      totalScans: data?.totalScans || 0
    };
  } catch (error) {
    return {
      isActive: false,
      lastScanTime: null,
      totalScans: 0
    };
  }
}

// Transform scan data for ScanningCard component
export function transformScanForCard(scan: ScanData) {
  return {
    symbol: scan.symbol,
    time: scan.created_at,
    risk_score: scan.risk_score,
    price_change: 0, // Placeholder - need to add proper tracking
    volume_spike: 1, // Placeholder - need to add proper tracking
    summary: scan.summary
  };
}
