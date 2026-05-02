import React from 'react';
import { useBinanceData } from '@/hooks/useBinanceData';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, ArrowDown } from 'lucide-react';

const TOP_COINS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

const TickerItem = ({ symbol, price, change }: { symbol: string; price: string; change: number }) => {
  const isPositive = change >= 0;
  return (
    <div className="flex items-center space-x-2 mx-4 flex-shrink-0">
      <span className="text-sm font-medium text-muted-foreground">{symbol.replace('USDT', '')}</span>
      <span className="text-sm font-bold">${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className={`flex items-center text-xs font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {change.toFixed(2)}%
      </span>
    </div>
  );
};

const LivePriceTicker = () => {
  const { data, isLoading } = useBinanceData();

  const tickerData = data
    ? TOP_COINS.map(coinSymbol => data.find(d => d.symbol === coinSymbol)).filter(Boolean)
    : [];

  if (isLoading) {
    return (
      <div className="py-2 border-y border-white/10 overflow-hidden">
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  return (
    <div className="py-3 border-y border-white/10 overflow-hidden relative bg-background/50 backdrop-blur-sm">
      <div className="flex animate-marquee whitespace-nowrap">
        {tickerData.map(item => (
          <TickerItem key={item!.symbol} symbol={item!.symbol} price={item!.lastPrice} change={parseFloat(item!.priceChangePercent)} />
        ))}
        {/* Duplicate for smooth animation */}
        {tickerData.map(item => (
          <TickerItem key={`${item!.symbol}-clone`} symbol={item!.symbol} price={item!.lastPrice} change={parseFloat(item!.priceChangePercent)} />
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LivePriceTicker;
