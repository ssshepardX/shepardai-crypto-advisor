import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ExternalLink, ShieldAlert, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { initTelegramMiniApp, telegramWebApp, TelegramMiniAppUser } from '@/lib/telegram';
import { verifyTelegramInitData } from '@/services/telegramService';
import { getRecentAnalyses, CoinAnalysis } from '@/services/coinAnalysisService';
import { formatCauseLabel } from '@/lib/labels';

const starterPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

const TelegramMiniApp = () => {
  const [user, setUser] = useState<TelegramMiniAppUser | null>(null);
  const [verified, setVerified] = useState(false);
  const [recent, setRecent] = useState<CoinAnalysis[]>([]);
  const [message, setMessage] = useState('Opening Telegram Mini App...');

  useEffect(() => {
    const app = initTelegramMiniApp();
    const unsafeUser = app?.initDataUnsafe?.user || null;
    setUser(unsafeUser);
    if (!app?.initData) {
      setMessage('Open this page inside Telegram to use the Mini App mode.');
      return;
    }
    verifyTelegramInitData(app.initData)
      .then((result) => {
        setVerified(result.ok);
        setUser(result.telegram_user || unsafeUser);
        setMessage(result.ok ? 'Telegram verified.' : 'Telegram verification failed.');
      })
      .catch(() => setMessage('Telegram verification failed.'));
    getRecentAnalyses().then(setRecent).catch(() => setRecent([]));
  }, []);

  const displayName = useMemo(() => {
    if (!user) return 'Telegram user';
    return user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(' ') || `User ${user.id}`;
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100">
      <div className="mx-auto max-w-md space-y-4">
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Shepard AI</div>
              <h1 className="mt-1 text-2xl font-semibold">Telegram Market Lab</h1>
            </div>
            <Badge className={verified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}>
              {verified ? 'Verified' : 'Limited'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">{message}</p>
          <p className="text-sm text-slate-300">{displayName}</p>
        </header>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-cyan-300" />
              Quick analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {starterPairs.map((symbol) => (
              <Button key={symbol} asChild className="bg-slate-800 hover:bg-slate-700">
                <Link to={`/analysis/${symbol}`}>{symbol.replace('USDT', '')}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-cyan-300" />
              Recent movement checks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.slice(0, 4).map((item) => (
              <Link key={item.id} to={`/analysis/${item.symbol}`} className="block rounded-md border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{item.symbol}</span>
                  <span className="text-xs text-slate-500">{item.timeframe}</span>
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {formatCauseLabel(item.cause_json?.likely_cause || item.ai_summary_json?.likely_cause, 'en')}
                </div>
              </Link>
            ))}
            {!recent.length && <p className="text-sm text-slate-500">No cached analysis yet.</p>}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-cyan-500/10">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-4 w-4 text-cyan-300" />
              <p className="text-sm text-slate-300">
                Mini App mode is optimized for quick discovery. Sign in on the app for daily limits, saved usage, and full AI summaries.
              </p>
            </div>
            <Button asChild className="w-full bg-cyan-500 hover:bg-cyan-600">
              <Link to="/login?next=/dashboard">
                Open full app
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full border-slate-700 bg-slate-900" onClick={() => telegramWebApp()?.close()}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default TelegramMiniApp;
