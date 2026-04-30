// Ultra-Dark AI Market Analyst Dashboard with Glassmorphism

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  TrendingUp,
  Zap,
  Shield,
  Brain,
  Eye,
  BarChart3,
  Settings,
  Bell,
  AlertTriangle,
  Timer,
  Users
} from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { useGenerateSignals } from '@/hooks/useGenerateSignals';
import { PumpAlerts } from '@/components/PumpAlerts';
import { supabase } from '@/integrations/supabase/client';
import { getScanResults, getScannerStatus } from '@/services/scannerService';
import ScanningCard from '@/components/ScanningCard';
import { ScanData } from '@/services/scannerService';
import { getAlerts, AlertData } from '@/services/alertsApi';
import {
  CoinAnalysis,
  getRecentAnalyses,
  scanMarket,
} from '@/services/coinAnalysisService';

// Mock data for demonstration - replace with real data later
const mockAlerts = [
  {
    id: '1',
    symbol: 'BTCUSDT',
    price: 45000,
    priceChange: 2.5,
    volumeMultiplier: 3.2,
    riskScore: 85,
    aiSummary: 'Critical high volume spike detected on thin order book. AI analysis indicates potential manipulative pump & dump activity in early stages.',
    likelySource: 'Coordinated Pump Group',
    actionableInsight: 'Immediate exit position. Monitor for reversal signals.',
    detectedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    orderbookDepth: 1250000
  },
  {
    id: '2',
    symbol: 'XRPUSDT',
    price: 0.42,
    priceChange: 1.8,
    volumeMultiplier: 2.1,
    riskScore: 45,
    aiSummary: 'Moderate volume increase with strong buy pressure. Potentially organic growth momentum building.',
    likelySource: 'Accumulation Phase',
    actionableInsight: 'Consider entry with tight stop loss. Monitor volume sustainability.',
    detectedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    orderbookDepth: 2100000
  },
  {
    id: '3',
    symbol: 'ETHUSDT',
    price: 2850,
    priceChange: 0.8,
    volumeMultiplier: 1.9,
    riskScore: 25,
    aiSummary: 'Low risk. Steady accumulation detected with balanced order book depth.',
    likelySource: 'Organic Trading',
    actionableInsight: 'Safe to continue monitoring. No immediate action required.',
    detectedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    orderbookDepth: 23000000
  }
];

