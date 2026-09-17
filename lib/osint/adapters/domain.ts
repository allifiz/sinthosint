import * as cheerio from "cheerio";
import type { Adapter } from "../types";
import { extractFromText, extractFromUrl } from "../extractor";

async function jsonFetch(url: string, timeout = 9000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout), cache: "no-store", headers: { accept: "application/json", "user-agent": "SinthOSINT/0.2" } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function dns(domain: string, type: string) {
  return jsonFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`);
}

async function httpMetadata(domain: string) {
  try {
    const res = await fetch(`https://${domain}`, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(9000), headers: { "user-agent": "Mozilla/5.0 (compatible; SinthOSINT/0.2)" } });
    const raw = (await res.text()).slice(0, 600_000);
    const $ = cheerio.load(raw);
    return {
      finalUrl: res.url,
      status: res.status,
      server: res.headers.get("server") || "",
      poweredBy: res.headers.get("x-powered-by") || "",
      title: $("title").text().trim(),
      description: $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "",
      text: $("body").text().replace(/\s+/g, " ").slice(0, 18000),
    };
  } catch { return null; }
}

export const domainAdapter: Adapter = {
  name: "Domain/Web Deep OSINT",
  supports: ["domain"],
  async search(entity) {
    const domain = entity.normalized;
    const [a, aaaa, mx, ns, txt, certs, rdap, wayback, http] = await Promise.all([
      dns(domain, "A"), dns(domain, "AAAA"), dns(domain, "MX"), dns(domain, "NS"), dns(domain, "TXT"),
      jsonFetch(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`, 12000),
      jsonFetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, 10000),
      jsonFetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`${domain}/*`)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=urlkey&limit=25`, 12000),
      httpMetadata(domain),
    ]);

    const entities = [] as ReturnType<typeof extractFromText>;
    const findings = [];
    const dnsSets: Array<[string, any]> = [["A", a], ["AAAA", aaaa], ["MX", mx], ["NS", ns], ["TXT", txt]];
    for (const [type, data] of dnsSets) {
      const values = data?.Answer?.map((x: { data?: string }) => x.data).filter(Boolean) || [];
      if (values.length) {
        findings.push({ title: `DNS ${type} records`, url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, snippet: values.slice(0, 15).join(" · "), source: "Cloudflare DNS" });
        entities.push(...extractFromText(values.join(" "), `DNS-${type}`));
      }
    }

    if (Array.isArray(certs)) {
      const names = new Set<string>();
      for (const cert of certs.slice(0, 500)) {
        for (const n of String(cert.name_value || "").split("\n")) {
          const clean = n.trim().toLowerCase().replace(/^\*\./, "");
          if (clean && (clean === domain || clean.endsWith(`.${domain}`))) names.add(clean);
        }
      }
      for (const n of [...names].slice(0, 80)) entities.push({ type: "domain", value: n, normalized: n, source: "crt.sh", confidence: 68, metadata: { parent: domain } });
      findings.push({ title: `Certificate transparency (${names.size} names)`, url: `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}`, snippet: [...names].slice(0, 16).join(", "), source: "crt.sh" });
    }

    if (rdap) {
      const raw = JSON.stringify(rdap).slice(0, 30000);
      entities.push(...extractFromText(raw, "RDAP"));
      const registrar = rdap.entities?.find?.((e: any) => e.roles?.includes?.("registrar"));
      const regName = registrar?.vcardArray?.[1]?.find?.((x: any[]) => x?.[0] === "fn")?.[3];
      const events = (rdap.events || []).map((e: any) => `${e.eventAction}:${e.eventDate}`).join(" · ");
      findings.push({ title: `RDAP record for ${domain}`, url: `https://rdap.org/domain/${domain}`, snippet: [regName, rdap.status?.join?.(", "), events].filter(Boolean).join(" · ").slice(0, 650), source: "RDAP" });
    }

    if (Array.isArray(wayback) && wayback.length > 1) {
      const rows = wayback.slice(1) as string[][];
      for (const row of rows) if (row?.[1]) entities.push(...extractFromUrl(row[1], "Wayback"));
      findings.push({ title: `Wayback Machine (${rows.length} archived URLs)`, url: `https://web.archive.org/web/*/${domain}/*`, snippet: rows.slice(0, 10).map((r) => `${r[0]} ${r[1]}`).join(" · ").slice(0, 900), source: "Wayback CDX" });
    }

    if (http) {
      entities.push(...extractFromText(`${http.title} ${http.description} ${http.text}`, "HTTP Metadata"));
      entities.push(...extractFromUrl(http.finalUrl, "HTTP Redirect"));
      findings.push({ title: http.title || `HTTP profile for ${domain}`, url: http.finalUrl || `https://${domain}`, snippet: [`HTTP ${http.status}`, http.server && `server=${http.server}`, http.poweredBy && `powered-by=${http.poweredBy}`, http.description].filter(Boolean).join(" · ").slice(0, 700), source: "HTTP Metadata" });
    }

    entities.push(...extractFromUrl(`https://${domain}`, "domain-seed"));
    return { entities, findings };
  },
};
