import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MessageSquare, RefreshCw, Shield, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { AdminUser, ContactMessage, getAdminData, setMessageStatus, setUserSubscription } from '@/services/adminService';
import { Trans } from '@/contexts/LanguageContext';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || '';

const AdminLogin = () => {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async () => {
    if (ADMIN_EMAIL && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
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
    <AppShell title="Admin" subtitle="Users, plans, messages." action={<Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><Shield className="mr-1 h-3 w-3" />Private</Badge>}>
      <div className="space-y-5">
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
        <div className="flex justify-end">
          <Button onClick={load} disabled={loading} variant="outline" className="border-slate-700 bg-slate-900">
            <RefreshCw className="mr-2 h-4 w-4" />
            <Trans text="Refresh" />
          </Button>
        </div>

        <Card className="border-slate-800 bg-slate-900">
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
        </Card>

        <Card className="border-slate-800 bg-slate-900">
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
        </Card>
      </div>
    </AppShell>
  );
};

const Admin = () => {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <AdminLogin />;
  if (ADMIN_EMAIL && session.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return <Navigate to="/" replace />;
  return <AdminPanel />;
};

export default Admin;
