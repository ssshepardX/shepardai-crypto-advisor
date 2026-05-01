import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';
import { Trans } from '@/contexts/LanguageContext';
import { BillingInterval, createCheckout, PlanId } from '@/services/subscriptionService';

const intervalLabels: Record<BillingInterval, string> = {
  monthly: 'Monthly',
  quarterly: '3 months',
  yearly: 'Yearly',
};

const prices: Record<PlanId, Record<BillingInterval, string>> = {
  free: { monthly: '€0', quarterly: '€0', yearly: '€0' },
  pro: { monthly: '€4.99', quarterly: '€11.23', yearly: '€29.94' },
  trader: { monthly: '€9.99', quarterly: '€22.48', yearly: '€59.94' },
};

const plans: Array<{
  id: PlanId;
  name: string;
  description: string;
  features: string[];
  cta: string;
  badge?: string;
}> = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic access for trying the product.',
    features: ['3 movement checks per day', 'Delayed scanner', 'Basic chart and scores', 'Advanced risk details hidden'],
    cta: 'Use Free',
  },
  {
    id: 'pro',
    name: 'Shepard Advisor PRO',
    description: 'For users who check market moves regularly.',
    features: ['50 movement checks per day', 'Live scanner view', 'Supervisor summary', 'Risk and whale details'],
    cta: 'Start PRO',
    badge: 'Best value',
  },
  {
    id: 'trader',
    name: 'Shepard Advisor TRADER',
    description: 'For higher daily use and manual market scans.',
    features: ['250 movement checks per day', 'Manual market scanner', 'All advanced details', 'Higher product limits'],
    cta: 'Start TRADER',
    badge: 'Highest limit',
  },
];

const Pricing = () => {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { session } = useSession();
  const navigate = useNavigate();

  const handleSelectPlan = async (plan: PlanId) => {
    setError(null);
    if (plan === 'free') {
      navigate(session ? '/dashboard' : '/login');
      return;
    }

    if (!session) {
      navigate('/login');
      return;
    }

    setLoadingPlan(plan);
    try {
      const checkout = await createCheckout(plan, interval);
      window.location.href = checkout.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout olusturulamadi.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppShell
      title="Plans"
      subtitle="Choose limits for movement source analysis."
      action={
        <div className="rounded-md border border-slate-800 bg-slate-950 p-1">
          {(['monthly', 'quarterly', 'yearly'] as BillingInterval[]).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setInterval(item)}
              className={cn(
                'h-8 rounded px-3 text-slate-400 hover:bg-slate-900 hover:text-slate-100',
                interval === item && 'bg-cyan-500 text-white hover:bg-cyan-500 hover:text-white'
              )}
            >
              <Trans text={intervalLabels[item]} />
            </Button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              'flex flex-col border-slate-800 bg-slate-900 text-slate-100',
              plan.id === 'trader' && 'border-cyan-500/40'
            )}
          >
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.badge && <Badge className="bg-cyan-500/10 text-cyan-300"><Trans text={plan.badge} /></Badge>}
              </div>
              <p className="text-sm text-slate-400"><Trans text={plan.description} /></p>
              <div>
                <span className="text-4xl font-semibold">{prices[plan.id][interval]}</span>
                {plan.id !== 'free' && <span className="ml-2 text-sm text-slate-500">/<Trans text={intervalLabels[interval].toLowerCase()} /></span>}
              </div>
              {interval === 'quarterly' && plan.id !== 'free' && (
                <p className="text-xs text-emerald-300"><Trans text="25% discount included in total price" /></p>
              )}
              {interval === 'yearly' && plan.id !== 'free' && (
                <p className="text-xs text-emerald-300"><Trans text="50% discount included in total price" /></p>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span><Trans text={feature} /></span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className={cn('w-full', plan.id === 'trader' ? 'bg-cyan-500 hover:bg-cyan-600' : '')}
                variant={plan.id === 'free' ? 'outline' : 'default'}
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Trans text={plan.cta} />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </AppShell>
  );
};

export default Pricing;
