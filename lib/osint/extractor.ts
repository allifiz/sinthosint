import type { AdapterResult, Entity, EntityType } from "./types";
import { classify, normalizePhone } from "./classifier";

const EMAIL_RX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RX = /(?:\+62|62|0)8[1-9][0-9\s().-]{7,14}/g;
const SOCIAL_HOSTS = new Map<string, string>([
  ["github.com", "github"], ["instagram.com", "instagram"], ["www.instagram.com", "instagram"],
  ["tiktok.com", "tiktok"], ["www.tiktok.com", "tiktok"], ["x.com", "x"], ["twitter.com", "x"],
  ["www.linkedin.com", "linkedin"], ["linkedin.com", "linkedin"], ["reddit.com", "reddit"], ["www.reddit.com", "reddit"],
  ["medium.com", "medium"], ["dev.to", "devto"], ["pinterest.com", "pinterest"], ["www.pinterest.com", "pinterest"],
]);

function candidate(type: EntityType, value: string, source: string, confidence: number) {
  const c = classify(value);
  return { type, value, normalized: type === "phone" ? normalizePhone(value) : c.normalized, source, confidence, metadata: {} };
}

export function extractFromText(text: string, source: string): AdapterResult["entities"] {
  const entities: AdapterResult["entities"] = [];
  for (const email of text.match(EMAIL_RX) || []) entities.push(candidate("email", email, source, 72));
  for (const phone of text.match(PHONE_RX) || []) entities.push(candidate("phone", phone, source, 68));
  return entities;
}

export function extractFromUrl(raw: string, source: string): AdapterResult["entities"] {
  try {
    const url = new URL(raw);
    const entities: AdapterResult["entities"] = [];
    const social = SOCIAL_HOSTS.get(url.hostname.toLowerCase());
    const segments = url.pathname.split("/").filter(Boolean);
    if (social && segments.length) {
      let username = segments[0].replace(/^@/, "");
      if (social === "linkedin" && ["in", "company"].includes(username) && segments[1]) username = segments[1];
      if (username && !["search", "explore", "home", "share"].includes(username.toLowerCase())) {
        entities.push({ type: "username", value: username, normalized: username.toLowerCase(), source: `${source}:${social}`, confidence: 62, metadata: { platform: social, profileUrl: raw } });
      }
    }
    const host = url.hostname.replace(/^www\./, "");
    if (!SOCIAL_HOSTS.has(url.hostname.toLowerCase()) && /\./.test(host)) {
      entities.push({ type: "domain", value: host, normalized: host.toLowerCase(), source, confidence: 50, metadata: { discoveredFrom: raw } });
    }
    return entities;
  } catch {
    return [];
  }
}

export function dedupeCandidates(items: AdapterResult["entities"], parent?: Entity) {
  const map = new Map<string, AdapterResult["entities"][number]>();
  for (const item of items) {
    if (parent && item.type === parent.type && item.normalized === parent.normalized) continue;
    const key = `${item.type}:${item.normalized}`;
    const existing = map.get(key);
    if (!existing || existing.confidence < item.confidence) map.set(key, item);
  }
  return [...map.values()];
}
