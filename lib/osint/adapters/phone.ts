import type { Adapter } from "../types";
import { searchWeb } from "../search";
import { extractFromText, extractFromUrl } from "../extractor";

const PREFIX: Record<string, string> = {
  "0811":"Telkomsel","0812":"Telkomsel","0813":"Telkomsel","0821":"Telkomsel","0822":"Telkomsel","0823":"Telkomsel","0851":"Telkomsel/By.U","0852":"Telkomsel","0853":"Telkomsel",
  "0855":"Indosat","0856":"Indosat","0857":"Indosat","0858":"Indosat","0814":"Indosat","0815":"Indosat","0816":"Indosat",
  "0817":"XL","0818":"XL","0819":"XL","0838":"XL","0839":"XL","0877":"XL","0878":"XL","0879":"XL",
  "0895":"Tri","0896":"Tri","0897":"Tri","0898":"Tri","0899":"Tri",
  "0881":"Smartfren","0882":"Smartfren","0883":"Smartfren","0884":"Smartfren","0885":"Smartfren","0886":"Smartfren","0887":"Smartfren","0888":"Smartfren","0889":"Smartfren"
};

function queries(local: string, intl: string, plainIntl: string) {
  const exact = [`"${local}"`, `"${intl}"`, `"${plainIntl}"`];
  return [
    ...exact,
    `"${local}" whatsapp`, `"${local}" WA`, `"${local}" kontak`,
    `"${intl}" whatsapp`, `"${intl}" kontak`,
    `"${local}" site:facebook.com`, `"${intl}" site:facebook.com`,
    `"${local}" site:instagram.com`, `"${local}" site:tiktok.com`,
    `"${local}" site:linkedin.com`, `"${local}" site:*.co.id`,
    `"${local}" site:*.go.id`, `"${local}" site:*.ac.id`,
    `"${local}" (pemilik OR owner OR admin OR sales OR toko OR usaha)`,
  ];
}

export const indonesiaPhoneAdapter: Adapter = {
  name: "Indonesia Phone Deep OSINT",
  supports: ["phone"],
  async search(entity) {
    const local = entity.normalized;
    const intl = local.startsWith("0") ? `+62${local.slice(1)}` : local;
    const plainIntl = intl.replace(/^\+/, "");
    const provider = PREFIX[local.slice(0, 4)] || "Unknown";
    const q = queries(local, intl, plainIntl);
    const searched = await Promise.allSettled(q.map((x) => searchWeb(x, 18)));
    const hits = searched.flatMap((x) => x.status === "fulfilled" ? x.value : []);
    const seen = new Set<string>();
    const entities = [] as ReturnType<typeof extractFromText>;
    const findings = [
      { title: `Provider prefix: ${provider}`, url: "", snippet: `${local} normalized as ${intl}`, source: "Indonesia Phone Prefix" },
    ];
    for (const hit of hits) {
      const key = hit.url.replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      entities.push(...extractFromText(`${hit.title} ${hit.snippet}`, `indo-phone:${hit.engine}`));
      entities.push(...extractFromUrl(hit.url, `indo-phone:${hit.engine}`));
      findings.push({ title: hit.title || hit.url, url: hit.url, snippet: hit.snippet, source: `Phone Deep Search/${hit.engine}` });
    }
    findings.splice(1, 0, { title: `Phone coverage: ${q.length} targeted queries`, url: "https://github.com/spyschools/osint-indonesia-v5", snippet: `${seen.size} unique indexed mentions found across number formats, social platforms, public institutions and business/contact contexts.`, source: "Indonesia Phone OSINT" });
    return { entities, findings };
  },
};
