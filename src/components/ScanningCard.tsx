import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { Trans } from '@/contexts/LanguageContext';

interface RealData {
  symbol: string;
  time: string;
  risk_score: number;
  price_change: number;
  volume_spike: number;
  summary: string;
  likely_cause?: string;
  confidence?: number;
  early_warning?: number;
}

const ScanningCard: React.FC<{ realData: RealData }> = ({ realData }) => {
  const [progress, setProgress] = useState(0);
  const [showData, setShowData] = useState(false);
  const [loadingText, setLoadingText] = useState("Checking market data...");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setShowData(true);
          return 100;
        }
        const jump = Math.floor(Math.random() * 15) + 5;
        return Math.min(prev + jump, 100);
      });
    }, 150);

    setTimeout(() => setLoadingText("Reading volume changes..."), 500);
    setTimeout(() => setLoadingText("Classifying movement cause..."), 1200);

    return () => clearInterval(interval);
  }, []);

  if (!showData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse"></div>

        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-20 bg-slate-800 rounded animate-pulse"></div>
          <Activity className="text-cyan-500 animate-spin-slow" size={20} />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-xs text-cyan-400 font-mono">
            <span><Trans text={loadingText} /></span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="mt-4 text-[10px] font-mono text-slate-600 space-y-1 opacity-50">
            <p>{'>'} <Trans text="Reading order book depth" /></p>
            <p className={progress > 40 ? 'text-emerald-500' : ''}>{'>'} <Trans text="Checking whale and liquidity traces" /></p>
            <p className={progress > 80 ? 'text-cyan-500' : ''}>{'>'} <Trans text="Preparing short summary" /></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white tracking-tight">{realData.symbol}</h3>
          <span className="text-xs text-slate-400 font-mono">{new Date(realData.time).toLocaleTimeString()}</span>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${realData.risk_score > 80 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
          <Trans text="Alert" />: {realData.early_warning ?? realData.risk_score}/100
        </div>
      </div>

      <div className="space-y-3 mb-4">
         <div className="flex justify-between text-sm">
            <span className="text-slate-400"><Trans text="Likely cause" /></span>
            <span className="text-emerald-400 font-mono">{realData.likely_cause || 'balanced_market'}</span>
         </div>
         <div className="flex justify-between text-sm">
            <span className="text-slate-400"><Trans text="Volume spike" /></span>
            <span className="text-cyan-400 font-mono">{realData.volume_spike}x</span>
         </div>
         <div className="flex justify-between text-sm">
            <span className="text-slate-400"><Trans text="Confidence" /></span>
            <span className="text-slate-200 font-mono">{realData.confidence ?? 0}/100</span>
         </div>
      </div>

      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
        <p className="text-xs text-slate-300 leading-relaxed">
          <span className="text-cyan-500 font-bold">Supervisor: </span>
          {realData.summary}
        </p>
      </div>
    </div>
  );
};

export default ScanningCard;
