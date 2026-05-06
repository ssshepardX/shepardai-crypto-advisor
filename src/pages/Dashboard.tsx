import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Brain, Clock, Flame, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import AppShell from '@/components/AppShell';
import ScanningCard from '@/components/ScanningCard';
import { AlertData, getAlerts } from '@/services/alertsApi';
import { CoinAnalysis, CoinAnalysisError, getRecentAnalyses, scanMarket } from '@/services/coinAnalysisService';
import {
  getCurrentSubscription,
  getTodayUsage,
  PLAN_ENTITLEMENTS,
  UserSubscription,
  UserUsageDaily,
} from '@/services/subscriptionService';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trans } from '@/contexts/LanguageContext';
import { getMarketSentiment, SentimentError, SentimentResult } from '@/services/sentimentService';
import { cn } from '@/lib/utils';

const starterPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

const DashboardPage = () => {
  const { session, loading } = useSession();
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<CoinAnalysis[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UserUsageDaily | null>(null);
  const [sentimentTrends, setSentimentTrends] = useState<SentimentResult[]>([]);
  const [sentimentSummary, setSentimentSummary] = useState<{ most_mentioned: string | null; news_mood: number; reddit_heat: number; asia_watch: number } | null>(null);
  const [sentimentLocked, setSentimentLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const entitlement = useMemo(
    () => PLAN_ENTITLEMENTS[subscription?.plan || 'free'],
    [subscription?.plan]
  );

  const loadMarketData = useCallback(async () => {
    try {
      const [alertResponse, analyses] = await Promise.allSettled([getAlerts(), getRecentAnalyses()]);
      if (alertResponse.status === 'fulfilled') setAlerts(alertResponse.value.alerts);
      if (analyses.status === 'fulfilled') setRecentAnalyses(analyses.value);
    } catch {
      setAlerts([]);
      setRecentAnalyses([]);
    }
  }, []);

  const loadSentiment = useCallback(async (plan: string) => {
    if (plan === 'free') {
      setSentimentLocked(true);
      return;
    }
    try {
      const data = await getMarketSentiment(12);
      setSentimentTrends(data.trends);
      setSentimentSummary(data.summary);
      setSentimentLocked(false);
    } catch (err) {
      if (err instanceof SentimentError && err.code === 'SENTIMENT_REQUIRES_PRO') setSentimentLocked(true);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sub, today] = await Promise.all([getCurrentSubscription(), getTodayUsage()]);
      setSubscription(sub);
      setUsage(today);
      await loadMarketData();
      await loadSentiment(sub.plan);
    } finally {
      setIsLoading(false);
    }
  }, [loadMarketData, loadSentiment]);

  useEffect(() => {
    document.body.className = 'dark';
    loadDashboard();
    const interval = window.setInterval(() => {
      loadMarketData();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadDashboard, loadMarketData]);

  const runMarketScan = async () => {
    setMessage(null);
    setIsLoading(true);
    try {
      const analyses = await scanMarket();
      setRecentAnalyses(analyses);
      const today = await getTodayUsage();
      setUsage(today);
      setMessage(analyses.length ? 'Market scan complete.' : 'Market scan complete. No high-signal movement found right now.');
    } catch (err) {
      if (err instanceof CoinAnalysisError && err.code === 'SCANNER_REQUIRES_TRADER') {
        setMessage('Manual market scanner is available on Trader. Admin accounts also get Trader access after deploy.');
      } else {
        setMessage(err instanceof Error ? err.message : 'Market scan could not be completed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-16 rounded-md bg-slate-900" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 rounded-md bg-slate-900" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title={`Dashboard${session?.user?.email ? ` - ${session.user.email.split('@')[0]}` : ''}`}
      subtitle="See account limits and recent movement checks."
      action={
        <Button onClick={loadDashboard} disabled={isLoading} variant="outline" className="border-slate-700 bg-slate-900">
          <RefreshCw className="mr-2 h-4 w-4" />
          <Trans text="Refresh" />
        </Button>
      }
    >
      {message && (
        <div className="rounded-md border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={ShieldAlert} label="Plan" value={subscription?.plan.toUpperCase() || 'FREE'} />
        <MetricCard icon={Brain} label="Daily checks" value={`${usage?.ai_analysis_count || 0}/${entitlement.aiDailyLimit}`} />
        <MetricCard icon={Activity} label="Scanner" value={entitlement.canRunScanner ? 'Enabled' : `${entitlement.scannerDelayMinutes} min delay`} />
        <MetricCard icon={Clock} label="Renewal" value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('tr-TR') : '-'} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Flame} label="Most Mentioned" value={sentimentLocked ? 'PRO' : sentimentSummary?.most_mentioned?.replace('USDT', '') || '-'} />
        <MetricCard icon={Activity} label="News Mood" value={sentimentLocked ? 'Locked' : `${sentimentSummary?.news_mood ?? 0}/100`} />
        <MetricCard icon={Zap} label="Reddit Heat" value={sentimentLocked ? 'Locked' : `${sentimentSummary?.reddit_heat ?? 0}/100`} />
        <MetricCard icon={Clock} label="Asia Watch" value={sentimentLocked ? 'Locked' : `${sentimentSummary?.asia_watch ?? 0}/100`} />
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base"><Trans text="Trend Intelligence" /></CardTitle>
            <p className="mt-1 text-sm text-slate-400"><Trans text="Most mentioned coins and the likely news or social reason." /></p>
          </div>
          {sentimentLocked && <Button asChild className="bg-cyan-500 hover:bg-cyan-600"><Link to="/pricing">Upgrade</Link></Button>}
        </CardHeader>
        <CardContent>
          {sentimentLocked ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              <Trans text="Trend sentiment is available on Pro and Trader plans." />
            </div>
          ) : sentimentTrends.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {sentimentTrends.slice(0, 8).map((item) => (
                <Link key={item.symbol} to={`/analysis/${item.symbol}`} className="rounded-md border border-slate-800 bg-slate-950 p-3 transition hover:border-cyan-500/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-100">{item.symbol.replace('USDT', '')}</div>
                    <div className="flex items-center gap-2">
                      <TrendIcon direction={item.trend_json.trend_direction} />
                      <SentimentBadge label={item.score_json.sentiment_label} score={item.score_json.sentiment_score} />
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.trend_json.reason_short}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge className="bg-slate-800 text-slate-300">Mention {item.score_json.mention_score}/100</Badge>
                    <Badge className="bg-slate-800 text-slate-300">Sources {item.score_json.source_count}</Badge>
                    <Badge className="bg-slate-800 text-slate-300">Asia {item.trend_json.asia_watch_score}/100</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
              <Trans text="No sentiment trend yet." />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base"><Trans text="Movement scanner" /></CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              <Trans text="Checks recent market moves and classifies the likely cause." />
            </p>
          </div>
          <Button onClick={runMarketScan} disabled={isLoading || !entitlement.canRunScanner} className="bg-cyan-500 hover:bg-cyan-600">
            <Zap className="mr-2 h-4 w-4" />
            Scan Market
          </Button>
        </CardHeader>
        {!entitlement.canRunScanner && (
          <CardContent>
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              <Trans text="Manual scanning is available on the Trader plan. Cached results remain visible." />
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base"><Trans text="Market lab" /></CardTitle>
            <p className="mt-1 text-sm text-slate-400"><Trans text="Open a pair and inspect the likely cause behind its move." /></p>
          </div>
          <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
            <Link to="/analysis">
              <BarChart3 className="mr-2 h-4 w-4" />
              <Trans text="Open" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {starterPairs.map((symbol) => (
              <Button key={symbol} asChild variant="outline" className="border-slate-700 bg-slate-950">
                <Link to={`/analysis/${symbol}`}>{symbol.replace('USDT', '')}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {recentAnalyses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100"><Trans text="Recent movement checks" /></h2>
            <Badge className="bg-slate-800 text-slate-300">Cause cache</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentAnalyses.slice(0, 6).map((analysis) => (
              <Link key={analysis.id} to={`/analysis/${analysis.symbol}`}>
                <ScanningCard
                  realData={{
                    symbol: analysis.symbol,
                    time: analysis.created_at,
                    risk_score: analysis.risk_json.pump_dump_risk_score,
                    price_change: analysis.risk_json.trend_score,
                    volume_spike: analysis.indicator_json.volumeMultiplier,
                    summary: analysis.ai_summary_json.catalyst_summary_tr || analysis.ai_summary_json.summary_tr || 'Hareket kaynagi siniflandirildi',
                    likely_cause: analysis.cause_json?.likely_cause,
                    confidence: analysis.cause_json?.confidence_score,
                    early_warning: analysis.cause_json?.early_warning_score,
                    ai_source: analysis.ai_summary_json.source,
                    ai_fallback_reason: analysis.ai_summary_json.fallback_reason,
                  }}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100"><Trans text="Scanner results" /></h2>
          <Badge className="bg-slate-800 text-slate-300">{alerts.length} <Trans text="results" /></Badge>
        </div>
        {alerts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {alerts.slice(0, 12).map((scan) => (
              <Link key={scan.id} to={`/analysis/${scan.symbol}`}>
                <ScanningCard
                  realData={{
                    symbol: scan.symbol,
                    time: scan.created_at,
                    risk_score: scan.risk_score,
                    price_change: scan.price_change || 0,
                    volume_spike: scan.volume_spike || 1,
                    summary: scan.summary || 'Scanner signal',
                    ai_source: 'legacy_scanner',
                    ai_fallback_reason: null,
                  }}
                />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
            <Trans text="No scanner result yet." />
          </div>
        )}
      </section>
    </AppShell>
  );
};

const MetricCard = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <Card className="border-slate-800 bg-slate-900">
    <CardContent className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs text-slate-500"><Trans text={label} /></p>
        <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
      </div>
      <Icon className="h-6 w-6 text-cyan-400" />
    </CardContent>
  </Card>
);

const TrendIcon = ({ direction }: { direction: 'up' | 'down' | 'flat' }) => {
  if (direction === 'up') return <ArrowUpRight className="h-4 w-4 text-emerald-400" />;
  if (direction === 'down') return <ArrowDownRight className="h-4 w-4 text-rose-400" />;
  return <ArrowRight className="h-4 w-4 text-slate-400" />;
};

const SentimentBadge = ({ label, score }: { label: string; score: number }) => (
  <Badge className={cn(
    'bg-slate-800',
    label === 'good' && 'text-emerald-300',
    label === 'bad' && 'text-rose-300',
    label === 'neutral' && 'text-slate-300'
  )}>
    {label} {score}/100
  </Badge>
);

export default DashboardPage;
