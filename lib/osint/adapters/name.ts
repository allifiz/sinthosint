import type { Adapter } from "../types";
import { searchWeb } from "../search";
import { extractFromText, extractFromUrl } from "../extractor";

const TARGETED = [
  (n: string) => `"${n}" Indonesia`,
  (n: string) => `"${n}" site:linkedin.com/in`,
  (n: string) => `"${n}" site:facebook.com`,
  (n: string) => `"${n}" site:instagram.com`,
  (n: string) => `"${n}" site:tiktok.com`,
  (n: string) => `"${n}" site:x.com OR site:twitter.com`,
  (n: string) => `"${n}" site:github.com`,
  (n: string) => `"${n}" site:youtube.com`,
  (n: string) => `"${n}" site:*.go.id`,
  (n: string) => `"${n}" site:*.ac.id`,
  (n: string) => `"${n}" site:*.sch.id`,
  (n: string) => `"${n}" site:*.co.id`,
  (n: string) => `"${n}" (email OR surel OR kontak)`,
  (n: string) => `"${n}" (telepon OR whatsapp OR "no hp" OR "nomor hp")`,
  (n: string) => `"${n}" (profil OR biodata OR alumni OR mahasiswa OR pegawai OR karyawan)`,
  (n: string) => `"${n}" (berita OR wawancara OR narasumber OR organisasi) Indonesia`,
];

export const indonesiaNameAdapter: Adapter = {
  name: "Indonesia Name Deep OSINT",
  supports: ["name"],
  async search(entity) {
    const queryResults = await Promise.allSettled(TARGETED.map((q) => searchWeb(q(entity.value), 20)));
    const hits = queryResults.flatMap((x) => x.status === "fulfilled" ? x.value : []);
    const seen = new Set<string>();
    const entities = [] as ReturnType<typeof extractFromText>;
    const findings = [];
    for (const hit of hits) {
      const key = hit.url.replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      const text = `${hit.title} ${hit.snippet}`;
      entities.push(...extractFromText(text, `indo-name:${hit.engine}`));
      entities.push(...extractFromUrl(hit.url, `indo-name:${hit.engine}`));
      findings.push({ title: hit.title || hit.url, url: hit.url, snippet: hit.snippet, source: `Indonesia Deep Search/${hit.engine}` });
    }
    findings.unshift({ title: `Indonesia name coverage: ${TARGETED.length} targeted queries`, url: "https://github.com/OSINT-for-countries/OSINT_in_Indonesia", snippet: `${seen.size} unique indexed results collected across social, government, education, business and general web pivots.`, source: "Indonesia OSINT Guide" });
    return { entities, findings };
  },
};
