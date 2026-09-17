import type { Adapter, AdapterResult, Entity } from "../types";
import { extractFromText, extractFromUrl } from "../extractor";

const SITES = [
  { name: "GitHub", url: (u: string) => `https://github.com/${u}`, missing: ["not found"] },
  { name: "Reddit", url: (u: string) => `https://www.reddit.com/user/${u}/`, missing: ["page not found", "nobody on reddit goes by that name"] },
  { name: "Dev.to", url: (u: string) => `https://dev.to/${u}`, missing: ["page not found"] },
  { name: "Medium", url: (u: string) => `https://medium.com/@${u}`, missing: ["page not found"] },
  { name: "Pinterest", url: (u: string) => `https://www.pinterest.com/${u}/`, missing: ["couldn't find"] },
  { name: "TikTok", url: (u: string) => `https://www.tiktok.com/@${u}`, missing: ["couldn't find this account"] },
  { name: "Instagram", url: (u: string) => `https://www.instagram.com/${u}/`, missing: ["page isn't available"] },
  { name: "X", url: (u: string) => `https://x.com/${u}`, missing: ["this account doesn’t exist", "this account doesn't exist"] },
];

const UA = "Mozilla/5.0 (compatible; SinthOSINT/0.1)";

async function probe(name: string, url: string, missing: string[], entity: Entity): Promise<AdapterResult | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(6500), cache: "no-store" });
    if (res.status === 404 || res.status === 410) return null;
    const text = (await res.text()).slice(0, 450_000);
    const lower = text.toLowerCase();
    if (missing.some((m) => lower.includes(m.toLowerCase()))) return null;
    if (!res.ok && ![401, 403, 429].includes(res.status)) return null;
    const title = text.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const desc = text.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1];
    const combined = `${title || ""} ${desc || ""}`;
    return {
      entities: [...extractFromText(combined, `maigret-style:${name}`), ...extractFromUrl(url, `maigret-style:${name}`)],
      findings: [{ title: title || `${name}: @${entity.normalized}`, url, snippet: desc || `Possible public profile for @${entity.normalized}`, source: `Maigret-style/${name}` }],
    };
  } catch {
    return null;
  }
}

export const usernameAdapter: Adapter = {
  name: "Maigret-style Username",
  supports: ["username"],
  async search(entity) {
    const settled = await Promise.all(SITES.map((site) => probe(site.name, site.url(entity.normalized), site.missing, entity)));
    return { entities: settled.flatMap((x) => x?.entities || []), findings: settled.flatMap((x) => x?.findings || []) };
  },
};
