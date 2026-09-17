"use client";

import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import type { Entity, Relation } from "@/lib/osint/types";

function EntityNode({ data }: NodeProps<Node<{ entity: Entity }>>) {
  const entity = data.entity;
  return (
    <div className={`graph-node graph-node-${entity.type}`}>
      <Handle type="target" position={Position.Top} />
      <span className="graph-node-type">{entity.type}</span>
      <strong>{entity.value}</strong>
      <small>{entity.confidence}% confidence</small>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

export function InvestigationGraph({ entities, relations }: { entities: Entity[]; relations: Relation[] }) {
  const byDepth = new Map<number, Entity[]>();
  for (const entity of entities) byDepth.set(entity.depth, [...(byDepth.get(entity.depth) || []), entity]);
  const nodes: Node[] = entities.map((entity) => {
    const row = byDepth.get(entity.depth) || [];
    const idx = row.findIndex((x) => x.id === entity.id);
    return {
      id: entity.id,
      type: "entity",
      data: { entity },
      position: { x: idx * 280 - ((row.length - 1) * 280) / 2, y: entity.depth * 190 },
    };
  });
  const edges: Edge[] = relations.map((r) => ({ id: r.id, source: r.from, target: r.to, label: r.source, animated: r.confidence >= 70 }));

  return (
    <div className="graph-shell">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.25} maxZoom={1.5}>
        <Background gap={22} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
