import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const VerifyOtp = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialEmail = useMemo(() => params.get('email') || '', [params]);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup',
    });
    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const resend = async () => {
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    setStatus(error ? error.message : 'New code sent.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-400/30">
            <ShieldCheck className="h-6 w-6 text-cyan-300" />
          </div>
          <CardTitle>Email verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-slate-700 bg-slate-950" />
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digit code" inputMode="numeric" className="border-slate-700 bg-slate-950 text-center text-lg tracking-[0.4em]" />
          {status && <div className="text-sm text-slate-300">{status}</div>}
          <Button onClick={verify} disabled={loading || !email || code.length < 6} className="w-full bg-cyan-500 hover:bg-cyan-600">
            Verify
          </Button>
          <Button onClick={resend} disabled={loading || !email} variant="outline" className="w-full border-slate-700 bg-slate-950">
            Send new code
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyOtp;
