import type { Adapter, AdapterResult, Entity } from "../types";
import { extractFromText, extractFromUrl } from "../extractor";

const UA = "Mozilla/5.0 (compatible; SinthOSINT/0.2; +https://github.com/allifiz/sinthosint)";
const MAIGRET_DB = "https://raw.githubusercontent.com/soxoj/maigret/main/maigret/resources/data.json";
const SITE_LIMIT = 320;
const CONCURRENCY = 64;
const SAFE_HEADERS = new Set(["accept", "accept-language", "referer", "user-agent", "x-ig-app-id"]);

type MaigretSite = {
  url?: string;
  urlProbe?: string;
  checkType?: string;
  presenseStrs?: string[];
  absenceStrs?: string[];
  regexCheck?: string;
  disabled?: boolean;
  type?: string;
  alexaRank?: number;
  headers?: Record<string, string>;
  tags?: string[];
};

type MaigretDb = { sites?: Record<string, MaigretSite> };
type SiteEntry = { name: string; site: MaigretSite };

let dbPromise: Promise<SiteEntry[]> | null = null;

function safeHeaders(input?: Record<string, string>) {
  const out: Record<string, string> = { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5" };
  for (const [key, value] of Object.entries(input || {})) {
    const lower = key.toLowerCase();
    if (SAFE_HEADERS.has(lower) && value && value.length < 500) out[lower] = value;
  }
  return out;
}

function isUsernameSite(site: MaigretSite) {
  if (site.disabled || !site.url) return false;
  if (site.type && !["username", "user"].includes(site.type.toLowerCase())) return false;
  if (site.regexCheck) {
    try { new RegExp(site.regexCheck); } catch { return false; }
  }
  return [undefined, "message", "status_code", "response_url"].includes(site.checkType);
}

async function loadSites() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const res = await fetch(MAIGRET_DB, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Maigret DB HTTP ${res.status}`);
      const db = await res.json() as MaigretDb;
      return Object.entries(db.sites || {})
        .filter(([, site]) => isUsernameSite(site))
        .map(([name, site]) => ({ name, site }))
        .sort((a, b) => (a.site.alexaRank ?? Number.MAX_SAFE_INTEGER) - (b.site.alexaRank ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
    })();
  }
  return dbPromise;
}

function substitute(template: string, username: string) {
  return template
    .replaceAll("{username}", encodeURIComponent(username))
    .replaceAll("{account}", encodeURIComponent(username))
    .replaceAll("{}", encodeURIComponent(username));
}

function validForSite(username: string, regexCheck?: string) {
  if (!regexCheck) return true;
  try { return new RegExp(regexCheck).test(username); } catch { return false; }
}

function normalizeHtml(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&#39;|&quot;/g, " ").replace(/\s+/g, " ").trim();
}

function displayNameCandidate(title: string, siteName: string, username: string) {
  if (!title) return null;
  let value = title
    .replace(new RegExp(`@?${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "ig"), " ")
    .replace(new RegExp(siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    .replace(/\b(profile|user|account|official|homepage|home|posts?|photos?|videos?)\b/ig, " ")
    .replace(/[|•·—–:\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  value = value.split(/\s{2,}|\(|\[/)[0]?.trim() || value;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6 || value.length < 5 || value.length > 80) return null;
  if (!words.every((w) => /^[\p{L}.'’-]+$/u.test(w))) return null;
  return value;
}

async function probe(entry: SiteEntry, entity: Entity): Promise<AdapterResult | null> {
  const { name, site } = entry;
  if (!site.url || !validForSite(entity.normalized, site.regexCheck)) return null;
  const profileUrl = substitute(site.url, entity.normalized);
  const probeUrl = substitute(site.urlProbe || site.url, entity.normalized);
  try {
    const res = await fetch(probeUrl, {
      headers: safeHeaders(site.headers),
      redirect: "follow",
      signal: AbortSignal.timeout(3200),
      cache: "no-store",
    });
    const body = (await res.text()).slice(0, 500_000);
    const lower = body.toLowerCase();
    const present = (site.presenseStrs || []).map(String);
    const absent = (site.absenceStrs || []).map(String);
    let exists = false;

    switch (site.checkType) {
      case "status_code": exists = res.status >= 200 && res.status < 400; break;
      case "response_url": exists = res.ok && !absent.some((s) => res.url.toLowerCase().includes(s.toLowerCase()) || lower.includes(s.toLowerCase())); break;
      case "message":
      default:
        if (absent.some((s) => lower.includes(s.toLowerCase()))) exists = false;
        else if (present.length) exists = present.some((s) => lower.includes(s.toLowerCase()));
        else exists = res.status >= 200 && res.status < 400;
        break;
    }
    if (!exists) return null;

    const titleRaw = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
    const descRaw = body.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1] || "";
    const title = normalizeHtml(titleRaw).slice(0, 180);
    const desc = normalizeHtml(descRaw).slice(0, 420);
    const sample = normalizeHtml(`${titleRaw} ${descRaw} ${body.slice(0, 16000)}`).slice(0, 18000);
    const source = `Maigret DB/${name}`;
    const extracted = [...extractFromText(sample, source), ...extractFromUrl(profileUrl, source)];
    const displayName = displayNameCandidate(title, name, entity.normalized);
    if (displayName) extracted.push({ type: "name", value: displayName, normalized: displayName.toLowerCase(), source, confidence: 56, metadata: { profileUrl, platform: name } });

    return {
      entities: extracted,
      findings: [{ title: title || `${name}: @${entity.normalized}`, url: profileUrl, snippet: desc || `Username ${entity.normalized} matched Maigret checks on ${name}.`, source }],
    };
  } catch { return null; }
}

async function pooled<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

export const usernameAdapter: Adapter = {
  name: "Maigret DB Username",
  supports: ["username"],
  async search(entity) {
    let sites: SiteEntry[] = [];
    try { sites = (await loadSites()).slice(0, SITE_LIMIT); } catch { return { entities: [], findings: [] }; }
    const scanned = sites.filter(({ site }) => validForSite(entity.normalized, site.regexCheck));
    const settled = await pooled(scanned, CONCURRENCY, (site) => probe(site, entity));
    const matched = settled.filter((x): x is AdapterResult => Boolean(x));
    return {
      entities: matched.flatMap((x) => x.entities),
      findings: [
        { title: `Maigret coverage: ${scanned.length} sites checked`, url: MAIGRET_DB, snippet: `${matched.length} possible public profiles matched the upstream Maigret site rules. Display names, phones, emails and linked domains are automatically queued for pivoting.`, source: "Maigret DB" },
        ...matched.flatMap((x) => x.findings),
      ],
    };
  },
};
