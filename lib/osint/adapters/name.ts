import type { Adapter } from "../types";
import { searchWeb } from "../search";
import { extractFromText, extractFromUrl } from "../extractor";

const TARGETED = [
  (n: string) => `"${n}" Indonesia`,
  (n: string) => `"${n}" site:linkedin.com/in`,
  (n: string) => `"${n}" site:github.com`,
  (n: string) => `"${n}" site:instagram.com`,
  (n: string) => `"${n}" site:*.go.id`,
];

export const indonesiaNameAdapter: Adapter = {
  name: "Indonesia Name OSINT",
  supports: ["name"],
  async search(entity) {
    const queryResults = await Promise.allSettled(TARGETED.map((q) => searchWeb(q(entity.value))));
    const hits = queryResults.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
    const seen = new Set<string>();
    const entities = [] as ReturnType<typeof extractFromText>;
    const findings = [];
    for (const hit of hits) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      entities.push(...extractFromText(`${hit.title} ${hit.snippet}`, `indo-name:${hit.engine}`));
      entities.push(...extractFromUrl(hit.url, `indo-name:${hit.engine}`));
      findings.push({ title: hit.title || hit.url, url: hit.url, snippet: hit.snippet, source: `Indonesia Search/${hit.engine}` });
    }
    return { entities, findings };
  },
};
