import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36";
const SEARCH_TIMEOUT_MS = 4500;
export type SearchHit = { title: string; url: string; snippet: string; engine: string };

function cleanDuckUrl(href: string) {
  try {
    if (href.startsWith("//duckduckgo.com/l/?")) {
      const u = new URL(`https:${href}`);
      return decodeURIComponent(u.searchParams.get("uddg") || href);
    }
    return href;
  } catch { return href; }
}

function cleanGoogleUrl(href: string) {
  try {
    if (href.startsWith("/url?")) {
      const u = new URL(`https://www.google.com${href}`);
      return u.searchParams.get("q") || href;
    }
    return href;
  } catch { return href; }
}

async function retryFetch(url: string, init: RequestInit, attempts = 1) {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
      last = res;
      if (res.ok || ![429, 500, 502, 503, 504].includes(res.status)) return res;
    } catch {}
  }
  return last;
}

async function google(query: string): Promise<SearchHit[]> {
  const url = `https://www.google.com/search?num=20&hl=id&q=${encodeURIComponent(query)}`;
  const res = await retryFetch(url, { headers: { "user-agent": UA, accept: "text/html", "accept-language": "id-ID,id;q=0.9,en;q=0.7" } });
  if (!res?.ok) return [];
  const $ = cheerio.load(await res.text());
  const hits: SearchHit[] = [];
  $("a").each((_, el) => {
    const a = $(el);
    const h3 = a.find("h3").first();
    const href = a.attr("href");
    if (!href || !h3.length) return;
    const cleaned = cleanGoogleUrl(href);
    if (!/^https?:\/\//.test(cleaned)) return;
    try { if (/google\./i.test(new URL(cleaned).hostname)) return; } catch { return; }
    const container = a.closest("div");
    const snippet = container.parent().text().replace(/\s+/g, " ").trim().slice(0, 500);
    hits.push({ title: h3.text().trim(), url: cleaned, snippet, engine: "Google" });
  });
  return hits.slice(0, 15);
}

async function ddg(query: string): Promise<SearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await retryFetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res?.ok) return [];
  const $ = cheerio.load(await res.text());
  const hits: SearchHit[] = [];
  $(".result").each((_, el) => {
    const a = $(el).find(".result__a").first();
    const href = a.attr("href");
    if (!href) return;
    hits.push({ title: a.text().trim(), url: cleanDuckUrl(href), snippet: $(el).find(".result__snippet").text().trim(), engine: "DuckDuckGo" });
  });
  return hits.slice(0, 15);
}

async function bing(query: string): Promise<SearchHit[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;
  const res = await retryFetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res?.ok) return [];
  const $ = cheerio.load(await res.text());
  const hits: SearchHit[] = [];
  $("li.b_algo").each((_, el) => {
    const a = $(el).find("h2 a").first();
    const href = a.attr("href");
    if (!href) return;
    hits.push({ title: a.text().trim(), url: href, snippet: $(el).find(".b_caption p").first().text().trim(), engine: "Bing" });
  });
  return hits.slice(0, 15);
}

export async function searchWeb(query: string, max = 36): Promise<SearchHit[]> {
  const settled = await Promise.allSettled([google(query), ddg(query), bing(query)]);
  const merged = settled.flatMap((x) => x.status === "fulfilled" ? x.value : []);
  const seen = new Set<string>();
  return merged.filter((hit) => {
    const key = hit.url.replace(/\/$/, "");
    if (!/^https?:\/\//.test(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, max);
}
