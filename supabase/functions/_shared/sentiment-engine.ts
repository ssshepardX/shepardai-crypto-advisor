import { clamp, fetchTopSymbols, normalizeSymbol, round } from "./analysis-engine.ts";

export type SentimentLabel = "bad" | "neutral" | "good";
export type TrendDirection = "up" | "down" | "flat";

export type SentimentItem = {
  provider: "news" | "reddit" | "asia_watch" | "cryptopanic" | "coingecko" | "x";
  title_hash: string;
  url?: string;
  domain?: string;
  score: number;
  catalyst_terms: string[];
  created_hint?: string;
};

export type SentimentResult = {
  symbol: string;
  source_json: {
    providers: Record<string, { status: string; count: number; error?: string; rate_remaining?: string | null }>;
    items: SentimentItem[];
    top_catalyst_terms: string[];
  };
  score_json: {
    sentiment_score: number;
    sentiment_label: SentimentLabel;
    mention_score: number;
    source_confidence: number;
    source_count: number;
    good_count: number;
    bad_count: number;
    neutral_count: number;
  };
  trend_json: {
    trend_direction: TrendDirection;
    reason_short: string;
    reason_short_en: string;
    asia_watch_score: number;
    reddit_heat: number;
    news_mood: number;
    most_mentioned_rank?: number;
  };
};

const POSITIVE = ["listing", "partnership", "approval", "etf", "upgrade", "mainnet", "inflow", "adoption", "burn", "launch", "integrat", "funding", "record high"];
const NEGATIVE = ["hack", "exploit", "lawsuit", "sec", "delist", "scam", "fraud", "rug", "outflow", "investigation", "halt", "ban", "breach"];
const RISK = ["whale", "transfer", "unlock", "liquidation", "bridge", "exchange halt", "suspicious", "dump"];
const TERMS = Array.from(new Set([...POSITIVE, ...NEGATIVE, ...RISK, "airdrop", "china", "korea", "japan", "hong kong", "binance", "coinbase"]));
const NEWS_FEEDS = [
  "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "https://cointelegraph.com/rss",
  "https://decrypt.co/feed",
  "https://cryptoslate.com/feed/",
];
const ASIA_FEEDS = [
  "https://coinpost.jp/?feed=rss2",
  "https://blockmedia.co.kr/feed",
  "https://news.bitcoin.com/feed/",
];
const ASSET_NAMES: Record<string, string[]> = {
  BTC: ["btc", "bitcoin"],
  ETH: ["eth", "ethereum", "ether"],
  SOL: ["sol", "solana"],
  BNB: ["bnb", "binance"],
  XRP: ["xrp", "ripple"],
  DOGE: ["doge", "dogecoin"],
  ADA: ["ada", "cardano"],
  AVAX: ["avax", "avalanche"],
  TON: ["ton", "toncoin"],
  TRX: ["trx", "tron"],
  LINK: ["link", "chainlink"],
  DOT: ["dot", "polkadot"],
  MATIC: ["matic", "polygon"],
  POL: ["pol", "polygon"],
  SHIB: ["shib", "shiba"],
};

function baseAsset(symbol: string) {
  return normalizeSymbol(symbol).replace(/USDT$/, "");
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

async function hashText(text: string) {
  const data = new TextEncoder().encode(text.slice(0, 500));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function sentimentScore(text: string) {
  const lower = text.toLowerCase();
  const pos = POSITIVE.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  const neg = NEGATIVE.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  const risk = RISK.reduce((sum, word) => sum + (lower.includes(word) ? 0.45 : 0), 0);
  return clamp(50 + pos * 11 - neg * 14 - risk * 5, 0, 100);
}

export function sentimentLabel(score: number): SentimentLabel {
  if (score >= 62) return "good";
  if (score <= 38) return "bad";
  return "neutral";
}

function catalystTerms(text: string) {
  const lower = text.toLowerCase();
  return TERMS.filter((term) => lower.includes(term)).slice(0, 8);
}

async function item(provider: SentimentItem["provider"], title: string, snippet = "", url = "", created_hint = ""): Promise<SentimentItem> {
  const text = `${title} ${snippet}`;
  return {
    provider,
    title_hash: await hashText(`${provider}:${title}:${url}`),
    url: url || undefined,
    domain: url ? domainFromUrl(url) : undefined,
    score: round(sentimentScore(text), 0),
    catalyst_terms: catalystTerms(text),
    created_hint,
  };
}

function stripXml(text = "") {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gis, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return stripXml(match?.[1] || "");
}

function aliases(symbol: string) {
  const asset = baseAsset(symbol);
  return Array.from(new Set([asset.toLowerCase(), symbol.toLowerCase(), ...(ASSET_NAMES[asset] || [])]));
}

function matchesSymbol(symbol: string, text: string) {
  const lower = text.toLowerCase();
  return aliases(symbol).some((alias) => lower.includes(alias));
}

async function rssFeed(url: string, provider: "news" | "asia_watch", symbol: string): Promise<SentimentItem[]> {
  const response = await fetch(url, { headers: { "User-Agent": "ShepardAI/1.0" } });
  if (!response.ok) throw new Error(`rss_${response.status}`);
  const xml = await response.text();
  const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]).slice(0, 25);
  const rows = blocks
    .map((block) => {
      const title = tag(block, "title");
      const snippet = tag(block, "description");
      const link = tag(block, "link");
      const created = tag(block, "pubDate");
      return { title, snippet, link, created };
    })
    .filter((row) => row.title && matchesSymbol(symbol, `${row.title} ${row.snippet}`))
    .slice(0, 8);
  return Promise.all(rows.map((row) => item(provider, row.title, row.snippet, row.link, row.created)));
}

