// Binance API Service for Market Data and Pump Detection

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

export interface CoinData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
}

// Get top 200 coins by volume from Binance
export async function getTop200CoinsByVolume(): Promise<CoinData[]> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter USDT pairs and sort by quote volume
    interface BinanceTicker {
      symbol: string;
      lastPrice: string;
      priceChange: string;
      priceChangePercent: string;
      volume: string;
      quoteVolume: string;
    }
    
    const usdtPairs = data
      .filter((ticker: BinanceTicker) => ticker.symbol.endsWith('USDT'))
      .map((ticker: BinanceTicker) => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
        priceChange: parseFloat(ticker.priceChange),
        priceChangePercent: parseFloat(ticker.priceChangePercent),
        volume: parseFloat(ticker.volume),
        quoteVolume: parseFloat(ticker.quoteVolume)
      }))
      .sort((a: CoinData, b: CoinData) => b.quoteVolume - a.quoteVolume)
      .slice(0, 200);
    
    return usdtPairs;
  } catch (error) {
    console.error('Error fetching top coins:', error);
    return [];
  }
}

// Get klines (candlestick data) for a specific symbol
export async function getBinanceKlines(
  symbol: string, 
  interval: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' = '1m',
  limit: number = 100
): Promise<BinanceKline[]> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to fetch klines for ${symbol}: ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    
    return data.map((kline: [number, string, string, string, string, string, number, string, number, string, string]) => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteVolume: kline[7],
      trades: kline[8],
      takerBuyBaseVolume: kline[9],
      takerBuyQuoteVolume: kline[10]
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    return [];
  }
}

// Calculate average volume from klines
export function calculateAverageVolume(klines: BinanceKline[], period: number = 20): number {
  if (klines.length < period) {
    return 0;
  }
  
  const recentKlines = klines.slice(-period - 1, -1); // Exclude last candle
  const totalVolume = recentKlines.reduce(
    (sum, kline) => sum + parseFloat(kline.quoteVolume), 
    0
  );
  
  return totalVolume / period;
}

// Calculate price change percentage
export function calculatePriceChange(klines: BinanceKline[]): number {
  if (klines.length < 2) {
    return 0;
  }
  
  const lastKline = klines[klines.length - 1];
  const openPrice = parseFloat(lastKline.open);
  const closePrice = parseFloat(lastKline.close);
  
  return ((closePrice - openPrice) / openPrice) * 100;
}

// Detect pump conditions
export interface PumpDetectionResult {
  isPump: boolean;
  symbol: string;
  price: number;
  priceChange: number;
  volume: number;
  avgVolume: number;
  volumeMultiplier: number;
}

export async function detectPump(
  symbol: string, 
  volumeMultiplierThreshold: number = 2.5,
  priceChangeThreshold: number = 3.0
): Promise<PumpDetectionResult | null> {
  try {
    const klines = await getBinanceKlines(symbol, '1m', 30);
    
    if (klines.length < 21) {
      return null;
    }
    
    const lastKline = klines[klines.length - 1];
    const currentVolume = parseFloat(lastKline.quoteVolume);
    const avgVolume = calculateAverageVolume(klines, 20);
    const priceChange = calculatePriceChange(klines);
    const volumeMultiplier = avgVolume > 0 ? currentVolume / avgVolume : 0;
    
    const isPump = 
      priceChange > priceChangeThreshold && 
      volumeMultiplier > volumeMultiplierThreshold;
    
    return {
      isPump,
      symbol,
      price: parseFloat(lastKline.close),
      priceChange,
      volume: currentVolume,
      avgVolume,
      volumeMultiplier
    };
  } catch (error) {
    console.error(`Error detecting pump for ${symbol}:`, error);
    return null;
  }
}

// Batch process multiple coins for pump detection
export async function scanCoinsForPumps(
  coins: string[],
  volumeMultiplierThreshold: number = 2.5,
  priceChangeThreshold: number = 3.0,
  delayMs: number = 300
): Promise<PumpDetectionResult[]> {
  const results: PumpDetectionResult[] = [];
  
  for (const coin of coins) {
    const result = await detectPump(coin, volumeMultiplierThreshold, priceChangeThreshold);
    
    if (result && result.isPump) {
      results.push(result);
      console.log(`Pump detected: ${coin} +${result.priceChange.toFixed(2)}% Vol: ${result.volumeMultiplier.toFixed(2)}x`);
    }
    
    // Add delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return results;
}
