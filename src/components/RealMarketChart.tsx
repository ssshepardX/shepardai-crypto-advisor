import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
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

    const emaFastSeries = chart.addSeries(LineSeries, {
      color: '#a78bfa',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const emaSlowSeries = chart.addSeries(LineSeries, {
      color: '#facc15',
      lineWidth: 1,
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

      const closes = klines.map((kline) => Number(kline.close));
      const emaFast = ema(closes, 9);
      const emaSlow = ema(closes, 21);
      const rsiValues = rsi(closes, 14);
      emaFastSeries.setData(emaFast.map((value, index) => ({
        time: candles[index].time,
        value,
      })).filter((item) => Number.isFinite(item.value)));
      emaSlowSeries.setData(emaSlow.map((value, index) => ({
        time: candles[index].time,
        value,
      })).filter((item) => Number.isFinite(item.value)));

      createSeriesMarkers(candleSeries, quantNomadStyleMarkers(candles, emaFast, emaSlow, rsiValues));

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
      chart.timeScale().scrollToPosition(4, false);
      setStatus('ready');
    };

    load();

    return () => {
      disposed = true;
      chart.remove();
    };
  }, [symbol, timeframe, analysis]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-md">
      <div ref={containerRef} className="h-full min-h-0 w-full" />
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
        Lightweight Charts by TradingView - QN-style EMA/RSI markers
      </div>
    </div>
  );
};

function ema(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  return values.reduce<number[]>((series, value, index) => {
    if (index === 0) return [value];
    series.push(value * multiplier + series[index - 1] * (1 - multiplier));
    return series;
  }, []);
}

function rsi(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = index - period + 1; i <= index; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  });
}

function quantNomadStyleMarkers(
  candles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }>,
  emaFast: number[],
  emaSlow: number[],
  rsiValues: number[],
) {
  const markers = [];
  for (let index = 2; index < candles.length; index++) {
    const crossedUp = emaFast[index - 1] <= emaSlow[index - 1] && emaFast[index] > emaSlow[index];
    const crossedDown = emaFast[index - 1] >= emaSlow[index - 1] && emaFast[index] < emaSlow[index];
    const bullishCandle = candles[index].close > candles[index].open;
    const bearishCandle = candles[index].close < candles[index].open;
    if (crossedUp && rsiValues[index] >= 50 && bullishCandle) {
      markers.push({
        time: candles[index].time,
        position: 'belowBar' as const,
        color: '#22c55e',
        shape: 'arrowUp' as const,
        text: 'Bullish',
      });
    }
    if (crossedDown && rsiValues[index] <= 50 && bearishCandle) {
      markers.push({
        time: candles[index].time,
        position: 'aboveBar' as const,
        color: '#ef4444',
        shape: 'arrowDown' as const,
        text: 'Bearish',
      });
    }
  }
  return markers.slice(-40);
}

export default RealMarketChart;
