import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type Status = 'verifying' | 'success' | 'error';

const ConfirmEmail = () => {
  const [status, setStatus] = useState<Status>('verifying');
  const navigate = useNavigate();
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleVerifiedSession = () => {
      if (!isMounted) return;

      setStatus('success');
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 3000);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        handleVerifiedSession();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleVerifiedSession();
      }
    });

    const timer = window.setTimeout(() => {
      if (isMounted) {
        setStatus((currentStatus) => (
          currentStatus === 'verifying' ? 'error' : currentStatus
        ));
      }
    }, 10000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.clearTimeout(timer);
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [navigate]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="mb-4 h-12 w-12 animate-spin" />
            <CardTitle>E-posta Adresiniz Doğrulanıyor...</CardTitle>
            <p className="mt-2 text-muted-foreground">Lütfen bekleyin, bu işlem birkaç saniye sürebilir.</p>
          </div>
        );
      case 'success':
        return (
          <div className="flex flex-col items-center text-center">
            <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
            <CardTitle>Doğrulama Başarılı!</CardTitle>
            <p className="mt-2 text-muted-foreground">Hesabınız başarıyla aktive edildi. Kontrol paneline yönlendiriliyorsunuz...</p>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center text-center">
            <XCircle className="mb-4 h-12 w-12 text-red-500" />
            <CardTitle>Doğrulama Başarısız</CardTitle>
            <p className="mt-2 text-muted-foreground">
              Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir. Lütfen tekrar giriş yapmayı deneyin veya yeni bir doğrulama e-postası isteyin.
            </p>
            <div className="mt-6 flex gap-3">
              <Button asChild>
                <Link to="/login">Girişe Dön</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Ana Sayfa</Link>
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader />
        <CardContent className="p-8">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmEmail;
