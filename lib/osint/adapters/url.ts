import * as cheerio from "cheerio";
import type { Adapter } from "../types";
import { extractFromText, extractFromUrl } from "../extractor";

export const urlAdapter: Adapter = {
  name: "Web Metadata",
  supports: ["url"],
  async search(entity) {
    try {
      const res = await fetch(entity.value, { headers: { "user-agent": "Mozilla/5.0 (compatible; SinthOSINT/0.1)" }, signal: AbortSignal.timeout(7000), cache: "no-store" });
      const html = (await res.text()).slice(0, 600_000);
      const $ = cheerio.load(html);
      const title = $("title").text().trim();
      const desc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
      const entities = [
        ...extractFromText(`${title} ${desc} ${$("body").text().slice(0, 15000)}`, "web-metadata"),
        ...extractFromUrl(entity.value, "web-metadata"),
      ];
      return { entities, findings: [{ title: title || entity.value, url: entity.value, snippet: desc, source: "Web Metadata" }] };
    } catch {
      return { entities: [], findings: [] };
    }
  },
};
