// Market Watcher Hook - Real-time pump detection and monitoring

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTop200CoinsByVolume, scanCoinsForPumps, PumpDetectionResult } from '@/services/binanceService';
import { analyzePumpWithAI, PumpAnalysisInput, AIAnalysisResult } from '@/services/aiService';
import { useToast } from '@/hooks/use-toast';

export interface PumpAlert {
  id: string;
  symbol: string;
  type: string;
  price: number;
  priceChange: number;
  volume: number;
  avgVolume: number;
  volumeMultiplier: number;
  detectedAt: string;
  aiComment?: AIAnalysisResult;
  aiFetchedAt?: string;
  marketState?: string;
  organicProbability?: number;
  whaleMovement: boolean;
  riskAnalysis?: string;
}

export interface MarketWatcherConfig {
  enabled: boolean;
  interval: number; // seconds
  volumeMultiplierThreshold: number;
  priceChangeThreshold: number;
  aiEnabled: boolean;
  maxCoins: number;
}

const DEFAULT_CONFIG: MarketWatcherConfig = {
  enabled: true,
  interval: 60, // 1 minute
  volumeMultiplierThreshold: 2.5,
  priceChangeThreshold: 3.0,
  aiEnabled: true,
  maxCoins: 200
};

declare global {
  interface Window {
    marketWatcherInterval?: ReturnType<typeof setInterval>;
  }
}

