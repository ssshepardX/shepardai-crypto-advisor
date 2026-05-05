import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Brain, CreditCard, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLanguage, Trans, useLanguage } from '@/contexts/LanguageContext';

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}

const AppShell = ({ title, subtitle, children, action }: AppShellProps) => {
  const { session } = useSession();
  const { language, languages, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const closeMenu = () => setMobileOpen(false);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analysis', icon: BarChart3, label: 'Market lab' },
    { to: '/pricing', icon: CreditCard, label: 'Pricing' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.12),transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#09090b)]" />
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to={session ? '/dashboard' : '/'} className="flex items-center gap-3" onClick={closeMenu}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-400/30">
              <Brain className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">Shepard Advisor</div>
              <div className="text-xs text-slate-500"><Trans text="Market intelligence" /></div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Button key={item.to} asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                <Link to={item.to}>
                  <item.icon className="mr-2 h-4 w-4" />
                  <Trans text={item.label} />
                </Link>
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {action}
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as AppLanguage)}
              className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-200 outline-none"
              aria-label="Language"
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
            {session ? (
              <Button onClick={handleLogout} variant="outline" size="sm" className="hidden border-slate-700 bg-slate-900 md:inline-flex">
                <LogOut className="mr-2 h-4 w-4" />
                <Trans text="Log out" />
              </Button>
            ) : (
              <Button asChild size="sm" className="hidden bg-cyan-500 hover:bg-cyan-600 md:inline-flex">
                <Link to="/login"><Trans text="Log in" /></Link>
              </Button>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-slate-300 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-lg">
            <div className="mx-auto max-w-7xl flex flex-col space-y-1 px-4 py-3">
              {navItems.map((item) => (
                <Link key={item.to} to={item.to} onClick={closeMenu}>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-slate-300">
                    <item.icon className="mr-2 h-4 w-4" />
                    <Trans text={item.label} />
                  </Button>
                </Link>
              ))}
              <div className="border-t border-white/10 my-1" />
              {session ? (
                <Button onClick={() => { handleLogout(); closeMenu(); }} variant="outline" size="sm" className="w-full justify-start border-slate-700 bg-slate-900">
                  <LogOut className="mr-2 h-4 w-4" />
                  <Trans text="Log out" />
                </Button>
              ) : (
                <Link to="/login" onClick={closeMenu}>
                  <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-600">
                    <Trans text="Log in" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white"><Trans text={title} /></h1>
            {subtitle && <p className="mt-1 text-sm text-slate-400"><Trans text={subtitle} /></p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AppShell;
