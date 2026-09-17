import { classify, entityKey } from "./classifier";
import { dedupeCandidates } from "./extractor";
import type { Adapter, Entity, Finding, InvestigationResult, Relation } from "./types";
import { usernameAdapter } from "./adapters/username";
import { indonesiaNameAdapter } from "./adapters/name";
import { indonesiaPhoneAdapter } from "./adapters/phone";
import { emailAdapter } from "./adapters/email";
import { domainAdapter } from "./adapters/domain";
import { urlAdapter } from "./adapters/url";

const ADAPTERS: Adapter[] = [usernameAdapter, indonesiaNameAdapter, indonesiaPhoneAdapter, emailAdapter, domainAdapter, urlAdapter];
const SOFT_BUDGET_MS = 42000;
const MIN_ADAPTER_BUDGET_MS = 7000;
const PIVOT_LIMITS: Partial<Record<Entity["type"], number>> = {
  username: 10,
  name: 4,
  phone: 6,
  email: 6,
  domain: 10,
  url: 8,
};

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function investigate(input: string, maxDepth = 2, maxEntities = 120): Promise<InvestigationResult> {
  const started = Date.now();
  const seedClass = classify(input);
  const seed: Entity = { id: id("ent"), ...seedClass, source: "user", confidence: 100, depth: 0 };
  const entities: Entity[] = [seed];
  const relations: Relation[] = [];
  const findings: Finding[] = [];
  const queue: Entity[] = [seed];
  const visited = new Set<string>();
  const entityMap = new Map<string, Entity>([[entityKey(seed.type, seed.normalized), seed]]);
  const usedAdapters = new Set<string>();
  const pivotCounts = new Map<Entity["type"], number>();
  let budgetReached = false;

  outer: while (queue.length && entities.length < maxEntities) {
    if (Date.now() - started >= SOFT_BUDGET_MS) {
      budgetReached = true;
      break;
    }

    const current = queue.shift()!;
    const currentKey = entityKey(current.type, current.normalized);
    if (visited.has(currentKey) || current.depth > maxDepth) continue;

    if (current.depth > 0) {
      const used = pivotCounts.get(current.type) || 0;
      const limit = PIVOT_LIMITS[current.type] ?? 5;
      if (used >= limit) continue;
      pivotCounts.set(current.type, used + 1);
    }

    visited.add(currentKey);
    const adapters = ADAPTERS.filter((a) => a.supports.includes(current.type));

    for (const adapter of adapters) {
      if (Date.now() - started >= SOFT_BUDGET_MS - MIN_ADAPTER_BUDGET_MS) {
        budgetReached = true;
        break outer;
      }

      usedAdapters.add(adapter.name);
      let result;
      try { result = await adapter.search(current); } catch { continue; }

      for (const f of result.findings) {
        if (findings.length >= 400) break;
        findings.push({ id: id("find"), entityId: current.id, ...f });
      }

      const candidates = dedupeCandidates(result.entities, current);
      for (const candidate of candidates) {
        if (entities.length >= maxEntities) break;
        const key = entityKey(candidate.type, candidate.normalized);
        let target = entityMap.get(key);
        if (!target) {
          target = { id: id("ent"), depth: current.depth + 1, ...candidate };
          entityMap.set(key, target);
          entities.push(target);
          if (target.depth <= maxDepth) queue.push(target);
        } else if (candidate.confidence > target.confidence) {
          target.confidence = candidate.confidence;
        }
        const relationKey = `${current.id}:${target.id}:${adapter.name}`;
        if (!relations.some((r) => r.id === relationKey) && current.id !== target.id) {
          relations.push({ id: relationKey, from: current.id, to: target.id, type: "derived", source: adapter.name, confidence: candidate.confidence });
        }
      }
    }
  }

  if (budgetReached && findings.length < 400) {
    findings.push({
      id: id("find"),
      entityId: seed.id,
      title: "Partial result returned before Vercel timeout",
      url: "",
      snippet: "The synchronous scan reached its runtime budget. Findings collected so far are preserved; deeper coverage should run through the upcoming batched job scanner.",
      source: "SinthOSINT Runtime Guard",
    });
  }

  return {
    seed,
    entities,
    relations,
    findings: findings.slice(0, 400),
    stats: { visited: visited.size, durationMs: Date.now() - started, adapters: [...usedAdapters] },
  };
}
