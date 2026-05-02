import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  UTCTimestamp,
} from 'lightweight-charts';
import { getBinanceKlines } from '@/services/binanceService';
import { AnalysisTimeframe, CoinAnalysis } from '@/services/coinAnalysisService';

type RealMarketChartProps = {
  symbol: string;
  timeframe: AnalysisTimeframe;
  analysis: CoinAnalysis | null;
};

const RealMarketChart = ({ symbol, timeframe, analysis }: RealMarketChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    const container = containerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#94a3b8',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#0f172a' },
        horzLines: { color: '#0f172a' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: '#334155',
    });
    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    const vwapSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const supportSeries = chart.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const resistanceSeries = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const load = async () => {
      setStatus('loading');
      const klines = await getBinanceKlines(symbol, timeframe, 240);
      if (disposed) return;

      if (!klines.length) {
        setStatus('error');
        return;
      }

      const candles = klines.map((kline) => ({
        time: Math.floor(kline.openTime / 1000) as UTCTimestamp,
        open: Number(kline.open),
        high: Number(kline.high),
        low: Number(kline.low),
        close: Number(kline.close),
      }));
      const volumes = klines.map((kline) => {
        const isUp = Number(kline.close) >= Number(kline.open);
        return {
          time: Math.floor(kline.openTime / 1000) as UTCTimestamp,
          value: Number(kline.quoteVolume),
          color: isUp ? 'rgba(34,197,94,0.32)' : 'rgba(239,68,68,0.32)',
        };
      });

      candleSeries.setData(candles);
      volumeSeries.setData(volumes);

      if (analysis) {
        const firstTime = candles[0].time;
        const lastTime = candles[candles.length - 1].time;
        vwapSeries.setData([
          { time: firstTime, value: analysis.indicator_json.vwap },
          { time: lastTime, value: analysis.indicator_json.vwap },
        ]);
        supportSeries.setData([
          { time: firstTime, value: analysis.indicator_json.support },
          { time: lastTime, value: analysis.indicator_json.support },
        ]);
        resistanceSeries.setData([
          { time: firstTime, value: analysis.indicator_json.resistance },
          { time: lastTime, value: analysis.indicator_json.resistance },
        ]);
      }

      chart.timeScale().fitContent();
      setStatus('ready');
    };

    load();

    return () => {
      disposed = true;
      chart.remove();
    };
  }, [symbol, timeframe, analysis]);

  return (
    <div className="relative h-full min-h-[360px]">
      <div ref={containerRef} className="h-full min-h-[360px] w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-400">
          Market verisi yukleniyor
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-rose-300">
          Chart verisi alinamadi
        </div>
      )}
      <div className="absolute bottom-2 right-3 text-[10px] text-slate-600">
        Lightweight Charts by TradingView
      </div>
    </div>
  );
};

export default RealMarketChart;