export const useMarketWatcher = (config: Partial<MarketWatcherConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [isWatching, setIsWatching] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [pumpAlerts, setPumpAlerts] = useState<PumpAlert[]>([]);
  const [topCoins, setTopCoins] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch top coins on mount
  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        const coins = await getTop200CoinsByVolume();
        const symbols = coins.slice(0, finalConfig.maxCoins).map(coin => coin.symbol);
        setTopCoins(symbols);
        console.log(`Loaded ${symbols.length} top coins for monitoring`);
      } catch (error) {
        console.error('Failed to fetch top coins:', error);
        toast({
          title: "Error",
          description: "Failed to load market data. Please check your connection.",
          variant: "destructive",
        });
      }
    };

    fetchTopCoins();
  }, [finalConfig.maxCoins, toast]);

  // Save pump alert to database
  const savePumpAlert = useCallback(async (pumpResult: PumpDetectionResult): Promise<PumpAlert | null> => {
    try {
      const { data, error } = await supabase
        .from('pump_alerts')
        .insert({
          symbol: pumpResult.symbol,
          type: 'PUMP_ALERT',
          price: pumpResult.price,
          price_change: pumpResult.priceChange,
          volume: pumpResult.volume,
          avg_volume: pumpResult.avgVolume,
          volume_multiplier: pumpResult.volumeMultiplier,
          detected_at: new Date().toISOString(),
          market_state: 'bear_market', // You can make this dynamic
          whale_movement: pumpResult.volumeMultiplier > 4.0 // Simple heuristic
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving pump alert:', error);
        return null;
      }

      return data as PumpAlert;
    } catch (error) {
      console.error('Failed to save pump alert:', error);
      return null;
    }
  }, []);

  // Get AI analysis for pump alert
  const getAIAnalysis = useCallback(async (pumpResult: PumpDetectionResult): Promise<AIAnalysisResult | null> => {
    if (!finalConfig.aiEnabled) return null;

    try {
      const aiInput: PumpAnalysisInput = {
        symbol: pumpResult.symbol,
        price: pumpResult.price,
        priceChange: pumpResult.priceChange,
        volume: pumpResult.volume,
        avgVolume: pumpResult.avgVolume,
        volumeMultiplier: pumpResult.volumeMultiplier
      };

      const analysis = await analyzePumpWithAI(aiInput);

      // Update the alert with AI analysis
      await supabase
        .from('pump_alerts')
        .update({
          ai_comment: analysis,
          ai_fetched_at: new Date().toISOString(),
          organic_probability: analysis.isOrganic ? 80 : 20,
          risk_analysis: analysis.riskAnalysis
        })
        .eq('symbol', pumpResult.symbol)
        .order('detected_at', { ascending: false })
        .limit(1);

      return analysis;
    } catch (error) {
      console.error('Failed to get AI analysis:', error);
      return null;
    }
  }, [finalConfig.aiEnabled]);

  // Send push notification
  const sendNotification = useCallback((pumpResult: PumpDetectionResult, aiAnalysis?: AIAnalysisResult) => {
    const title = `🚨 PUMP ALERT: ${pumpResult.symbol}`;
    const body = `${pumpResult.symbol} +${pumpResult.priceChange.toFixed(2)}% (${pumpResult.volumeMultiplier.toFixed(1)}x volume)`;

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `pump-${pumpResult.symbol}`
      });
    }

    // Toast notification
    toast({
      title,
      description: body,
      duration: 10000,
    });

    console.log(`🔔 Notification sent for ${pumpResult.symbol}`);
  }, [toast]);

  // Main scanning function
  const scanForPumps = useCallback(async () => {
    if (!finalConfig.enabled || topCoins.length === 0) return;

    try {
      console.log(`🔍 Scanning ${topCoins.length} coins for pumps...`);

      const pumpResults = await scanCoinsForPumps(
        topCoins,
        finalConfig.volumeMultiplierThreshold,
        finalConfig.priceChangeThreshold,
        200 // 200ms delay between requests
      );

      if (pumpResults.length > 0) {
        console.log(`🚨 Found ${pumpResults.length} pump(s)!`);

        for (const pumpResult of pumpResults) {
          // Save to database
          const savedAlert = await savePumpAlert(pumpResult);
          if (!savedAlert) continue;

          // Get AI analysis
          const aiAnalysis = await getAIAnalysis(pumpResult);

          // Update local state
          const alertWithAI: PumpAlert = {
            ...savedAlert,
            aiComment: aiAnalysis || undefined,
            whaleMovement: pumpResult.volumeMultiplier > 4.0
          };

          setPumpAlerts(prev => [alertWithAI, ...prev.slice(0, 49)]); // Keep last 50 alerts

          // Send notification
          sendNotification(pumpResult, aiAnalysis || undefined);
        }
      }

      setLastScan(new Date());
    } catch (error) {
      console.error('Error during pump scan:', error);
      toast({
        title: "Scan Error",
        description: "Failed to scan market for pumps. Check console for details.",
        variant: "destructive",
      });
    }
  }, [
    finalConfig.enabled,
    finalConfig.volumeMultiplierThreshold,
    finalConfig.priceChangeThreshold,
    topCoins,
    savePumpAlert,
    getAIAnalysis,
    sendNotification,
    toast
  ]);

  // Start/stop watching
  const startWatching = useCallback(() => {
    if (isWatching) return;

    setIsWatching(true);
    console.log('👀 Market watcher started');

    // Initial scan
    scanForPumps();

    // Set up interval
    const intervalId = setInterval(scanForPumps, finalConfig.interval * 1000);

    // Store interval ID for cleanup
    window.marketWatcherInterval = intervalId;
  }, [isWatching, scanForPumps, finalConfig.interval]);

  const stopWatching = useCallback(() => {
    if (!isWatching) return;

    setIsWatching(false);
    console.log('⏹️ Market watcher stopped');

    if (window.marketWatcherInterval) {
      clearInterval(window.marketWatcherInterval);
      delete window.marketWatcherInterval;
    }
  }, [isWatching]);

  // Load existing alerts on mount
  useEffect(() => {
    const loadExistingAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('pump_alerts')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error loading existing alerts:', error);
          return;
        }

        const alerts: PumpAlert[] = data.map(alert => ({
          id: alert.id,
          symbol: alert.symbol,
          type: alert.type,
          price: parseFloat(alert.price),
          priceChange: parseFloat(alert.price_change),
          volume: parseFloat(alert.volume),
          avgVolume: parseFloat(alert.avg_volume),
          volumeMultiplier: parseFloat(alert.volume_multiplier),
          detectedAt: alert.detected_at,
          aiComment: alert.ai_comment,
          aiFetchedAt: alert.ai_fetched_at,
          marketState: alert.market_state,
          organicProbability: alert.organic_probability,
          whaleMovement: alert.whale_movement || false,
          riskAnalysis: alert.risk_analysis
        }));

        setPumpAlerts(alerts);
      } catch (error) {
        console.error('Failed to load existing alerts:', error);
      }
    };

    loadExistingAlerts();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.marketWatcherInterval) {
        clearInterval(window.marketWatcherInterval);
      }
    };
  }, []);

  return {
    isWatching,
    lastScan,
    pumpAlerts,
    topCoins,
    startWatching,
    stopWatching,
    scanForPumps,
    config: finalConfig
  };
};
