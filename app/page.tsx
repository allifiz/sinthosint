"use client";

import { FormEvent, useMemo, useState } from "react";
import { Activity, ChevronRight, CircleDot, Globe2, Network, Search, ShieldCheck, Sparkles } from "lucide-react";
import { InvestigationGraph } from "@/components/InvestigationGraph";
import type { InvestigationResult } from "@/lib/osint/types";

const examples = ["allifiz", "Nama Lengkap", "+628123456789", "example.com"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [error, setError] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    result?.entities.forEach((e) => map.set(e.type, (map.get(e.type) || 0) + 1));
    return [...map.entries()];
  }, [result]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, maxDepth: depth }),
      });

      const raw = await res.text();
      let data: InvestigationResult | { error?: string } | null = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {
        if (res.status === 504) {
          throw new Error("Deep scan melewati batas runtime Vercel. Coba lagi setelah deployment patch terbaru selesai, atau gunakan Depth 1 sementara.");
        }
        throw new Error(`Server mengembalikan respons non-JSON (${res.status}). ${raw.slice(0, 160) || "Tidak ada detail."}`);
      }

      if (!res.ok) {
        const message = data && "error" in data ? data.error : undefined;
        throw new Error(message || `Investigation failed (${res.status})`);
      }
      if (!data || !("seed" in data)) throw new Error("Respons investigation tidak lengkap.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="orb orb-a" /><div className="orb orb-b" />
        <nav><div className="brand"><span className="brand-mark"><Network size={18} /></span>Sinth<span>OSINT</span></div><div className="nav-pill"><CircleDot size={13} /> 3 engines · recursive pivots</div></nav>
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14}/> MAIGRET × OSINT IN INDONESIA × INDONESIA V5</div>
          <h1>Start with one clue.<br/><span>Let every finding branch.</span></h1>
          <p>SinthOSINT mengorkestrasi tiga pendekatan: database rule Maigret untuk username, source packs Indonesia untuk nama dan jejak lokal, serta pola PhoneInfoga-lite + Google/Bing/DuckDuckGo dari Indonesia v5 untuk nomor +62.</p>
        </div>
        <form className="search-card" onSubmit={submit}>
          <Search size={21}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder='username, "nama lengkap", +62…, email, domain…'/>
          <select value={depth} onChange={(e)=>setDepth(Number(e.target.value))} aria-label="Pivot depth"><option value={1}>Depth 1</option><option value={2}>Depth 2</option><option value={3}>Depth 3</option></select>
          <button disabled={loading}>{loading ? <Activity className="spin" size={18}/> : <ChevronRight size={19}/>} {loading ? "Deep scanning" : "Investigate"}</button>
        </form>
        <div className="examples">Try <span>→</span>{examples.map((x)=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}</div>
        <div className="method-row">
          <div><strong>MAIGRET ENGINE</strong><span>DB-backed username scan across hundreds of upstream site rules</span></div>
          <div><strong>OSINT IN INDONESIA</strong><span>30 source queries across social, government, education, business, media & documents</span></div>
          <div><strong>INDONESIA V5</strong><span>+62 normalization, operator inference and Google/Bing/DDG phone dorking</span></div>
          <div><strong>WEB INTEL</strong><span>DNS, CT, RDAP, Wayback & HTTP metadata for discovered domains</span></div>
        </div>
      </section>

      {error && <section className="status error">{error}</section>}
      {loading && <section className="status"><div className="scanner"/><p>Running toolkit-specific scans, extracting entities, then recursively dispatching each new clue to the matching engine…</p></section>}

      {result && <section className="results">
        <div className="summary-grid">
          <div className="summary-card primary"><span>Seed</span><strong>{result.seed.value}</strong><em>{result.seed.type}</em></div>
          <div className="summary-card"><span>Entities</span><strong>{result.entities.length}</strong><em>{grouped.map(([k,v])=>`${v} ${k}`).join(" · ")}</em></div>
          <div className="summary-card"><span>Public findings</span><strong>{result.findings.length}</strong><em>{result.stats.adapters.length} adapters used</em></div>
          <div className="summary-card"><span>Runtime</span><strong>{(result.stats.durationMs/1000).toFixed(1)}s</strong><em>{result.stats.visited} entities visited</em></div>
        </div>

        <div className="section-head"><div><span>RELATIONSHIP MAP</span><h2>Entity graph</h2></div><p>Username → display name → Indonesia source packs → phone → Indonesia v5 → domain/web intel. New entities are queued automatically.</p></div>
        <InvestigationGraph entities={result.entities} relations={result.relations}/>

        <div className="content-grid">
          <div>
            <div className="section-head compact"><div><span>FINDINGS</span><h2>Public traces</h2></div></div>
            <div className="finding-list">{result.findings.length ? result.findings.map((f)=><article key={f.id} className="finding"><div className="finding-icon"><Globe2 size={16}/></div><div><div className="finding-source">{f.source}</div>{f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.title}</a> : <strong>{f.title}</strong>}<p>{f.snippet || "No snippet available."}</p></div></article>) : <div className="empty">Belum ada hasil publik yang terverifikasi untuk seed ini.</div>}</div>
          </div>
          <aside>
            <div className="section-head compact"><div><span>ENTITIES</span><h2>Pivot queue</h2></div></div>
            <div className="entity-list">{result.entities.map((e)=><div className="entity-row" key={e.id}><div><b>{e.type}</b><strong>{e.value}</strong><small>{e.source}</small></div><span>{e.confidence}%</span></div>)}</div>
          </aside>
        </div>
      </section>}

      <footer><ShieldCheck size={15}/> Public-source correlation only. Confidence is evidence weight, not identity proof.</footer>
    </main>
  );
}
