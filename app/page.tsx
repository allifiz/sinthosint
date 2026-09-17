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
      const res = await fetch("/api/investigate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, maxDepth: depth }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Investigation failed");
      setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Investigation failed"); }
    finally { setLoading(false); }
  }

  return (
    <main>
      <section className="hero">
        <div className="orb orb-a" /><div className="orb orb-b" />
        <nav><div className="brand"><span className="brand-mark"><Network size={18} /></span>Sinth<span>OSINT</span></div><div className="nav-pill"><CircleDot size={13} /> Indonesia-first · entity driven</div></nav>
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14}/> PIVOT ENGINE FOR PUBLIC-SOURCE INTELLIGENCE</div>
          <h1>Start with one clue.<br/><span>Follow every public thread.</span></h1>
          <p>Masukkan username, nama, nomor Indonesia, email, domain, atau URL. SinthOSINT mendeteksi tipe entity, memilih adapter, lalu mem-pivot temuan baru secara otomatis.</p>
        </div>
        <form className="search-card" onSubmit={submit}>
          <Search size={21}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder='username, "nama lengkap", +62…, email, domain…'/>
          <select value={depth} onChange={(e)=>setDepth(Number(e.target.value))} aria-label="Pivot depth"><option value={1}>Depth 1</option><option value={2}>Depth 2</option><option value={3}>Depth 3</option></select>
          <button disabled={loading}>{loading ? <Activity className="spin" size={18}/> : <ChevronRight size={19}/>} {loading ? "Tracing" : "Investigate"}</button>
        </form>
        <div className="examples">Try <span>→</span>{examples.map((x)=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}</div>
        <div className="method-row">
          <div><strong>USERNAME</strong><span>Maigret-style profile discovery</span></div>
          <div><strong>NAME</strong><span>Indonesia-oriented public search</span></div>
          <div><strong>+62 PHONE</strong><span>Normalization, provider & indexed mentions</span></div>
          <div><strong>DOMAIN</strong><span>DNS, CT logs & RDAP pivots</span></div>
        </div>
      </section>

      {error && <section className="status error">{error}</section>}
      {loading && <section className="status"><div className="scanner"/><p>Following entities and public-source pivots…</p></section>}

      {result && <section className="results">
        <div className="summary-grid">
          <div className="summary-card primary"><span>Seed</span><strong>{result.seed.value}</strong><em>{result.seed.type}</em></div>
          <div className="summary-card"><span>Entities</span><strong>{result.entities.length}</strong><em>{grouped.map(([k,v])=>`${v} ${k}`).join(" · ")}</em></div>
          <div className="summary-card"><span>Public findings</span><strong>{result.findings.length}</strong><em>{result.stats.adapters.length} adapters used</em></div>
          <div className="summary-card"><span>Runtime</span><strong>{(result.stats.durationMs/1000).toFixed(1)}s</strong><em>{result.stats.visited} entities visited</em></div>
        </div>

        <div className="section-head"><div><span>RELATIONSHIP MAP</span><h2>Entity graph</h2></div><p>Nodes discovered from one source are automatically eligible for the next matching adapter.</p></div>
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

      <footer><ShieldCheck size={15}/> Built for lawful public-source investigations. Correlation is evidence-weighted, not identity proof.</footer>
    </main>
  );
}
