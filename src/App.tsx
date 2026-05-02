import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { SessionContextProvider } from "./contexts/SessionContext";
import LanguageProvider from "./contexts/LanguageContext";
import { ThemeProvider } from "./components/ThemeProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";
import { HelmetProvider } from 'react-helmet-async';

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CoinAnalysis = lazy(() => import("./pages/CoinAnalysis"));
const ConfirmEmail = lazy(() => import("./pages/ConfirmEmail"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component with ultra-dark theme
const LoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 flex items-center justify-center p-4">
    {/* Background pattern */}
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-slate-950"></div>
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.05)_0%,transparent_70%)] animate-pulse"></div>
      </div>
    </div>
    <div className="relative z-10 flex flex-col items-center space-y-6 w-full max-w-md">
      <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
        <div className="w-8 h-8 bg-white/20 rounded-lg animate-pulse"></div>
      </div>
      <div className="text-center space-y-3">
        <Skeleton className="h-6 w-3/4 bg-slate-800/50 mx-auto" />
        <Skeleton className="h-4 w-1/2 bg-slate-800/50 mx-auto" />
      </div>
      <div className="space-y-3 w-full">
        <Skeleton className="h-12 w-full bg-slate-800/50 rounded-xl" />
        <Skeleton className="h-20 w-full bg-slate-800/50 rounded-xl" />
        <Skeleton className="h-16 w-full bg-slate-800/50 rounded-lg" />
      </div>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <BrowserRouter>
            <SessionContextProvider>
              <LanguageProvider>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/confirm-email" element={<ConfirmEmail />} />
                  <Route path="/verify-otp" element={<VerifyOtp />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/admin" element={<Admin />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/analysis" element={<CoinAnalysis />} />
                    <Route path="/analysis/:symbol" element={<CoinAnalysis />} />
                    <Route path="/payment/success" element={<PaymentResult />} />
                    <Route path="/payment/cancel" element={<PaymentResult />} />
                  </Route>

                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </LanguageProvider>
            </SessionContextProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
