import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Menu, X } from "lucide-react";
import { Trans } from "@/contexts/LanguageContext";

const Navbar = () => {
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPath = `${location.pathname}${location.search}`;
  const loginPath = `/login?next=${encodeURIComponent(currentPath)}`;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const closeMenu = () => setMobileOpen(false);

  const navLinks = [
    ...(session ? [{ to: "/dashboard", label: "Dashboard" }] : []),
    { to: "/pricing", label: "Pricing" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
    { to: "/terms", label: "Terms" },
    { to: "/privacy", label: "Privacy" },
  ];

  return (
    <header className="w-full border-b border-white/10 sticky top-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="container mx-auto flex justify-between items-center p-4">
        <Link to="/" className="flex items-center space-x-2" onClick={closeMenu}>
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-slate-600 rounded-xl flex items-center justify-center shadow-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <span className="text-slate-200 font-inter font-semibold text-lg hidden sm:block">
            Shepard Advisor
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-2">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Button variant="ghost"><Trans text={link.label} /></Button>
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center space-x-4">
          {session ? (
            <>
              <Button onClick={handleLogout}><Trans text="Log out" /></Button>
            </>
          ) : (
            <>
              <Link to={loginPath}>
                <Button variant="ghost"><Trans text="Log in" /></Button>
              </Link>
              <Link to={loginPath}>
                <Button className="bg-cyan-500 hover:bg-cyan-600">Sign Up</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-slate-300 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-lg animate-in slide-in-from-top-2">
          <nav className="container mx-auto flex flex-col space-y-1 p-4">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={closeMenu}>
                <Button variant="ghost" className="w-full justify-start"><Trans text={link.label} /></Button>
              </Link>
            ))}
            <div className="border-t border-white/10 my-2" />
            {session ? (
              <>
                <Link to="/dashboard" onClick={closeMenu}>
                  <Button variant="ghost" className="w-full justify-start"><Trans text="Dashboard" /></Button>
                </Link>
                <Button onClick={() => { handleLogout(); closeMenu(); }} variant="outline" className="w-full justify-start border-slate-700">
                  <Trans text="Log out" />
                </Button>
              </>
            ) : (
              <>
                <Link to={loginPath} onClick={closeMenu}>
                  <Button className="w-full bg-cyan-500 hover:bg-cyan-600"><Trans text="Log in" /></Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
