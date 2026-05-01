// PROSESS 2: AI AGENT WORKER (AI Analist)
// Görevi: YAVAŞ çalışır, DB'den "PENDING" işleri alır, AI'ı çağırır,
// sonucu DB'ye yazar ve bildirimi gönderir.
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from './notificationService';
import { analyzeWithLayer3AI, type Layer3AnalysisInput } from './aiService';
import { type RiskScoreResult } from './riskScoringService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface OrderbookData {
  depth_usd: number;
  is_thin: boolean;
}

interface SocialData {
  mention_increase_percent: number;
}

interface AIAnalysisResult {
  risk_score: number;
  summary: string;
  likely_source: string;
  actionable_insight: string;
}

class AIWorkerService {
  private static instance: AIWorkerService;
  private isRunning: boolean = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private processingLock: boolean = false;

  private constructor() {}

  static getInstance(): AIWorkerService {
    if (!AIWorkerService.instance) {
      AIWorkerService.instance = new AIWorkerService();
    }
    return AIWorkerService.instance;
  }

  start(intervalMs: number = 5000): void {
    if (this.isRunning) return;
    console.log("🤖 AI Agent Worker Başlatıldı...");
    this.isRunning = true;
    this.workerInterval = setInterval(() => this.processNextJob(), intervalMs);
    console.log(`✅ AI Worker ${intervalMs}ms aralıklarla çalışıyor.`);
  }

  stop(): void {
    if (!this.isRunning) return;
    console.log("🛑 AI Agent Worker Durduruluyor...");
    if (this.workerInterval) clearInterval(this.workerInterval);
    this.isRunning = false;
    console.log("✅ AI Worker durduruldu.");
  }

