import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BarChart3, Database, MessageSquare, Play, RefreshCw, Shield, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import {
  AdminUser,
  BacktestEvent,
  BacktestMode,
  BacktestResult,
  ContactMessage,
  ManualMovementLabel,
  collectMarketSnapshot,
  getAdminData,
  runBacktest,
  setMessageStatus,
  setMovementEventLabel,
  setUserSubscription,
} from '@/services/adminService';
import { Trans } from '@/contexts/LanguageContext';
import { getAdminEmails, isAdminEmail } from '@/lib/admin';

const ADMIN_EMAILS = getAdminEmails();
const PRIMARY_ADMIN_EMAIL = ADMIN_EMAILS[0] || '';
const MANUAL_LABELS: ManualMovementLabel[] = [
  'organic_demand',
  'whale_push',
  'thin_liquidity_move',
  'fomo_trap',
  'fraud_pump_risk',
  'news_social_catalyst',
  'balanced_market',
];

const AdminLogin = () => {
  const [email, setEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async () => {
    if (PRIMARY_ADMIN_EMAIL && !isAdminEmail(email)) {
      setError('Admin email not allowed');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate('/admin');
  };

  return (
    <AppShell title="Admin login" subtitle="Private access.">
      <Card className="mx-auto max-w-md border-slate-800 bg-slate-900">
        <CardContent className="space-y-3 p-5">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-slate-700 bg-slate-950" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="border-slate-700 bg-slate-950" />
          {error && <div className="text-sm text-rose-300">{error}</div>}
          <Button onClick={submit} disabled={loading || !email || !password} className="w-full bg-cyan-500 hover:bg-cyan-600">
            <Trans text={loading ? 'Sending' : 'Log in'} />
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
};

const AdminPanel = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [view, setView] = useState<'users' | 'messages' | 'backtests'>('users');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminData();
      setUsers(data.users);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin data failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell title="Admin" subtitle="Users, plans, messages, backtests." action={<Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><Shield className="mr-1 h-3 w-3" />Private</Badge>}>
      <div className="space-y-5">
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-md border border-slate-800 bg-slate-950 p-1">
            {([
              ['users', Users, 'Users'],
              ['messages', MessageSquare, 'Messages'],
              ['backtests', BarChart3, 'Backtests'],
            ] as const).map(([key, Icon, label]) => (
              <Button
                key={key}
                onClick={() => setView(key)}
                variant={view === key ? 'default' : 'ghost'}
                className={view === key ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'text-slate-400 hover:text-white'}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
          <Button onClick={load} disabled={loading} variant="outline" className="border-slate-700 bg-slate-900">
            <RefreshCw className="mr-2 h-4 w-4" />
            <Trans text="Refresh" />
          </Button>
        </div>

        {view === 'users' && <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-400" /><Trans text="Users" /></CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="p-2">Email</th><th className="p-2">Status</th><th className="p-2">Plan</th><th className="p-2">Days</th><th className="p-2">Usage</th><th className="p-2">Mood</th><th className="p-2">Plan set</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-800">
                    <td className="p-2">{user.email || user.id}</td>
                    <td className="p-2"><Badge className={user.online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}>{user.online ? 'Online' : 'Offline'}</Badge></td>
                    <td className="p-2">{user.subscription?.plan || 'free'}</td>
                    <td className="p-2">{user.days_left ?? '-'}</td>
                    <td className="p-2">{user.usage_today?.ai_analysis_count ?? 0}</td>
                    <td className="p-2">{user.satisfaction || '-'}</td>
                    <td className="p-2">
                      <Select onValueChange={(value) => setUserSubscription(user.id, value as 'free' | 'pro' | 'trader', 30).then(load)}>
                        <SelectTrigger className="h-8 w-28 border-slate-700 bg-slate-950"><SelectValue placeholder="Plan" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="trader">Trader</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>}

        {view === 'messages' && <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-cyan-400" /><Trans text="Contact messages" /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{message.subject}</div>
                    <div className="text-xs text-slate-500">{message.email || message.name || 'anonymous'} - {new Date(message.created_at).toLocaleString()}</div>
                  </div>
                  <Select value={message.status} onValueChange={(value) => setMessageStatus(message.id, value as 'new' | 'read' | 'closed').then(load)}>
                    <SelectTrigger className="h-8 w-28 border-slate-700 bg-slate-900"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-2 text-sm text-slate-300">{message.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>}

        {view === 'backtests' && <BacktestsPanel />}
      </div>
    </AppShell>
  );
};

const BacktestsPanel = () => {
  const [symbolsText, setSymbolsText] = useState('BTCUSDT, ETHUSDT, SOLUSDT');
  const [timeframe, setTimeframe] = useState('15m');
  const [mode, setMode] = useState<BacktestMode>('historical_kline');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [snapshotInfo, setSnapshotInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = symbolsText.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSnapshotInfo(null);
    try {
      setResult(await runBacktest({ symbols, timeframe, mode, from: from || undefined, to: to || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await collectMarketSnapshot({ symbols: symbols.length ? symbols : undefined, timeframe, limit: 40 });
      setSnapshotInfo(`Snapshots: ${data.snapshot_count}. Events: ${data.event_count}. Errors: ${data.errors.length}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Snapshot failed');
    } finally {
      setBusy(false);
    }
  };

  const updateLabel = async (event: BacktestEvent, label: ManualMovementLabel) => {
    if (!event.id) return;
    await setMovementEventLabel(event.id, label);
    setResult((current) => current ? {
      ...current,
      events: current.events.map((item) => item.id === event.id ? { ...item, manual_label: label } : item),
    } : current);
  };

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-400" />Backtests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
        {snapshotInfo && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{snapshotInfo}</div>}
        <div className="grid gap-3 md:grid-cols-5">
          <Input value={symbolsText} onChange={(e) => setSymbolsText(e.target.value)} className="border-slate-700 bg-slate-950 md:col-span-2" placeholder="BTCUSDT, ETHUSDT" />
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['5m', '15m', '30m', '1h', '4h'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={(value) => setMode(value as BacktestMode)}>
            <SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="historical_kline">Historical</SelectItem>
              <SelectItem value="snapshot">Snapshots</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={collect} disabled={busy} variant="outline" className="border-slate-700 bg-slate-950">
            <Database className="mr-2 h-4 w-4" />
            Snapshot
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={from} onChange={(e) => setFrom(e.target.value)} type="date" className="border-slate-700 bg-slate-950" />
          <Input value={to} onChange={(e) => setTo(e.target.value)} type="date" className="border-slate-700 bg-slate-950" />
          <Button onClick={submit} disabled={busy} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
            <Play className="mr-2 h-4 w-4" />
            Run
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              {Object.entries(result.metrics).map(([key, value]) => (
                <div key={key} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-500">{key.replaceAll('_', ' ')}</div>
                  <div className="mt-1 text-xl font-semibold text-white">{String(value)}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-md border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-950 text-left text-slate-500">
                  <tr>
                    <th className="p-2">Symbol</th><th className="p-2">Time</th><th className="p-2">Move</th><th className="p-2">Volume Z</th><th className="p-2">Cause</th><th className="p-2">Outcome</th><th className="p-2">Manual</th>
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((event, index) => (
                    <tr key={event.id || `${event.symbol}-${event.event_start}-${index}`} className="border-t border-slate-800">
                      <td className="p-2">{event.symbol}</td>
                      <td className="p-2">{new Date(event.event_start).toLocaleString()}</td>
                      <td className="p-2">{Number(event.move_pct).toFixed(2)}%</td>
                      <td className="p-2">{Number(event.volume_zscore).toFixed(2)}</td>
                      <td className="p-2">{event.detected_label}</td>
                      <td className="p-2">{event.realized_outcome}</td>
                      <td className="p-2">
                        {event.id ? (
                          <Select value={event.manual_label || ''} onValueChange={(value) => updateLabel(event, value as ManualMovementLabel)}>
                            <SelectTrigger className="h-8 w-48 border-slate-700 bg-slate-950"><SelectValue placeholder="Label" /></SelectTrigger>
                            <SelectContent>
                              {MANUAL_LABELS.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Admin = () => {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <AdminLogin />;
  if (PRIMARY_ADMIN_EMAIL && !isAdminEmail(session.user.email)) return <Navigate to="/" replace />;
  return <AdminPanel />;
};

export default Admin;
