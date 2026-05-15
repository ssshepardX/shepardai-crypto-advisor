import React from 'react';
import { Trans, useLanguage } from '@/contexts/LanguageContext';
import { formatCauseLabel } from '@/lib/labels';

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
  ai_source?: string;
  ai_fallback_reason?: string | null;
}

const ScanningCard: React.FC<{ realData: RealData }> = ({ realData }) => {
  const { language } = useLanguage();
  const summary = buildSummary(realData);
  const sourceLabel = realData.ai_fallback_reason
    ? 'Deterministic fallback'
    : realData.ai_source
      ? 'Supervisor summary'
      : 'Cached analysis';

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-white">{realData.symbol}</h3>
          <span className="font-mono text-xs text-slate-400">{new Date(realData.time).toLocaleTimeString()}</span>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-bold ${realData.risk_score > 80 ? 'border-rose-500/20 bg-rose-500/10 text-rose-500' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'}`}>
          <Trans text="Alert" />: {realData.early_warning ?? realData.risk_score}/100
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400"><Trans text="Likely cause" /></span>
          <span className="font-mono text-emerald-400">{formatCauseLabel(realData.likely_cause, language)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400"><Trans text="Volume Z" /></span>
          <span className="font-mono text-cyan-400">{Number(realData.volume_spike || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400"><Trans text="Confidence" /></span>
          <span className="font-mono text-slate-200">{realData.confidence ?? 0}/100</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <p className="text-xs leading-relaxed text-slate-300">
          <span className="font-bold text-cyan-500"><Trans text="Supervisor" />: </span>
          {summary}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          <Trans text={sourceLabel} />
        </p>
      </div>
    </div>
  );
};

function buildSummary(realData: RealData) {
  const cause = realData.likely_cause || 'balanced_market';
  const risk = Math.round(realData.early_warning ?? realData.risk_score ?? 0);
  const confidence = Math.round(realData.confidence ?? 0);
  const volume = Number(realData.volume_spike || 0).toFixed(2);
  const provided = realData.summary?.trim();
  const generic = !provided ||
    provided.includes('The data does not show one clear dominant cause') ||
    provided === 'Scanner signal';

  if (!generic) return provided;
  if (confidence <= 0) return 'This cached card has limited analysis data. Open the pair to run a fresh movement check.';
  if (cause === 'balanced_market') return `No dominant movement source. Risk is ${risk}/100, confidence is ${confidence}/100, and volume anomaly is ${volume}.`;
  if (cause === 'whale_push') return `Large trade and liquidity pressure dominate this move. Whale trace risk is ${risk}/100 with ${confidence}/100 confidence.`;
  if (cause === 'fraud_pump_risk' || cause === 'fomo_trap') return `The move has manipulation-like pressure. Risk is ${risk}/100 and volume anomaly is ${volume}.`;
  if (cause === 'thin_liquidity_move') return `Liquidity looks thin, so the move can be easier to distort. Risk is ${risk}/100 with ${confidence}/100 confidence.`;
  if (cause === 'news_social_catalyst') return `External news or social activity appears to be the main catalyst. Confidence is ${confidence}/100.`;
  return `The move is classified as ${cause.replaceAll('_', ' ')} with ${confidence}/100 confidence.`;
}

export default ScanningCard;
