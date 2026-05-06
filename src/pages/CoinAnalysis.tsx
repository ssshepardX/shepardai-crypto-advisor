import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CandlestickChart,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Waves,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import RealMarketChart from '@/components/RealMarketChart';
import { formatCauseLabel, formatRiskLabel } from '@/lib/labels';
import { getTop200CoinsByVolume, CoinData } from '@/services/binanceService';
import {
  AnalysisTimeframe,
  CoinAnalysisError,
  CoinAnalysis as CoinAnalysisData,
  analyzeCoin,
} from '@/services/coinAnalysisService';
import {
  getCurrentSubscription,
  getTodayUsage,
  PLAN_ENTITLEMENTS,
  UserSubscription,
  UserUsageDaily,
} from '@/services/subscriptionService';
import { Trans, useLanguage } from '@/contexts/LanguageContext';
import { getCoinSentiment, SentimentResult } from '@/services/sentimentService';

const TIMEFRAMES: AnalysisTimeframe[] = ['5m', '15m', '30m', '1h', '4h'];

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

const CoinAnalysis = () => {
  const { symbol: routeSymbol } = useParams();
  const [symbol, setSymbol] = useState((routeSymbol || 'BTCUSDT').toUpperCase());
  const [timeframe, setTimeframe] = useState<AnalysisTimeframe>('15m');
  const [analysis, setAnalysis] = useState<CoinAnalysisData | null>(null);
  const [marketCoins, setMarketCoins] = useState<CoinData[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UserUsageDaily | null>(null);
  const [coinSentiment, setCoinSentiment] = useState<SentimentResult | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCurrentSubscription(), getTodayUsage()]).then(([sub, today]) => {
      if (cancelled) return;
      setSubscription(sub);
      setUsage(today);
    });
    getTop200CoinsByVolume().then((coins) => {
      if (cancelled) return;
      const ranked = coins
        .filter((coin) => coin.symbol.endsWith('USDT'))
        .sort((a, b) => {
          const aScore = Math.abs(a.priceChangePercent) * 0.65 + Math.log10(Math.max(a.quoteVolume, 1)) * 0.35;
          const bScore = Math.abs(b.priceChangePercent) * 0.65 + Math.log10(Math.max(b.quoteVolume, 1)) * 0.35;
          return bScore - aScore;
        })
        .slice(0, 12);
      setMarketCoins(ranked);
      if (!routeSymbol && ranked[0]?.symbol) setSymbol(ranked[0].symbol);
    });
    return () => {
      cancelled = true;
    };
  }, [routeSymbol]);

  const runAnalysis = async (force = false) => {
    setIsLoading(true);
    setError(null);
    setLimitReached(false);
    try {
      const result = await analyzeCoin(symbol, timeframe, force, language);
      setAnalysis(result);
      const today = await getTodayUsage();
      setUsage(today);
    } catch (err) {
      if (err instanceof CoinAnalysisError && err.code === 'AI_LIMIT_REACHED') {
        setLimitReached(true);
        setError(`Daily limit reached (${err.used}/${err.limit}). Upgrade to continue.`);
      } else {
        setError(err instanceof Error ? err.message : 'Analysis could not be completed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const aiSummary = analysis?.ai_summary_json;
  const risk = analysis?.risk_json;
  const indicators = analysis?.indicator_json;
  const entitlement = PLAN_ENTITLEMENTS[subscription?.plan || 'free'];

  useEffect(() => {
    if (!analysis || !entitlement.canViewAdvancedRisk) {
      setCoinSentiment(null);
      return;
    }
    let cancelled = false;
    setSentimentLoading(true);
    getCoinSentiment(analysis.symbol)
      .then((data) => {
        if (!cancelled) setCoinSentiment(data.sentiment);
      })
      .catch(() => {
        if (!cancelled) setCoinSentiment(null);
      })
      .finally(() => {
        if (!cancelled) setSentimentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysis, entitlement.canViewAdvancedRisk]);

  return (
    <AppShell
      title="Movement analysis"
      subtitle="Find the likely reason behind a sudden market move."
      action={<Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><Trans text="Supervisor" /></Badge>}
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="space-y-4">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CandlestickChart className="h-4 w-4 text-cyan-400" />
                <Trans text="Analysis setup" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400"><Trans text="Pair" /></label>
                <Input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  className="border-slate-700 bg-slate-950 font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  {marketCoins.map((coin) => (
                    <Button
                      key={coin.symbol}
                      type="button"
                      size="sm"
                      variant={symbol === coin.symbol ? 'default' : 'outline'}
                      onClick={() => setSymbol(coin.symbol)}
                      className="h-7 px-2 text-xs"
                      title={`${coin.priceChangePercent.toFixed(2)}% / Vol ${Math.round(coin.quoteVolume).toLocaleString('en-US')}`}
                    >
                      {coin.symbol.replace('USDT', '')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400"><Trans text="Timeframe" /></label>
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
                  <Trans text="Analyze" />
                </Button>
                <Button onClick={() => runAnalysis(true)} disabled={isLoading} variant="outline">
                  <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
                  <Trans text="Refresh" />
                </Button>
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  <div>{error}</div>
                  {limitReached && (
                    <Button asChild size="sm" className="mt-3 bg-cyan-500 text-white hover:bg-cyan-600">
                      <Link to="/pricing">Upgrade plan</Link>
                    </Button>
                  )}
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
                <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                  <Trans text="Plan" />: <span className="text-slate-200">{subscription?.plan.toUpperCase() || 'FREE'}</span> - <Trans text="Daily analysis" />: {usage?.ai_analysis_count || 0}/{entitlement.aiDailyLimit}
                </div>
                <div className="flex flex-wrap gap-2">
                  {risk?.labels.map((label) => (
                    <Badge key={label} variant="outline" className="border-slate-700 text-slate-300">
                      {formatRiskLabel(label, language)}
                    </Badge>
                  ))}
                </div>
                  <p className="text-xs text-slate-500">
                    <Trans text={analysis.cache_hit ? 'Saved result' : analysis.ai_cache_hit ? 'Saved summary' : 'New check'} /> - {new Date(analysis.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {analysis.ai_summary_json.fallback_reason
                      ? `Deterministic summary: ${analysis.ai_summary_json.fallback_reason}`
                      : 'AI summary: active'}
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
                <Trans text="Market chart" />
              </CardTitle>
              {aiSummary && (
                <Badge className="bg-slate-800 text-slate-200">
                  <Trans text="Cause" />: {formatCauseLabel(analysis?.cause_json?.likely_cause || aiSummary.likely_cause, language)}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-[360px] rounded-lg border border-slate-800 bg-slate-950 p-3">
                <RealMarketChart symbol={symbol} timeframe={timeframe} analysis={analysis} />
              </div>
            </CardContent>
          </Card>

          {analysis && risk && indicators && aiSummary && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard icon={TrendingUp} label="Cause signal" value={analysis.cause_json?.movement_cause_score.technical_breakout ?? risk.trend_score} />
                <MetricCard icon={Activity} label="Confidence" value={analysis.cause_json?.confidence_score ?? 0} />
                <MetricCard icon={ShieldAlert} label="Manipulation risk" value={analysis.cause_json?.early_warning_score ?? risk.pump_dump_risk_score} danger />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="border-slate-800 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <Trans text="Risk and whale check" />
                    </CardTitle>
                  </CardHeader>
                  {entitlement.canViewAdvancedRisk ? (
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      <InfoLine label="Whale Risk" value={`${risk.whale_risk_score}/100`} />
                      <InfoLine label="Taker buy pressure" value={`${analysis.market_microstructure_json?.trades.buyPressurePct ?? 0}%`} />
                      <InfoLine label="Large Trades" value={String(analysis.market_microstructure_json?.trades.largeTradeCount ?? 0)} />
                      <InfoLine label="Reversal Risk" value={`${risk.reversal_risk_score}/100`} />
                      <InfoLine label="Volume Confirm" value={`${risk.volume_confirmation_score}/100`} />
                      <InfoLine label="Spread" value={`${risk.orderbook.spreadPct}%`} />
                      <InfoLine label="Orderbook" value={risk.orderbook.isThin ? 'Thin' : 'Normal'} />
                      <InfoLine label="Bid/Ask Imbalance" value={`${risk.orderbook.imbalancePct}%`} />
                    </CardContent>
                  ) : (
                    <CardContent>
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                        <Trans text="Advanced risk and whale details are available on Pro and Trader plans." />
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-slate-800 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Waves className="h-4 w-4 text-cyan-400" />
                      <Trans text="Technical summary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <InfoLine label="RSI 14" value={String(indicators.rsi14)} />
                    <InfoLine label="MACD Hist" value={String(indicators.macdHistogram)} />
                    <InfoLine label="ATR %" value={`${indicators.atrPct}%`} />
                    <InfoLine label="Volume Z" value={String(indicators.volumeZScore)} />
                    <InfoLine label="Candle Expansion" value={`${indicators.candleExpansion}x`} />
                    <InfoLine label="Support" value={formatUsd(indicators.support)} />
                    <InfoLine label="Resistance" value={formatUsd(indicators.resistance)} />
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-800 bg-slate-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-cyan-400" />
                    <Trans text="Movement cause" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs text-slate-500"><Trans text="Likely cause" /></div>
                    <div className="mt-1 text-xl font-semibold text-slate-100">{formatCauseLabel(analysis.cause_json?.likely_cause || aiSummary.likely_cause, language)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                    <InfoLine label="Organic" value={`${analysis.cause_json?.movement_cause_score.organic ?? 0}/100`} />
                    <InfoLine label="Whale" value={`${analysis.cause_json?.movement_cause_score.whale ?? 0}/100`} />
                    <InfoLine label="Fraud/Pump" value={`${analysis.cause_json?.movement_cause_score.fraud_pump ?? 0}/100`} />
                    <InfoLine label="News/Social" value={`${analysis.cause_json?.movement_cause_score.news_social ?? 0}/100`} />
                    <InfoLine label="Low Liquidity" value={`${analysis.cause_json?.movement_cause_score.low_liquidity ?? 0}/100`} />
                    <InfoLine label="Technical support" value={`${analysis.cause_json?.movement_cause_score.technical_breakout ?? 0}/100`} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Waves className="h-4 w-4 text-emerald-400" />
                    <Trans text="News/Social Sentiment" />
                  </CardTitle>
                </CardHeader>
                {entitlement.canViewAdvancedRisk ? (
                  <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <InfoLine label="Mood" value={sentimentLoading ? 'Loading' : `${coinSentiment?.score_json.sentiment_label || 'neutral'} (${coinSentiment?.score_json.sentiment_score ?? analysis.news_json?.sentiment_score ?? 50}/100)`} />
                    <InfoLine label="Mentions" value={`${coinSentiment?.score_json.mention_score ?? analysis.social_json?.mention_delta ?? 0}/100`} />
                    <InfoLine label="Sources" value={String(coinSentiment?.score_json.source_count ?? analysis.news_json?.source_count ?? 0)} />
                    <InfoLine label="Asia Watch" value={`${coinSentiment?.trend_json.asia_watch_score ?? 0}/100`} />
                    <InfoLine label="Reddit Heat" value={`${coinSentiment?.trend_json.reddit_heat ?? 0}/100`} />
                    <InfoLine label="Source Confidence" value={`${coinSentiment?.score_json.source_confidence ?? analysis.news_json?.confidence ?? 0}/100`} />
                    <InfoLine label="News Mood" value={`${coinSentiment?.trend_json.news_mood ?? analysis.news_json?.sentiment_score ?? 50}/100`} />
                    <InfoLine label="Trend" value={coinSentiment?.trend_json.trend_direction || 'flat'} />
                    {coinSentiment?.trend_json.reason_short && (
                      <div className="col-span-2 rounded-md border border-slate-800 bg-slate-950 p-3 md:col-span-4">
                        <div className="text-xs text-slate-500"><Trans text="Reason" /></div>
                        <div className="mt-1 text-sm text-slate-300">{coinSentiment.trend_json.reason_short}</div>
                      </div>
                    )}
                    <div className="col-span-2 rounded-md border border-slate-800 bg-slate-950 p-3 md:col-span-4">
                      <div className="text-xs text-slate-500"><Trans text="Catalyst terms" /></div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[...(coinSentiment?.source_json.top_catalyst_terms || []), ...(analysis.news_json?.top_catalyst_terms || []), ...(analysis.social_json?.top_catalyst_terms || [])].slice(0, 8).map((term) => (
                          <Badge key={term} variant="outline" className="border-slate-700 text-slate-300">{term}</Badge>
                        ))}
                        {!(coinSentiment?.source_json.top_catalyst_terms?.length || analysis.news_json?.top_catalyst_terms?.length || analysis.social_json?.top_catalyst_terms?.length) && (
                          <span className="text-sm text-slate-500"><Trans text="No catalyst term found yet." /></span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent>
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                      <Trans text="News and social details are available on Pro and Trader plans." />
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="border-cyan-500/20 bg-cyan-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="h-4 w-4 text-cyan-300" />
                    <Trans text="Summary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-lg leading-relaxed text-slate-100">{aiSummary.catalyst_summary_tr || aiSummary.summary_tr}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn('bg-slate-800', scoreColor(aiSummary.whale_probability ?? analysis.cause_json?.movement_cause_score.whale ?? 0))}>
                      <Trans text="Whale trace" />: {aiSummary.whale_probability ?? analysis.cause_json?.movement_cause_score.whale ?? 0}%
                    </Badge>
                    <Badge className="bg-slate-800"><Trans text="Manipulation" />: {aiSummary.manipulation_risk || aiSummary.risk_level}</Badge>
                    <Badge className="bg-slate-800"><Trans text="Confidence" />: {aiSummary.confidence ?? analysis.cause_json?.confidence_score ?? 0}/100</Badge>
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
      </div>
    </AppShell>
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
        <p className="text-sm text-slate-400"><Trans text={label} /></p>
        <p className={cn('text-3xl font-bold', danger ? scoreColor(value) : 'text-cyan-300')}>{value}</p>
      </div>
      <Icon className="h-8 w-8 text-slate-600" />
    </CardContent>
  </Card>
);

const InfoLine = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
    <div className="text-xs text-slate-500"><Trans text={label} /></div>
    <div className="font-mono text-slate-200">{value}</div>
  </div>
);

export default CoinAnalysis;