const DashboardPage = () => {
  const { session, loading } = useSession();
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<AlertData[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<CoinAnalysis[]>([]);
  const [scannerStatus, setScannerStatus] = useState({ isActive: false, lastScanTime: null, totalScans: 0 });
  const [isLoadingScans, setIsLoadingScans] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    watcherActive: true,
    aiWorkerActive: true,
    pendingJobs: 0,
    alertsToday: 47
  });

  // Effects for auto-refreshing scanner data
  useEffect(() => {
    // Initial fetch
    fetchScanResults();
    fetchRecentAnalyses();

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => {
      fetchScanResults();
    }, 30000);

    return () => clearInterval(interval);
  }, []);
  const fetchScanResults = async () => {
    setIsLoadingScans(true);
    try {
      const response = await getAlerts();

      setScanResults(response.alerts);
      setScannerStatus({
        isActive: true,
        lastScanTime: response.timestamp,
        totalScans: response.alerts.length
      });

      console.log(`📊 Fetched ${response.alerts.length} alerts from Supabase`);
      console.log('🔄 Last update:', response.timestamp);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setScanResults([]);
      setScannerStatus({ isActive: false, lastScanTime: null, totalScans: 0 });
    } finally {
      setIsLoadingScans(false);
    }
  };

  const fetchRecentAnalyses = async () => {
    try {
      const analyses = await getRecentAnalyses();
      setRecentAnalyses(analyses);
    } catch (error) {
      console.error('Failed to fetch coin analyses:', error);
      setRecentAnalyses([]);
    }
  };

  const runMarketScan = async () => {
    setIsLoadingScans(true);
    try {
      const analyses = await scanMarket();
      setRecentAnalyses(analyses);
      setScannerStatus({
        isActive: true,
        lastScanTime: new Date().toISOString(),
        totalScans: analyses.length
      });
    } catch (error) {
      console.error('Market scan failed:', error);
    } finally {
      setIsLoadingScans(false);
    }
  };

  // Ultra-dark theme background effect
  useEffect(() => {
    document.body.className = 'dark';
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIj48Y2lyY2xlIHI9IjEiIGN5PSIyIiBmaWxsPSIjNmI3MjgwIiAvPjpwYXR0ZXJuPjxkZWZzPjxzLmc+PGNpcmNsZSByPSIyIiBjeD0iMTAiIGN5PSIxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjd1cTgxNCIgc3Ryb2tlLW9wYWNpdHk9IjAuNCIvPg==')] opacity-30" />

        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Glass navbar placeholder */}
          <div className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-sky-500 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-['Inter'] font-semibold">AI Market Analyst</span>
              </div>
              <div className="w-32 h-8 bg-slate-800/50 rounded-lg animate-pulse" />
            </div>
          </div>

          <main className="flex-grow container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="h-12 bg-slate-800/50 rounded-xl mb-8 max-w-md"></div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-800/50 rounded-xl"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 bg-slate-800/50 rounded-xl"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950">
      {/* Background pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-slate-950"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.05)_0%,transparent_70%)] animate-pulse"></div>
        </div>
      </div>

      {/* Glass Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-slate-200 font-inter font-semibold text-lg">
                AI Market Analyst
              </h1>
              <p className="text-slate-400 font-jetbrains text-xs">
                Crypto pump & dump detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System Status */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm rounded-lg px-3 py-1">
                <div className={`w-2 h-2 rounded-full ${systemStatus.watcherActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className="text-xs text-slate-300 font-jetbrains">Market Watcher</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm rounded-lg px-3 py-1">
                <div className={`w-2 h-2 rounded-full ${systemStatus.aiWorkerActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className="text-xs text-slate-300 font-jetbrains">AI Worker</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="hidden sm:flex bg-cyan-500 hover:bg-cyan-600">
                <Link to="/analysis">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Coin Analyze
                </Link>
              </Button>
              <Settings className="h-5 w-5 text-slate-400 cursor-pointer hover:text-cyan-400 transition-colors" />
              <Bell className="h-5 w-5 text-slate-400 cursor-pointer hover:text-cyan-400 transition-colors" />
</div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Welcome Section */}
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-inter font-semibold text-slate-200 mb-2">
                Welcome back, {session?.user?.email?.split('@')[0]}
              </h2>
              <p className="text-slate-400 font-inter">
                Your AI-powered market surveillance system is actively monitoring real-time anomalies
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              <span className="text-cyan-400 font-jetbrains font-medium">
                AI Systems Active
              </span>
            </div>
          </div>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-950/50 backdrop-blur-md border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-jetbrains font-bold text-rose-400">
                    {systemStatus.alertsToday}
                  </p>
                  <p className="text-xs text-slate-400">Critical Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-950/50 backdrop-blur-md border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Brain className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-jetbrains font-bold text-cyan-400">
                    {systemStatus.pendingJobs}
                  </p>
                  <p className="text-xs text-slate-400">AI Queue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-950/50 backdrop-blur-md border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Activity className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-jetbrains font-bold text-emerald-400">
                    {scannerStatus.isActive ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-slate-400">Scanner Status</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-950/50 backdrop-blur-md border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Timer className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-jetbrains font-bold text-yellow-400">
                    30s
                  </p>
                  <p className="text-xs text-slate-400">Supabase Scan Interval</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-inter font-semibold text-slate-200">
                Supabase Market Surveillance Control
              </h3>
              <p className="text-sm text-slate-400">
                Background scanning on Supabase Edge Functions - {scannerStatus.totalScans} scans completed
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={runMarketScan}
                disabled={isLoadingScans}
                variant="outline"
                className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              >
                <Zap className="h-4 w-4 mr-2" />
                Run Market Scan
              </Button>
              <Button
                onClick={fetchScanResults}
                disabled={isLoadingScans}
                className="bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 text-white font-inter font-medium px-4 py-2 rounded-lg"
              >
                <Activity className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300 font-inter">
                Scanner Status
              </span>
              <span className={`text-sm font-bold ${scannerStatus.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {scannerStatus.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Last update: {scannerStatus.lastScanTime ? new Date(scannerStatus.lastScanTime).toLocaleString() : 'Never'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              System scans every 30 seconds in Supabase Edge Runtime
            </p>
          </div>
        </div>

        {/* On-demand coin analysis entry */}
        <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-inter font-semibold text-slate-200">
                Coin Direction & Risk Analysis
              </h3>
              <p className="text-sm text-slate-400">
                Select a coin, choose 5m/15m/30m/1h/4h and get deterministic technical + whale scoring with a short Gemini summary.
              </p>
            </div>
            <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
              <Link to="/analysis">
                <Brain className="h-4 w-4 mr-2" />
                Open Analysis Terminal
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'].map((symbol) => (
              <Button
                key={symbol}
                asChild
                variant="outline"
                className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              >
                <Link to={`/analysis/${symbol}`}>
                  {symbol.replace('USDT', '')}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {recentAnalyses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-inter font-semibold text-slate-200">
                Latest Coin Analyses
              </h3>
              <span className="text-sm text-slate-400 font-jetbrains">
                Cached edge results
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentAnalyses.slice(0, 6).map((analysis) => (
                <Link key={analysis.id} to={`/analysis/${analysis.symbol}`}>
                  <ScanningCard
                    realData={{
                      symbol: analysis.symbol,
                      time: analysis.created_at,
                      risk_score: analysis.risk_json.pump_dump_risk_score,
                      price_change: analysis.risk_json.trend_score,
                      volume_spike: analysis.indicator_json.volumeMultiplier,
                      summary: analysis.ai_summary_json.summary_tr || 'Analysis complete'
                    }}
                  />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active AI Alerts from Supabase */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-inter font-semibold text-slate-200">
              Supabase AI Scanner Results
            </h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${scannerStatus.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-sm text-slate-400 font-jetbrains">
                Supabase Edge Runtime Active
              </span>
            </div>
          </div>

          {isLoadingScans ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
                  <div className="h-4 bg-slate-700 rounded mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-700 rounded"></div>
                    <div className="h-3 bg-slate-700 rounded w-2/3"></div>
                    <div className="h-20 bg-slate-700 rounded mt-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : scanResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scanResults.slice(0, 12).map((scan) => (
                <ScanningCard
                  key={scan.id}
                  realData={{
                    symbol: scan.symbol,
                    time: scan.created_at,
                    risk_score: scan.risk_score,
                    price_change: 0, // Will enhance with real data later
                    volume_spike: 1,
                    summary: scan.summary || 'Analysis in progress...'
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-xl">
              <Brain className="h-16 w-16 mx-auto mb-4 text-slate-600 animate-pulse" />
              <h4 className="text-lg font-inter font-medium text-slate-400 mb-2">
                Supabase Scanner Waiting for Anomalies
              </h4>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                No anomalies detected yet. The scanner is actively monitoring the top 200 cryptocurrencies
                and will display results here when pump/dump patterns are identified.
              </p>
              <div className="mt-4 text-xs text-slate-400">
                Console'da tarama logları görünmeli: "🔍 Starting market scan..."
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
