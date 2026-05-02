import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"] as const;
const OPENROUTER_MODEL = "openrouter/free";

function getGeminiApiKey() {
  return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";
}

function getOpenRouterApiKey() {
  return Deno.env.get("OPENROUTER_API_KEY") || "";
}

function isValidLanguage(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(value);
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("non_json_translation");
    return JSON.parse(match[0]);
  }
}

async function translateWithGemini(texts: string[], targetLanguage: string) {
  const key = getGeminiApiKey();
  if (!key) return null;

  const prompt = `Translate these UI strings into ${targetLanguage}. Use simple, professional language for a crypto market intelligence product. Keep brand names, ticker symbols, numbers, JSON keys, and % signs unchanged. Return only JSON: {"translations":["..."]}\n${JSON.stringify({ texts })}`;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = parseJson(text);
      if (Array.isArray(parsed.translations)) return parsed.translations.map(String);
    } catch (_) {
      continue;
    }
  }
  return null;
}

async function translateWithOpenRouter(texts: string[], targetLanguage: string) {
  const key = getOpenRouterApiKey();
  if (!key) return null;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://wwdnuxpzsmdbeffhdsoy.supabase.co",
      "X-OpenRouter-Title": "Shepard Advisor UI Translation",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: "Return only valid JSON. Translate UI strings simply and professionally." },
        { role: "user", content: `Target language: ${targetLanguage}\n${JSON.stringify({ texts })}\nReturn {"translations":["..."]}` },
      ],
      temperature: 0.1,
      max_tokens: 900,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const parsed = parseJson(data.choices?.[0]?.message?.content || "{}");
  return Array.isArray(parsed.translations) ? parsed.translations.map(String) : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const texts = Array.isArray(body.texts) ? body.texts.map(String).slice(0, 80) : [];
  const targetLanguage = isValidLanguage(body.targetLanguage) ? body.targetLanguage : "tr";
  if (!texts.length) {
    return new Response(JSON.stringify({ translations: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (targetLanguage === "en") {
    return new Response(JSON.stringify({ translations: texts, source: "identity" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const translations = await translateWithGemini(texts, targetLanguage) || await translateWithOpenRouter(texts, targetLanguage) || texts;
  return new Response(JSON.stringify({ translations, source: translations === texts ? "fallback" : "ai" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