async function rssSearch(symbol: string, provider: "news" | "asia_watch", feeds: string[]): Promise<{ status: string; items: SentimentItem[]; error?: string }> {
  try {
    const settled = await Promise.allSettled(feeds.map((feed) => rssFeed(feed, provider, symbol)));
    const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const failed = settled.filter((result) => result.status === "rejected").length;
    return { status: items.length || failed < feeds.length ? "configured" : "provider_error", items, error: failed ? `${failed}_feed_failed` : undefined };
  } catch (error) {
    return { status: "provider_error", items: [], error: error instanceof Error ? error.message : "rss_error" };
  }
}

async function redditToken() {
  const clientId = Deno.env.get("REDDIT_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("REDDIT_CLIENT_SECRET") || "";
  const userAgent = Deno.env.get("REDDIT_USER_AGENT") || "shepard-ai/1.0";
  if (!clientId || !clientSecret) return null;
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`reddit_oauth_${response.status}`);
  const data = await response.json();
  return String(data.access_token || "");
}

async function redditSearch(symbol: string): Promise<{ status: string; items: SentimentItem[]; error?: string; rate_remaining?: string | null }> {
  if (!Deno.env.get("REDDIT_CLIENT_ID") || !Deno.env.get("REDDIT_CLIENT_SECRET")) return { status: "not_configured", items: [] };
  try {
    const token = await redditToken();
    if (!token) return { status: "not_configured", items: [] };
    const userAgent = Deno.env.get("REDDIT_USER_AGENT") || "shepard-ai/1.0";
    const asset = baseAsset(symbol);
    const query = encodeURIComponent(`"${asset}" OR "${symbol}"`);
    const subreddits = "CryptoCurrency+CryptoMarkets+Bitcoin+ethereum+solana+altcoin";
    const response = await fetch(`https://oauth.reddit.com/r/${subreddits}/search?q=${query}&restrict_sr=1&sort=new&t=day&limit=20`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent },
    });
    if (!response.ok) throw new Error(`reddit_search_${response.status}`);
    const data = await response.json();
    const posts = data?.data?.children?.map((child: { data: { title?: string; selftext?: string; permalink?: string; created_utc?: number } }) => child.data) || [];
    return {
      status: "configured",
      rate_remaining: response.headers.get("x-ratelimit-remaining"),
      items: await Promise.all(posts.map((post: { title?: string; selftext?: string; permalink?: string; created_utc?: number }) =>
        item("reddit", post.title || "", post.selftext || "", post.permalink ? `https://reddit.com${post.permalink}` : "", post.created_utc ? new Date(post.created_utc * 1000).toISOString() : ""),
      )),
    };
  } catch (error) {
    return { status: "provider_error", items: [], error: error instanceof Error ? error.message : "unknown_error" };
  }
}

