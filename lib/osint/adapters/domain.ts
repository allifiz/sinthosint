import type { Adapter } from "../types";
import { extractFromText, extractFromUrl } from "../extractor";

async function jsonFetch(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store", headers: { accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

export const domainAdapter: Adapter = {
  name: "Domain/Web OSINT",
  supports: ["domain"],
  async search(entity) {
    const domain = entity.normalized;
    const [dns, certs, rdap] = await Promise.all([
      jsonFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`),
      jsonFetch(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`),
      jsonFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`),
    ]);
    const entities = [] as ReturnType<typeof extractFromText>;
    const findings = [];

    if (dns?.Answer) findings.push({ title: `DNS A records for ${domain}`, url: `https://${domain}`, snippet: dns.Answer.map((x: { data?: string }) => x.data).filter(Boolean).join(", "), source: "Cloudflare DNS" });
    if (Array.isArray(certs)) {
      const names = new Set<string>();
      for (const cert of certs.slice(0, 100)) for (const n of String(cert.name_value || "").split("\n")) if (n && !n.startsWith("*.")) names.add(n.toLowerCase());
      for (const n of [...names].slice(0, 20)) entities.push({ type: "domain", value: n, normalized: n, source: "crt.sh", confidence: 65, metadata: { parent: domain } });
      findings.push({ title: `Certificate transparency (${names.size} names)`, url: `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}`, snippet: [...names].slice(0, 8).join(", "), source: "crt.sh" });
    }
    if (rdap) {
      const raw = JSON.stringify(rdap).slice(0, 12000);
      entities.push(...extractFromText(raw, "RDAP"));
      findings.push({ title: `RDAP record for ${domain}`, url: `https://rdap.org/domain/${domain}`, snippet: [rdap.ldhName, rdap.handle, rdap.status?.join?.(", ")].filter(Boolean).join(" · "), source: "RDAP" });
    }
    entities.push(...extractFromUrl(`https://${domain}`, "domain-seed"));
    return { entities, findings };
  },
};
