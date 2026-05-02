// Legacy client-side market source analysis.

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent';

export interface AIAnalysisResult {
  isOrganic: boolean;
  whaleMovementProbability: number; // 0-100
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  riskAnalysis: string;
  tradingAdvice: string;
  warningSignals: string[];
  marketState: string;
}

export interface PumpAnalysisInput {
  symbol: string;
  price: number;
  priceChange: number;
  volume: number;
  avgVolume: number;
  volumeMultiplier: number;
}

// Analyze if pump is organic or manipulation
export async function analyzePumpWithAI(input: PumpAnalysisInput): Promise<AIAnalysisResult> {
  if (!GEMINI_API_KEY) {
    console.warn('AI key not found, returning deterministic analysis');
    return getDefaultAnalysis(input);
  }

  try {
    const prompt = `You are an expert crypto market analyst. Analyze this pump detection:

Symbol: ${input.symbol}
Current Price: $${input.price}
Price Change: +${input.priceChange.toFixed(2)}%
Current Volume: $${input.volume.toFixed(0)}
Average Volume (20 periods): $${input.avgVolume.toFixed(0)}
Volume Multiplier: ${input.volumeMultiplier.toFixed(2)}x

Market Context: Current market is in a volatile state with mixed sentiment.

Analyze:
1. Is this pump organic or likely manipulation/whale movement?
2. What is the whale movement probability (0-100)?
3. Risk level: Low/Moderate/High/Critical
4. Detailed risk analysis (2-3 sentences)
5. Risk note without buy/sell instructions
6. Warning signals to watch for

Respond ONLY with a valid JSON object in this exact format:
{
  "isOrganic": true/false,
  "whaleMovementProbability": 0-100,
  "riskLevel": "Low/Moderate/High/Critical",
  "riskAnalysis": "detailed analysis here",
  "tradingAdvice": "risk note here",
  "warningSignals": ["signal1", "signal2", "signal3"],
  "marketState": "brief market state description"
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from AI response:', text);
      return getDefaultAnalysis(input);
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    // Validate and ensure all required fields exist
    return {
      isOrganic: analysis.isOrganic ?? false,
      whaleMovementProbability: analysis.whaleMovementProbability ?? 50,
      riskLevel: analysis.riskLevel ?? 'Moderate',
      riskAnalysis: analysis.riskAnalysis ?? 'Analysis unavailable',
      tradingAdvice: analysis.tradingAdvice ?? 'Proceed with caution',
      warningSignals: Array.isArray(analysis.warningSignals) ? analysis.warningSignals : ['Monitor closely'],
      marketState: analysis.marketState ?? 'Mixed market conditions'
    };

  } catch (error) {
    console.error('Error getting AI analysis:', error);
    return getDefaultAnalysis(input);
  }
}

// Get default analysis when AI is unavailable
function getDefaultAnalysis(input: PumpAnalysisInput): AIAnalysisResult {
  const isHighVolume = input.volumeMultiplier > 4.0;
  const isHighPriceChange = input.priceChange > 5.0;
  
  let riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Moderate';
  let whaleMovementProbability = 50;

  if (input.volumeMultiplier > 8 && input.priceChange > 10) {
    riskLevel = 'Critical';
    whaleMovementProbability = 90;
  } else if (isHighVolume && isHighPriceChange) {
    riskLevel = 'High';
    whaleMovementProbability = 75;
  } else if (isHighVolume || isHighPriceChange) {
    riskLevel = 'Moderate';
    whaleMovementProbability = 60;
  } else {
    riskLevel = 'Low';
    whaleMovementProbability = 30;
  }

  let tradingAdvice: string;
  switch (riskLevel) {
    case 'High':
      tradingAdvice = 'High risk detected. Wait for more confirmation.';
      break;
    case 'Critical':
      tradingAdvice = 'Critical risk detected. The move may be manipulated.';
      break;
    case 'Moderate':
      tradingAdvice = 'Moderate risk. Watch volume and liquidity before acting.';
      break;
    case 'Low':
      tradingAdvice = 'Lower risk signal. Keep watching trend quality.';
      break;
    default:
      tradingAdvice = 'Proceed with caution and monitor closely.';
  }

  return {
    isOrganic: input.volumeMultiplier < 3.5 && input.priceChange < 5.0,
    whaleMovementProbability,
    riskLevel,
    riskAnalysis: `Detected ${input.priceChange.toFixed(1)}% price increase with ${input.volumeMultiplier.toFixed(1)}x volume spike. ${isHighVolume ? 'Abnormal volume suggests possible whale activity.' : 'Volume levels within acceptable range.'} Monitor for continuation or reversal signals.`,
    tradingAdvice,
    warningSignals: [
      isHighVolume ? 'Abnormally high volume spike' : 'Volume within normal range',
      isHighPriceChange ? 'Rapid price movement' : 'Gradual price increase',
      'Monitor order book depth',
      'Watch for sudden reversals'
    ],
    marketState: 'Current market conditions show mixed signals with moderate volatility'
  };
}

// Batch analyze multiple pumps
export async function batchAnalyzePumps(
  inputs: PumpAnalysisInput[],
  delayMs: number = 1000
): Promise<Map<string, AIAnalysisResult>> {
  const results = new Map<string, AIAnalysisResult>();
  
  for (const input of inputs) {
    const analysis = await analyzePumpWithAI(input);
    results.set(input.symbol, analysis);
    
    // Add delay between API calls to avoid rate limits
    if (inputs.length > 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

// Quick risk assessment without full AI analysis
export function quickRiskAssessment(input: PumpAnalysisInput): {
  riskLevel: string;
  shouldAlert: boolean;
} {
  const volumeScore = Math.min(input.volumeMultiplier / 5, 1) * 40;
  const priceScore = Math.min(input.priceChange / 10, 1) * 60;
  const totalScore = volumeScore + priceScore;
  
  let riskLevel = 'Low';
  let shouldAlert = false;
  
  if (totalScore > 75) {
    riskLevel = 'Critical';
    shouldAlert = true;
  } else if (totalScore > 60) {
    riskLevel = 'High';
    shouldAlert = true;
  } else if (totalScore > 40) {
    riskLevel = 'Moderate';
    shouldAlert = true;
  }
  
  return { riskLevel, shouldAlert };
}

// Layer 3 AI analysis interface - validates and interprets the base risk score
export interface Layer3AnalysisInput {
  symbol: string;
  baseRiskScore: number; // 0-100 from Layer 2
  rsi: number;
  isThin: boolean; // thin orderbook
}

export interface Layer3AIResult {
  final_risk_score: number;
  verdict: string;
  likely_scenario: string;
  short_comment: string;
}

// Layer 3: legacy qualitative source analysis.
export async function analyzeWithLayer3AI(input: Layer3AnalysisInput): Promise<Layer3AIResult | null> {
  if (!GEMINI_API_KEY) {
    console.warn('AI key not found, returning deterministic Layer 3 analysis');
    return getDefaultLayer3Analysis(input);
  }

  try {
    // Use the browser-compatible GoogleGenerativeAI SDK
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Use the correct model name for browser context
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `ROLE: You are a cynical crypto risk analyst. You look for traps.

INPUT DATA:
- Symbol: ${input.symbol}
- Math Risk Score: ${input.baseRiskScore}/100
- RSI: ${input.rsi}
- Orderbook Status: ${input.isThin ? 'Thin' : 'Normal'}

TASK:
1. Validate the Risk Score. Does it make sense?
2. Provide a 1-sentence 'Verdict' (Warning or Opportunity).
3. Identify the 'Likely Scenario' (e.g., 'FOMO Trap', 'Whale Manipulation', 'Organic Breakout').

OUTPUT: JSON only with these exact keys:
{
  "final_risk_score": (Integer between 0-100),
  "verdict": "One sentence verdict",
  "likely_scenario": "Scenario name",
  "short_comment": "Brief advice"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up JSON response (sometimes comes wrapped in markdown)
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const analysis = JSON.parse(text);

    // Validate and ensure all required fields exist
    return {
      final_risk_score: Math.max(0, Math.min(100, analysis.final_risk_score ?? input.baseRiskScore)),
      verdict: analysis.verdict ?? 'Analysis inconclusive',
      likely_scenario: analysis.likely_scenario ?? 'Unknown scenario',
      short_comment: analysis.short_comment ?? 'Monitor closely'
    };

  } catch (error) {
    console.error('Error getting Layer 3 AI analysis:', error);
    // Provide detailed error for debugging
    console.error('Layer 3 provider error details:', {
      message: error.message,
      symbol: input.symbol,
      inputData: input
    });
    return getDefaultLayer3Analysis(input);
  }
}

// Get default Layer 3 analysis when AI is unavailable
function getDefaultLayer3Analysis(input: Layer3AnalysisInput): Layer3AIResult {
  let verdict = 'Caution advised';
  let likely_scenario = 'Uncertain market condition';
  let short_comment = 'Continue monitoring';
  let adjustedScore = input.baseRiskScore;

  if (input.baseRiskScore >= 70) {
    verdict = 'High risk warning';
    likely_scenario = input.isThin ? 'Thin orderbook trap' : 'Whale manipulation suspected';
    short_comment = 'Wait for cleaner confirmation';
    adjustedScore = Math.min(100, adjustedScore + 5); // Slight upward adjustment for caution
  } else if (input.baseRiskScore >= 40) {
    verdict = 'Moderate opportunity';
    likely_scenario = 'Balanced market movement';
    short_comment = 'Watch for confirmation';
  } else {
    verdict = 'Lower risk opportunity';
    likely_scenario = 'Healthy market traction';
    short_comment = 'Lower risk signal';
    adjustedScore = Math.max(0, adjustedScore - 3); // Slight downward adjustment
  }

  // Factor in RSI for additional context
  if (input.rsi > 85) {
    short_comment += ' (Overbought RSI)';
    adjustedScore = Math.min(100, adjustedScore + 10);
  } else if (input.rsi < 20) {
    short_comment += ' (Oversold RSI)';
    adjustedScore = Math.max(0, adjustedScore - 10);
  }

  return {
    final_risk_score: adjustedScore,
    verdict,
    likely_scenario,
    short_comment
  };
}
