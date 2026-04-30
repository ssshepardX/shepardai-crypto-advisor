import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  CandlestickChart,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AnalysisTimeframe,
  CoinAnalysis as CoinAnalysisData,
  analyzeCoin,
} from '@/services/coinAnalysisService';

const TIMEFRAMES: AnalysisTimeframe[] = ['5m', '15m', '30m', '1h', '4h'];

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

const scoreColor = (score: number) => {
  if (score >= 75) return 'text-rose-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-emerald-400';
};

const formatUsd = (value: number) => (
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value > 10 ? 2 : 6,
  })
);

const buildSyntheticChart = (analysis: CoinAnalysisData | null) => {
  if (!analysis) return [];
  const indicator = analysis.indicator_json;
  const price = Number(analysis.price);
  const support = Number(indicator.support || price * 0.98);
  const resistance = Number(indicator.resistance || price * 1.02);
  const trendLift = (analysis.risk_json.trend_score - 50) / 1000;

  return Array.from({ length: 28 }).map((_, index) => {
    const progress = index / 27;
    const wave = Math.sin(index / 2.2) * price * 0.003;
    const drift = price * trendLift * (progress - 0.5);
    return {
      label: `${index + 1}`,
      price: Number((support + (resistance - support) * progress + wave + drift).toFixed(6)),
      vwap: indicator.vwap,
      support,
      resistance,
    };
  });
};

const CoinAnalysis = () => {
  const { symbol: routeSymbol } = useParams();
  const [symbol, setSymbol] = useState((routeSymbol || 'BTCUSDT').toUpperCase());
  const [timeframe, setTimeframe] = useState<AnalysisTimeframe>('15m');
  const [analysis, setAnalysis] = useState<CoinAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chartData = useMemo(() => buildSyntheticChart(analysis), [analysis]);

  const runAnalysis = async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeCoin(symbol, timeframe, force);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analiz calistirilamadi');
    } finally {
      setIsLoading(false);
    }
  };

  const aiSummary = analysis?.ai_summary_json;
  const risk = analysis?.risk_json;
  const indicators = analysis?.indicator_json;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="border-slate-700 bg-slate-900">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Coin Analiz Terminali</h1>
              <p className="text-sm text-slate-400">Teknik skor, whale riski ve dusuk tokenli AI yorumu</p>
            </div>
          </div>
          <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            Gemini yalnizca ozet icin kullanilir
          </Badge>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[320px_1fr]">
        <section className="space-y-4">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CandlestickChart className="h-4 w-4 text-cyan-400" />
                Analiz Secimi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Sembol</label>
                <Input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  className="border-slate-700 bg-slate-950 font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_SYMBOLS.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      variant={symbol === item ? 'default' : 'outline'}
                      onClick={() => setSymbol(item)}
                      className="h-7 px-2 text-xs"
                    >
                      {item.replace('USDT', '')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Zaman araligi</label>
                <div className="grid grid-cols-5 gap-2">
                  {TIMEFRAMES.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      variant={timeframe === item ? 'default' : 'outline'}
                      onClick={() => setTimeframe(item)}
                      className="h-8 px-0"
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => runAnalysis(false)} disabled={isLoading}>
                  <Brain className="mr-2 h-4 w-4" />
                  AI Yorumu Al
                </Button>
                <Button onClick={() => runAnalysis(true)} disabled={isLoading} variant="outline">
                  <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
                  Tazele
                </Button>
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {analysis && (
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="text-base">{analysis.symbol} / {analysis.timeframe}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold">{formatUsd(Number(analysis.price))}</div>
                <div className="flex flex-wrap gap-2">
                  {risk?.labels.map((label) => (
                    <Badge key={label} variant="outline" className="border-slate-700 text-slate-300">
                      {label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {analysis.cache_hit ? 'Cache kullanildi' : 'Yeni analiz olusturuldu'} - {new Date(analysis.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-4">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                TradingView Tarzi Piyasa Paneli
              </CardTitle>
              {aiSummary && (
                <Badge className="bg-slate-800 text-slate-200">
                  Bias: {aiSummary.direction_bias}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-[360px] rounded-lg border border-slate-800 bg-slate-950 p-3">
                {analysis ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['dataMin', 'dataMax']} />
                      <Tooltip
                        contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#e2e8f0' }}
                      />
                      <Area type="monotone" dataKey="price" stroke="#22d3ee" fill="url(#priceGradient)" strokeWidth={2} />
                      <Area type="monotone" dataKey="vwap" stroke="#a78bfa" fill="transparent" strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                    <CandlestickChart className="mb-3 h-10 w-10" />
                    <p>Bir coin ve zaman araligi secip analiz baslat.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {analysis && risk && indicators && aiSummary && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard icon={TrendingUp} label="Trend" value={risk.trend_score} />
                <MetricCard icon={Activity} label="Momentum" value={risk.momentum_score} />
                <MetricCard icon={ShieldAlert} label="Pump/Dump Riski" value={risk.pump_dump_risk_score} danger />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="border-slate-800 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Risk ve Whale Kontrolu
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <InfoLine label="Whale Risk" value={`${risk.whale_risk_score}/100`} />
                    <InfoLine label="Reversal Risk" value={`${risk.reversal_risk_score}/100`} />
                    <InfoLine label="Volume Confirm" value={`${risk.volume_confirmation_score}/100`} />
                    <InfoLine label="Spread" value={`${risk.orderbook.spreadPct}%`} />
                    <InfoLine label="Orderbook" value={risk.orderbook.isThin ? 'Thin' : 'Normal'} />
                    <InfoLine label="Bid/Ask Imbalance" value={`${risk.orderbook.imbalancePct}%`} />
                  </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Waves className="h-4 w-4 text-cyan-400" />
                      Teknik Ozet
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <InfoLine label="RSI 14" value={String(indicators.rsi14)} />
                    <InfoLine label="MACD Hist" value={String(indicators.macdHistogram)} />
                    <InfoLine label="ATR %" value={`${indicators.atrPct}%`} />
                    <InfoLine label="Volume Spike" value={`${indicators.volumeMultiplier}x`} />
                    <InfoLine label="Support" value={formatUsd(indicators.support)} />
                    <InfoLine label="Resistance" value={formatUsd(indicators.resistance)} />
                  </CardContent>
                </Card>
              </div>

              <Card className="border-cyan-500/20 bg-cyan-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4 text-cyan-300" />
                    Gemini 2.5 Flash Yorumu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-lg leading-relaxed text-slate-100">{aiSummary.summary_tr}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn('bg-slate-800', scoreColor(aiSummary.continuation_probability))}>
                      Devam ihtimali: {aiSummary.continuation_probability}%
                    </Badge>
                    <Badge className="bg-slate-800">Risk: {aiSummary.risk_level}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {aiSummary.watch_points.map((point) => (
                      <div key={point} className="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                        {point}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{aiSummary.not_advice_notice}</p>
                </CardContent>
              </Card>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  danger?: boolean;
}) => (
  <Card className="border-slate-800 bg-slate-900">
    <CardContent className="flex items-center justify-between p-5">
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className={cn('text-3xl font-bold', danger ? scoreColor(value) : 'text-cyan-300')}>{value}</p>
      </div>
      <Icon className="h-8 w-8 text-slate-600" />
    </CardContent>
  </Card>
);

const InfoLine = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="font-mono text-slate-200">{value}</div>
  </div>
);

export default CoinAnalysis;