async function cryptoPanic(symbol: string): Promise<{ status: string; items: SentimentItem[]; error?: string }> {
  if (Deno.env.get("ENABLE_PAID_SENTIMENT_PROVIDERS") !== "true") return { status: "disabled_free_mode", items: [] };
  const token = Deno.env.get("CRYPTOPANIC_API_TOKEN") || "";
  if (!token) return { status: "not_configured", items: [] };
  try {
    const asset = baseAsset(symbol);
    const response = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=${token}&currencies=${asset}&public=true`);
    if (!response.ok) throw new Error(`cryptopanic_${response.status}`);
    const data = await response.json();
    const rows = Array.isArray(data.results) ? data.results.slice(0, 10) : [];
    return {
      status: "configured",
      items: await Promise.all(rows.map((row: { title?: string; url?: string; published_at?: string; votes?: { positive?: number; negative?: number } }) => {
        const voteText = ` positive ${row.votes?.positive || 0} negative ${row.votes?.negative || 0}`;
        return item("cryptopanic", row.title || "", voteText, row.url || "", row.published_at || "");
      })),
    };
  } catch (error) {
    return { status: "provider_error", items: [], error: error instanceof Error ? error.message : "unknown_error" };
  }
}

async function coinGeckoNews(symbol: string): Promise<{ status: string; items: SentimentItem[]; error?: string }> {
  if (Deno.env.get("ENABLE_PAID_SENTIMENT_PROVIDERS") !== "true") return { status: "disabled_free_mode", items: [] };
  const key = Deno.env.get("COINGECKO_API_KEY") || "";
  if (!key) return { status: "not_configured", items: [] };
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/news", { headers: { "x-cg-demo-api-key": key, "x-cg-pro-api-key": key } });
    if (!response.ok) throw new Error(`coingecko_${response.status}`);
    const data = await response.json();
    const asset = baseAsset(symbol).toLowerCase();
    const rows = (Array.isArray(data.data) ? data.data : []).filter((row: { title?: string; description?: string }) =>
      `${row.title || ""} ${row.description || ""}`.toLowerCase().includes(asset),
    ).slice(0, 10);
    return {
      status: "configured",
      items: await Promise.all(rows.map((row: { title?: string; description?: string; url?: string; updated_at?: string }) => item("coingecko", row.title || "", row.description || "", row.url || "", row.updated_at || ""))),
    };
  } catch (error) {
    return { status: "provider_error", items: [], error: error instanceof Error ? error.message : "unknown_error" };
  }
}

function xStatus(): { status: string; items: SentimentItem[] } {
  return { status: Deno.env.get("X_API_BEARER_TOKEN") ? "configured_disabled" : "not_configured", items: [] };
}

function aggregate(symbol: string, providerResults: Record<string, { status: string; items: SentimentItem[]; error?: string; rate_remaining?: string | null }>, rank?: number): SentimentResult {
  const unique = new Map<string, SentimentItem>();
  for (const result of Object.values(providerResults)) {
    for (const row of result.items) unique.set(row.url || row.title_hash, row);
  }
  const items = Array.from(unique.values());
  const sourceCount = items.length;
  const avg = sourceCount ? items.reduce((sum, row) => sum + row.score, 0) / sourceCount : 50;
  const good = items.filter((row) => row.score >= 62).length;
  const bad = items.filter((row) => row.score <= 38).length;
  const neutral = Math.max(0, sourceCount - good - bad);
  const terms = Array.from(new Set(items.flatMap((row) => row.catalyst_terms))).slice(0, 8);
  const redditHeat = providerResults.reddit?.items.length || 0;
  const asiaCount = providerResults.asia_watch?.items.length || 0;
  const mentionScore = clamp(sourceCount * 8 + redditHeat * 5 + asiaCount * 4, 0, 100);
  const confidence = clamp(sourceCount * 8 + Object.values(providerResults).filter((row) => row.status === "configured").length * 8, 0, 100);
  const direction: TrendDirection = mentionScore >= 55 ? "up" : mentionScore <= 20 ? "down" : "flat";
  const label = sentimentLabel(avg);
  const reasonTr = terms.length
    ? `${baseAsset(symbol)} haber ve sosyal kaynaklarda ${terms.slice(0, 3).join(", ")} başlıklarıyla konuşuluyor.`
    : `${baseAsset(symbol)} için belirgin bir haber veya sosyal katalizör bulunmadı.`;
  const reasonEn = terms.length
    ? `${baseAsset(symbol)} is being discussed around ${terms.slice(0, 3).join(", ")}.`
    : `No clear news or social catalyst found for ${baseAsset(symbol)}.`;
  return {
    symbol,
    source_json: {
      providers: Object.fromEntries(Object.entries(providerResults).map(([provider, result]) => [provider, {
        status: result.status,
        count: result.items.length,
        error: result.error,
        rate_remaining: result.rate_remaining,
      }])),
      items,
      top_catalyst_terms: terms,
    },
    score_json: {
      sentiment_score: round(avg, 0),
      sentiment_label: label,
      mention_score: round(mentionScore, 0),
      source_confidence: round(confidence, 0),
      source_count: sourceCount,
      good_count: good,
      bad_count: bad,
      neutral_count: neutral,
    },
    trend_json: {
      trend_direction: direction,
      reason_short: reasonTr,
      reason_short_en: reasonEn,
      asia_watch_score: round(clamp(asiaCount * 16), 0),
      reddit_heat: round(clamp(redditHeat * 10), 0),
      news_mood: round(avg, 0),
      most_mentioned_rank: rank,
    },
  };
}

export async function scanSymbolSentiment(symbolInput: string, rank?: number): Promise<SentimentResult> {
  const symbol = normalizeSymbol(symbolInput);
  const [news, asia, reddit, panic, gecko] = await Promise.all([
    rssSearch(symbol, "news", NEWS_FEEDS),
    rssSearch(symbol, "asia_watch", ASIA_FEEDS),
    redditSearch(symbol),
    cryptoPanic(symbol),
    coinGeckoNews(symbol),
  ]);
  return aggregate(symbol, { news, asia_watch: asia, reddit, cryptopanic: panic, coingecko: gecko, x: xStatus() }, rank);
}

export async function defaultMarketSymbols(limit = 20) {
  const symbols = await fetchTopSymbols(limit);
  return symbols.length ? symbols.slice(0, limit) : ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"].slice(0, limit);
}
