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
        barSpacing: 8,
        minBarSpacing: 4,
        rightOffset: 8,
        fixLeftEdge: true,
        fixRightEdge: false,
      },
      handleScale: {
        axisPressedMouseMove: false,
        pinch: true,
        mouseWheel: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
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

      const vwapData = rollingVwapData(klines, candles);
      vwapSeries.setData(vwapData);
      createSeriesMarkers(candleSeries, movementMarkers(candles, klines, vwapData));

      if (analysis) {
        const firstTime = candles[0].time;
        const lastTime = candles[candles.length - 1].time;
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
      chart.timeScale().applyOptions({
        barSpacing: 8,
        minBarSpacing: 4,
        rightOffset: 8,
      });
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
        Lightweight Charts by TradingView - VWAP / breakout markers
      </div>
    </div>
  );
};

function rollingVwapData(
  klines: Awaited<ReturnType<typeof getBinanceKlines>>,
  candles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }>,
) {
  let quote = 0;
  let base = 0;
  return klines.map((kline, index) => {
    quote += Number(kline.quoteVolume);
    base += Number(kline.volume);
    return {
      time: candles[index].time,
      value: base > 0 ? quote / base : candles[index].close,
    };
  });
}

function movementMarkers(
  candles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }>,
  klines: Awaited<ReturnType<typeof getBinanceKlines>>,
  vwapData: Array<{ time: UTCTimestamp; value: number }>,
) {
  const markers = [];
  const volumes = klines.map((kline) => Number(kline.quoteVolume));
  for (let index = 41; index < candles.length; index++) {
    const range = candles.slice(index - 40, index);
    const resistance = Math.max(...range.map((candle) => candle.high));
    const support = Math.min(...range.map((candle) => candle.low));
    const recentVolumes = volumes.slice(index - 21, index - 1);
    const volumeZ = zScore(volumes[index], recentVolumes);
    const candleRange = Math.max(candles[index].high - candles[index].low, 0.00000001);
    const bodyPct = Math.abs(candles[index].close - candles[index].open) / candleRange * 100;
    const upperWickPct = (candles[index].high - Math.max(candles[index].open, candles[index].close)) / candleRange * 100;
    const lowerWickPct = (Math.min(candles[index].open, candles[index].close) - candles[index].low) / candleRange * 100;
    const bullishCandle = candles[index].close > candles[index].open;
    const bearishCandle = candles[index].close < candles[index].open;
    const aboveVwap = candles[index].close > vwapData[index].value;
    const belowVwap = candles[index].close < vwapData[index].value;
    if (candles[index].close > resistance && aboveVwap && volumeZ > 1.5 && bodyPct > 45 && upperWickPct < 35 && bullishCandle) {
      markers.push({
        time: candles[index].time,
        position: 'belowBar' as const,
        color: '#22c55e',
        shape: 'arrowUp' as const,
        text: 'Bullish',
      });
    }
    if (candles[index].close < support && belowVwap && volumeZ > 1.5 && bodyPct > 45 && lowerWickPct < 35 && bearishCandle) {
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

function zScore(value: number, values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const variance = values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  return deviation === 0 ? 0 : (value - mean) / deviation;
}

export default RealMarketChart;
