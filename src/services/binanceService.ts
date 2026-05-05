// Binance API Service — used by RealMarketChart, CoinAnalysis, LivePriceTicker, TrendingCoins

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
