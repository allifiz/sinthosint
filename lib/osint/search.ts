import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; SinthOSINT/0.1; +https://github.com/allifiz/sinthosint)";

export type SearchHit = { title: string; url: string; snippet: string; engine: string };

function cleanDuckUrl(href: string) {
  try {
    if (href.startsWith("//duckduckgo.com/l/?")) {
      const u = new URL(`https:${href}`);
      return decodeURIComponent(u.searchParams.get("uddg") || href);
    }
    return href;
  } catch {
    return href;
  }
}

async function ddg(query: string): Promise<SearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) return [];
  const $ = cheerio.load(await res.text());
  const hits: SearchHit[] = [];
  $(".result").each((_, el) => {
    const a = $(el).find(".result__a").first();
    const href = a.attr("href");
    if (!href) return;
    hits.push({ title: a.text().trim(), url: cleanDuckUrl(href), snippet: $(el).find(".result__snippet").text().trim(), engine: "DuckDuckGo" });
  });
  return hits.slice(0, 8);
}

async function bing(query: string): Promise<SearchHit[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) return [];
  const $ = cheerio.load(await res.text());
  const hits: SearchHit[] = [];
  $("li.b_algo").each((_, el) => {
    const a = $(el).find("h2 a").first();
    const href = a.attr("href");
    if (!href) return;
    hits.push({ title: a.text().trim(), url: href, snippet: $(el).find(".b_caption p").first().text().trim(), engine: "Bing" });
  });
  return hits.slice(0, 8);
}

export async function searchWeb(query: string): Promise<SearchHit[]> {
  const settled = await Promise.allSettled([ddg(query), bing(query)]);
  const merged = settled.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
  const seen = new Set<string>();
  return merged.filter((hit) => {
    const key = hit.url.replace(/\/$/, "");
    if (!/^https?:\/\//.test(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}
