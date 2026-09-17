import type { Adapter } from "../types";
import { searchWeb } from "../search";
import { extractFromText, extractFromUrl } from "../extractor";

export const emailAdapter: Adapter = {
  name: "Email Public Footprint",
  supports: ["email"],
  async search(entity) {
    const hits = await searchWeb(`"${entity.normalized}"`);
    const entities = hits.flatMap((h) => [
      ...extractFromText(`${h.title} ${h.snippet}`, `email:${h.engine}`),
      ...extractFromUrl(h.url, `email:${h.engine}`),
    ]);
    return {
      entities,
      findings: hits.map((h) => ({ title: h.title || h.url, url: h.url, snippet: h.snippet, source: `Email Search/${h.engine}` })),
    };
  },
};
