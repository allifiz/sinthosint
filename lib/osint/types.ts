export type EntityType = "username" | "name" | "phone" | "email" | "domain" | "url";

export type Entity = {
  id: string;
  type: EntityType;
  value: string;
  normalized: string;
  source: string;
  confidence: number;
  depth: number;
  metadata?: Record<string, unknown>;
};

export type Relation = {
  id: string;
  from: string;
  to: string;
  type: "seed" | "profile" | "mentions" | "linked" | "derived";
  source: string;
  confidence: number;
};

export type Finding = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  source: string;
  entityId: string;
};

export type AdapterResult = {
  entities: Omit<Entity, "id" | "depth">[];
  findings: Omit<Finding, "id" | "entityId">[];
};

export type InvestigationResult = {
  seed: Entity;
  entities: Entity[];
  relations: Relation[];
  findings: Finding[];
  stats: { visited: number; durationMs: number; adapters: string[] };
};

export interface Adapter {
  name: string;
  supports: EntityType[];
  search(entity: Entity): Promise<AdapterResult>;
}
