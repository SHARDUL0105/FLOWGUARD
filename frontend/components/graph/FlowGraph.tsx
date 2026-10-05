"use client";
import { ReactFlow } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { NODE_POSITIONS } from "@/lib/mock";
import { useFlowStore } from "@/store/flowguardStore";
import PropagationEdge from "./PropagationEdge";
import type { PropagationEdgeData } from "./PropagationEdge";
import ServiceNode from "./ServiceNode";
import type { ServiceNodeData } from "./ServiceNode";

const nodeTypes = { service: ServiceNode };
const edgeTypes = { propagation: PropagationEdge };

export default function FlowGraph() {
  const topology = useFlowStore((s) => s.topology);

  const nodes = useMemo<Node<ServiceNodeData>[]>(
    () =>
      topology.nodes.map((n, idx) => ({
        id: n.id,
        type: "service",
        position: (n.x !== undefined && n.y !== undefined)
          ? { x: n.x, y: n.y }
          : (NODE_POSITIONS[n.id] ?? { x: (idx % 3) * 260, y: Math.floor(idx / 3) * 160 + 100 }),
        draggable: false,
        data: { sid: n.id, label: n.label, layer: n.layer ?? 0, baseMs: n.base_ms ?? 50 },
      })),
    [topology],
  );
  const edges = useMemo<Edge<PropagationEdgeData>[]>(
    () =>
      topology.edges.map((e) => ({
        id: `${e.source}-${e.target}`, source: e.source, target: e.target, type: "propagation",
        data: { timeout_ms: e.timeout_ms, retries: e.retries, breaker: e.breaker, fallback: e.fallback },
      })),
    [topology],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.14 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      minZoom={0.5}
      maxZoom={1.4}
      proOptions={{ hideAttribution: false }}
    />
  );
}
