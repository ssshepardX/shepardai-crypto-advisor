import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'signup';

const Login = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  const submit = async () => {
    setLoading(true);
    setError(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      navigate('/dashboard');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/confirm-email`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/verify-otp?email=${encodeURIComponent(email)}&type=signup`);
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-400/30">
            <Brain className="h-6 w-6 text-cyan-300" />
          </div>
          <CardTitle>{mode === 'login' ? 'Log in' : 'Sign up'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-800 bg-slate-950 p-1">
            <Button type="button" variant={mode === 'login' ? 'default' : 'ghost'} onClick={() => setMode('login')}>Log in</Button>
            <Button type="button" variant={mode === 'signup' ? 'default' : 'ghost'} onClick={() => setMode('signup')}>Sign up</Button>
          </div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-slate-700 bg-slate-950" />
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="border-slate-700 bg-slate-950" />
          {error && <div className="text-sm text-rose-300">{error}</div>}
          <Button onClick={submit} disabled={loading || !email || !password} className="w-full bg-cyan-500 hover:bg-cyan-600">
            {loading ? 'Sending' : mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
          <Button onClick={signInWithGoogle} variant="outline" className="w-full border-slate-700 bg-slate-950">
            Continue with Google
          </Button>
          {mode === 'signup' && (
            <p className="text-center text-xs text-slate-500">
              A verification code will be sent by email.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