  private async processNextJob(): Promise<void> {
    if (this.processingLock) return;
    this.processingLock = true;

    let currentJob = null;
    try {
      // 4.1 Find and lock pending job
      const jobs = await this.findAndLockPendingJob();

      if (!jobs || jobs.length === 0) {
        // No pending jobs available, wait silently
        return;
      }

      currentJob = jobs[0]; // Get the first job
      console.log(`Is aliniyor: ${currentJob.symbol}`);

      // 4.2 Check 15-minute cache rule
      const cacheCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentJob, error: cacheError } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('symbol', currentJob.symbol.replace('USDT', ''))
        .eq('status', 'COMPLETED')
        .gte('created_at', cacheCutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cacheError) {
        console.error('Cache kontrol hatası:', cacheError);
      } else if (recentJob) {
        console.log(`⏰ Cache bulundu (${currentJob.symbol}): ${recentJob.created_at} - Analiz atlanıyor`);
        await this.updateJobStatus(currentJob.id, "CACHED");
        return;
      }

      // 4.3 Prepare technical data (TODO: Real data collection system needed)
      const coinData = {
        symbol: currentJob.symbol,
        priceChangePercent5m: currentJob.price_change,
        volume: currentJob.volume_spike * 100000, // Estimated volume
        avgVolume: 100000, // Estimated average
        marketCap: 10000000, // Estimated market cap (passes >$10M filter)
        rsi: 70, // Default RSI - needs real calculation
        totalBidsUSD: 500000, // Default - needs real orderbook
        totalAsksUSD: 600000, // Default - needs real orderbook
        volumeToMarketCapRatio: 0.05, // Default - needs calculation
        priceChangePercent1m: currentJob.price_change
      };

      // 4.4 Layer 2: Math-based risk scoring
      const { calculateBaseRiskScore } = await import('./riskScoringService');
      const riskResult = calculateBaseRiskScore(coinData);

      if (!riskResult) {
        throw new Error("Risk scoring failed");
      }

      // 4.5 Layer 3: AI qualitative analysis
      const orderbookData = JSON.parse(currentJob.orderbook_json || '{}');
      const layer3Input: Layer3AnalysisInput = {
        symbol: currentJob.symbol,
        baseRiskScore: riskResult.base_risk_score,
        rsi: riskResult.technical_data.rsi,
        isThin: orderbookData.is_thin || false
      };

      const aiAnalysisResult = await analyzeWithLayer3AI(layer3Input);

      if (aiAnalysisResult) {
        // 4.6 Success: Map AI result to database fields
        const mappedResult = {
          risk_score: aiAnalysisResult.final_risk_score,
          summary: aiAnalysisResult.verdict,
          likely_source: aiAnalysisResult.likely_scenario,
          actionable_insight: aiAnalysisResult.short_comment
        };

        await this.updateJobWithAnalysis(currentJob.id, mappedResult, "COMPLETED");
        console.log(`✅ İş tamamlandı: ${currentJob.symbol} (Final Score: ${mappedResult.risk_score})`);

        // 4.7 Send notification if high risk
        await this.sendNotification(currentJob.symbol, mappedResult);
      } else {
        throw new Error("Layer 3 AI analysis failed");
      }
    } catch (error) {
      console.error("❌ AI Worker Hatası:", error);
      if (currentJob) {
        // 4.8 Error handling - mark job as failed
        await this.updateJobStatus(currentJob.id, "FAILED");
        console.log(`"FAIL" olarak işaretlendi: ${currentJob.symbol} (ID: ${currentJob.id})`);
      }
    } finally {
      this.processingLock = false;
    }
  }

  private async findAndLockPendingJob() {
    // Supabase'de "SELECT ... FOR UPDATE" olmadığı için,
    // bir RPC (veritabanı fonksiyonu) en iyi çözümdür.
    // Bu fonksiyon, atomik olarak bir işi bulur, durumunu günceller ve döndürür.
    const { data, error } = await supabase.rpc('find_and_lock_job');
    
    if (error) {
      console.error('findAndLockPendingJob RPC hatası:', error);
      return null;
    }
    return data;
  }

  private async updateJobWithAnalysis(jobId: string, aiResult: AIAnalysisResult, status: string) {
    const { error } = await supabase
      .from('analysis_jobs')
      .update({
        status: status,
        risk_score: aiResult.risk_score,
        summary: aiResult.summary,
        likely_source: aiResult.likely_source,
        actionable_insight: aiResult.actionable_insight,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) console.error('updateJobWithAnalysis hatası:', error);
  }

  private async updateJobStatus(jobId: string, status: string) {
    const { error } = await supabase
      .from('analysis_jobs')
      .update({ status: status, completed_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) console.error('updateJobStatus hatası:', error);
  }

  private async getGeminiStructuredAnalysis(
    modelName: string,
    symbol: string,
    priceChange: number,
    volumeSpike: number,
    orderbookData: OrderbookData,
    socialData: SocialData
  ): Promise<AIAnalysisResult | null> {
    const prompt = `TASK: You are a crypto market movement source analyst.
Analyze the provided data and assess whether the move looks organic, whale-driven, low-liquidity, or manipulated.

DATA:
- Coin: ${symbol}
- Last 1m Price Change: +${priceChange.toFixed(2)}%
- Volume Spike (vs. Avg): ${volumeSpike.toFixed(1)}x
- Order Book Depth (+/- 2%): ${orderbookData.depth_usd.toFixed(0)} USD (Status: ${orderbookData.is_thin ? 'THIN' : 'STRONG'})
- Social Media (Last 10min): ${socialData.mention_increase_percent}% increase

ANALYSIS REQUEST:
Based on this data, generate a risk analysis in the following JSON format.

PERFECT EXAMPLE OF OUTPUT:
{
  "risk_score": 95,
  "summary": "High Risk: Sudden volume spike on a thin order book.",
  "likely_source": "Possible coordinated movement",
  "actionable_insight": "Wait for stronger confirmation."
}

Output ONLY the JSON. Do not include any other explanations.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error(`AI provider error: ${response.statusText}`);
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return null;

    } catch (error) {
      console.error(`AI provider error (${symbol}):`, error);
      return null;
    }
  }

  private async sendNotification(symbol: string, analysis: AIAnalysisResult): Promise<void> {
    if (analysis.risk_score >= 75) {
      await notificationService.notifyHighRisk(
        symbol,
        analysis.risk_score,
        analysis.summary
      );
    }
  }
}

export const aiWorkerService = AIWorkerService.getInstance();
