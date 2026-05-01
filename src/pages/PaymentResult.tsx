import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, CircleX, LayoutDashboard, CreditCard } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trans } from '@/contexts/LanguageContext';

const PaymentResult = () => {
  const location = useLocation();
  const isSuccess = location.pathname.includes('/success');

  return (
    <AppShell
      title={isSuccess ? 'Payment complete' : 'Payment canceled'}
      subtitle={isSuccess ? 'The plan will update after payment confirmation.' : 'The current plan stays active.'}
    >
      <Card className="mx-auto max-w-xl border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-950">
            {isSuccess ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            ) : (
              <CircleX className="h-8 w-8 text-amber-400" />
            )}
          </div>
          <CardTitle><Trans text={isSuccess ? 'Checkout complete' : 'Checkout canceled'} /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-400">
            {isSuccess
              ? <Trans text="The dashboard will show the new plan after confirmation." />
              : <Trans text="Choose another plan or billing period from pricing." />}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <Trans text="Dashboard" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-700 bg-slate-950">
              <Link to="/pricing">
                <CreditCard className="mr-2 h-4 w-4" />
                <Trans text="Pricing" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
};

export default PaymentResult;
