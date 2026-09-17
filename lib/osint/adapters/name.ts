import type { Adapter } from "../types";
import { searchWeb } from "../search";
import { extractFromText, extractFromUrl } from "../extractor";

type QueryPack = { category: string; build: (name: string) => string };

const PACKS: QueryPack[] = [
  // General / local internet
  { category: "general", build: (n) => `"${n}" Indonesia` },
  { category: "general", build: (n) => `"${n}" (profil OR biodata OR CV OR alumni OR mahasiswa OR pegawai OR karyawan)` },
  { category: "documents", build: (n) => `"${n}" filetype:pdf` },
  { category: "documents", build: (n) => `"${n}" (filetype:xls OR filetype:xlsx OR filetype:doc OR filetype:docx)` },

  // Social / messaging footprints described by OSINT in Indonesia
  { category: "social", build: (n) => `"${n}" site:linkedin.com/in` },
  { category: "social", build: (n) => `"${n}" site:facebook.com` },
  { category: "social", build: (n) => `"${n}" site:instagram.com` },
  { category: "social", build: (n) => `"${n}" site:tiktok.com` },
  { category: "social", build: (n) => `"${n}" (site:x.com OR site:twitter.com)` },
  { category: "social", build: (n) => `"${n}" site:youtube.com` },
  { category: "social", build: (n) => `"${n}" site:github.com` },
  { category: "social", build: (n) => `"${n}" site:t.me` },

  // Government / semi-official
  { category: "government", build: (n) => `"${n}" site:*.go.id` },
  { category: "government", build: (n) => `"${n}" (pegawai OR pejabat OR ASN OR PNS OR pengadaan OR LPSE) site:*.go.id` },
  { category: "government", build: (n) => `"${n}" (keputusan OR pengumuman OR lampiran OR daftar) site:*.go.id filetype:pdf` },

  // Education
  { category: "education", build: (n) => `"${n}" site:*.ac.id` },
  { category: "education", build: (n) => `"${n}" site:*.sch.id` },
  { category: "education", build: (n) => `"${n}" (mahasiswa OR dosen OR alumni OR skripsi OR wisuda) site:*.ac.id` },

  // Business / economy
  { category: "business", build: (n) => `"${n}" site:*.co.id` },
  { category: "business", build: (n) => `"${n}" (direktur OR komisaris OR founder OR owner OR perusahaan OR usaha OR bisnis)` },
  { category: "business", build: (n) => `"${n}" (kontak OR email OR telepon OR whatsapp OR "no hp")` },

  // Media / news
  { category: "media", build: (n) => `"${n}" (berita OR wawancara OR narasumber OR organisasi)` },
  { category: "media", build: (n) => `"${n}" site:kompas.com` },
  { category: "media", build: (n) => `"${n}" site:detik.com` },
  { category: "media", build: (n) => `"${n}" site:tempo.co` },
  { category: "media", build: (n) => `"${n}" site:antaranews.com` },
  { category: "media", build: (n) => `"${n}" site:tribunnews.com` },
  { category: "media", build: (n) => `"${n}" site:kumparan.com` },

  // Contact pivots
  { category: "contact", build: (n) => `"${n}" (email OR surel OR gmail OR yahoo)` },
  { category: "contact", build: (n) => `"${n}" (telepon OR whatsapp OR WA OR "nomor hp" OR "no hp")` },
];

export const indonesiaNameAdapter: Adapter = {
  name: "OSINT in Indonesia Source Packs",
  supports: ["name"],
  async search(entity) {
    const queryResults = await Promise.allSettled(
      PACKS.map(async (pack) => ({ pack, hits: await searchWeb(pack.build(entity.value), 24) })),
    );

    const seen = new Set<string>();
    const entities = [] as ReturnType<typeof extractFromText>;
    const findings = [];
    const categoryCounts = new Map<string, number>();

    for (const settled of queryResults) {
      if (settled.status !== "fulfilled") continue;
      const { pack, hits } = settled.value;
      for (const hit of hits) {
        const key = hit.url.replace(/\/$/, "");
        if (seen.has(key)) continue;
        seen.add(key);
        categoryCounts.set(pack.category, (categoryCounts.get(pack.category) || 0) + 1);
        const text = `${hit.title} ${hit.snippet}`;
        entities.push(...extractFromText(text, `indo:${pack.category}:${hit.engine}`));
        entities.push(...extractFromUrl(hit.url, `indo:${pack.category}:${hit.engine}`));
        findings.push({
          title: hit.title || hit.url,
          url: hit.url,
          snippet: hit.snippet,
          source: `Indonesia/${pack.category}/${hit.engine}`,
        });
      }
    }

    const categorySummary = [...categoryCounts.entries()].map(([k, v]) => `${k}:${v}`).join(" · ");
    findings.unshift({
      title: `OSINT in Indonesia coverage: ${PACKS.length} source queries`,
      url: "https://github.com/OSINT-for-countries/OSINT_in_Indonesia",
      snippet: `${seen.size} unique indexed results. ${categorySummary || "No indexed category hits."}`,
      source: "OSINT in Indonesia",
    });

    return { entities, findings };
  },
};
