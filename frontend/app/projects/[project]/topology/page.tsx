"use client";
import { ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges, Handle, Position } from "@xyflow/react";
import type { Node, Edge, NodeChange, EdgeChange, Connection, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import SiteNav from "@/components/layout/SiteNav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Node type palette ────────────────────────────────────────────────────────
type ServiceKind = "service" | "database" | "cache" | "gateway" | "queue" | "external";

const KIND_META: Record<ServiceKind, { label: string; icon: string; color: string; defaultMs: number; defaultRps: number }> = {
  service:  { label: "Service",   icon: "⬡", color: "#218B6A", defaultMs: 80,  defaultRps: 500 },
  database: { label: "Database",  icon: "🗄", color: "#C9851F", defaultMs: 15,  defaultRps: 2000 },
  cache:    { label: "Cache",     icon: "⚡", color: "#5B8BD0", defaultMs: 2,   defaultRps: 5000 },
  gateway:  { label: "Gateway",   icon: "🌐", color: "#9C71C0", defaultMs: 20,  defaultRps: 1000 },
  queue:    { label: "Queue",     icon: "📨", color: "#D94B45", defaultMs: 5,   defaultRps: 3000 },
  external: { label: "External",  icon: "🔗", color: "#6B7280", defaultMs: 200, defaultRps: 200  },
};

// ─── Editor Node component ────────────────────────────────────────────────────
type EditorNodeData = { label: string; kind: ServiceKind; base_ms: number; capacity_rps: number; selected?: boolean };

function EditorNode({ data, selected }: NodeProps<Node<EditorNodeData>>) {
  const meta = KIND_META[data.kind ?? "service"];
  return (
    <div
      className={cn(
        "relative min-w-[140px] rounded-xl border-2 bg-paper px-4 py-3 shadow-md transition-all",
        selected ? "border-forest ring-2 ring-forest/30" : "border-rule"
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-paper !bg-forest" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-paper !bg-forest" />
      <div className="flex items-center gap-2">
        <span className="text-[18px]">{meta.icon}</span>
        <div>
          <div className="text-[13px] font-semibold text-ink leading-tight">{data.label}</div>
          <div className="text-[10px] text-mute">{meta.label} · {data.base_ms}ms</div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { editor: EditorNode };

// ─── Default starter topology ─────────────────────────────────────────────────
function starterTopology() {
  return {
    nodes: [
      { id: "gateway",   type: "editor", position: { x: 0,   y: 160 }, data: { label: "Gateway",   kind: "gateway",  base_ms: 20,  capacity_rps: 1000 } },
      { id: "service-a", type: "editor", position: { x: 260, y: 80  }, data: { label: "Service A", kind: "service",  base_ms: 80,  capacity_rps: 500  } },
      { id: "service-b", type: "editor", position: { x: 260, y: 240 }, data: { label: "Service B", kind: "service",  base_ms: 60,  capacity_rps: 500  } },
      { id: "database",  type: "editor", position: { x: 520, y: 160 }, data: { label: "Database",  kind: "database", base_ms: 15,  capacity_rps: 2000 } },
    ] as Node<EditorNodeData>[],
    edges: [
      { id: "gw-sa",  source: "gateway",   target: "service-a", type: "smoothstep", animated: true, data: { timeout_ms: 700, retries: 1, breaker: true, fallback: false } },
      { id: "gw-sb",  source: "gateway",   target: "service-b", type: "smoothstep", animated: true, data: { timeout_ms: 700, retries: 1, breaker: true, fallback: false } },
      { id: "sa-db",  source: "service-a", target: "database",  type: "smoothstep", animated: true, data: { timeout_ms: 500, retries: 2, breaker: true, fallback: false } },
      { id: "sb-db",  source: "service-b", target: "database",  type: "smoothstep", animated: true, data: { timeout_ms: 500, retries: 2, breaker: true, fallback: false } },
    ] as Edge[],
  };
}

// ─── Side panel ───────────────────────────────────────────────────────────────
function NodePanel({ node, onChange, onDelete }: { node: Node<EditorNodeData>; onChange: (id: string, patch: Partial<EditorNodeData>) => void; onDelete: (id: string) => void }) {
  const d = node.data;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Node Properties</h3>
        <button onClick={() => onDelete(node.id)} className="rounded-full px-2 py-0.5 text-[11px] text-crit hover:bg-crit/10 transition-colors">Delete</button>
      </div>
      <Field label="Label">
        <input value={d.label} onChange={e => onChange(node.id, { label: e.target.value })}
          className="w-full glass rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-forest" />
      </Field>
      <Field label="Type">
        <select value={d.kind} onChange={e => onChange(node.id, { kind: e.target.value as ServiceKind })}
          className="w-full appearance-none glass rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-forest">
          {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </Field>
      <Field label="Base latency (ms)">
        <input type="number" min={1} value={d.base_ms} onChange={e => onChange(node.id, { base_ms: Number(e.target.value) })}
          className="w-full glass rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-forest" />
      </Field>
      <Field label="Capacity (req/s)">
        <input type="number" min={1} value={d.capacity_rps} onChange={e => onChange(node.id, { capacity_rps: Number(e.target.value) })}
          className="w-full glass rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-forest" />
      </Field>
    </div>
  );
}

type EdgeData = { timeout_ms: number | null; retries: number; breaker: boolean; fallback: boolean };

function EdgePanel({ edge, onChange, onDelete }: { edge: Edge<EdgeData>; onChange: (id: string, patch: Partial<EdgeData>) => void; onDelete: (id: string) => void }) {
  const d = edge.data ?? { timeout_ms: 700, retries: 1, breaker: true, fallback: false };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Edge Properties</h3>
        <button onClick={() => onDelete(edge.id)} className="rounded-full px-2 py-0.5 text-[11px] text-crit hover:bg-crit/10 transition-colors">Delete</button>
      </div>
      <p className="text-[11px] text-mute">{edge.source} → {edge.target}</p>
      <Field label="Timeout (ms)">
        <input type="number" min={0} value={d.timeout_ms ?? ""} placeholder="none"
          onChange={e => onChange(edge.id, { timeout_ms: e.target.value ? Number(e.target.value) : null })}
          className="w-full glass rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-forest" />
      </Field>
      <Field label="Retries">
        <input type="number" min={0} max={10} value={d.retries}
          onChange={e => onChange(edge.id, { retries: Number(e.target.value) })}
          className="w-full glass rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-forest" />
      </Field>
      <Toggle label="Circuit breaker" checked={d.breaker} onChange={v => onChange(edge.id, { breaker: v })} />
      <Toggle label="Fallback enabled" checked={d.fallback} onChange={v => onChange(edge.id, { fallback: v })} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-mute">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-ink">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-forest" : "bg-rule")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
let _nodeSeq = 1;

export default function TopologyEditorPage() {
  const { project: projectId } = useParams<{ project: string }>();
  const [nodes, setNodes] = useState<Node<EditorNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<EdgeData>[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<EditorNodeData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge<EdgeData> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState(projectId);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<Record<string, any> | null>(null);
  const [simError, setSimError] = useState("");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Load existing topology from Atlas on mount
  useEffect(() => {
    api.getProject(projectId).then(p => { if (p?.name) setProjectName(p.name); });
    api.getTopology(projectId).then(async topo => {
      if (topo?.nodes?.length) {
        setNodes(topo.nodes.map((n: any) => ({
          id: n.id, type: "editor",
          position: { x: n.x ?? 0, y: n.y ?? 0 },
          data: { label: n.label, kind: n.type ?? "service", base_ms: n.base_ms ?? 100, capacity_rps: n.capacity_rps ?? 500 },
        })));
        setEdges(topo.edges.map((e: any) => ({
          id: e.id, source: e.source, target: e.target, type: "smoothstep", animated: true,
          data: { timeout_ms: e.timeout_ms, retries: e.retries, breaker: e.breaker, fallback: e.fallback },
        })));
      } else {
        // No saved topology yet — seed with starter and persist it immediately so
        // "Run Fault Scan" works without requiring a manual Save step first.
        const starter = starterTopology();
        setNodes(starter.nodes); setEdges(starter.edges);
        try {
          await api.saveTopology(projectId, {
            nodes: starter.nodes.map(n => ({
              id: n.id, label: n.data.label, type: n.data.kind,
              layer: 0, base_ms: n.data.base_ms, capacity_rps: n.data.capacity_rps,
              x: n.position.x, y: n.position.y,
            })),
            edges: starter.edges.map(e => ({
              id: e.id, source: e.source, target: e.target,
              timeout_ms: (e.data as any)?.timeout_ms ?? 700,
              retries: (e.data as any)?.retries ?? 1,
              breaker: (e.data as any)?.breaker ?? true,
              fallback: (e.data as any)?.fallback ?? false,
            })),
          });
        } catch {
          // Silent — user can still manually Save if the backend is unreachable
        }
      }
      setLoading(false);
    });
  }, [projectId]);

  // React Flow handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds) as Node<EditorNodeData>[]);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds) as Edge<EdgeData>[]);
  }, []);
  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection, type: "smoothstep", animated: true,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      data: { timeout_ms: 700, retries: 1, breaker: true, fallback: false },
    }, eds) as Edge<EdgeData>[]);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<EditorNodeData>);
    setSelectedEdge(null);
  }, []);
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge as Edge<EdgeData>);
    setSelectedNode(null);
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNode(null); setSelectedEdge(null);
  }, []);

  // Palette: drop a new node
  const addNode = (kind: ServiceKind) => {
    const meta = KIND_META[kind];
    const id = `${kind}-${_nodeSeq++}`;
    const newNode: Node<EditorNodeData> = {
      id, type: "editor",
      position: { x: 150 + Math.random() * 200, y: 80 + Math.random() * 200 },
      data: { label: `${meta.label} ${_nodeSeq}`, kind, base_ms: meta.defaultMs, capacity_rps: meta.defaultRps },
    };
    setNodes(nds => [...nds, newNode]);
  };

  // Property panel updates
  const updateNodeData = (id: string, patch: Partial<EditorNodeData>) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setSelectedNode(prev => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  };
  const updateEdgeData = (id: string, patch: Partial<EdgeData>) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } as EdgeData } : e));
    setSelectedEdge(prev => prev?.id === id ? { ...prev, data: { ...(prev.data ?? {}), ...patch } as EdgeData } : prev);
  };
  const deleteNode = (id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedNode(null);
  };
  const deleteEdge = (id: string) => {
    setEdges(eds => eds.filter(e => e.id !== id));
    setSelectedEdge(null);
  };

  // Save to Atlas
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        nodes: nodes.map(n => ({
          id: n.id, label: n.data.label, type: n.data.kind,
          layer: 0, base_ms: n.data.base_ms, capacity_rps: n.data.capacity_rps,
          x: n.position.x, y: n.position.y,
        })),
        edges: edges.map(e => ({
          id: e.id, source: e.source, target: e.target,
          timeout_ms: (e.data as EdgeData)?.timeout_ms ?? 700,
          retries: (e.data as EdgeData)?.retries ?? 1,
          breaker: (e.data as EdgeData)?.breaker ?? true,
          fallback: (e.data as EdgeData)?.fallback ?? false,
        })),
      };
      await api.saveTopology(projectId, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Run the backend fault scanner against the saved topology
  const runScan = async () => {
    setSimulating(true); setSimResult(null); setSimError("");
    try {
      // Auto-save first so the backend has the latest topology
      await save();
      const result = await api.simulateProject(projectId);
      setSimResult(result);
    } catch (e: any) {
      setSimError(e?.message ?? "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-mute text-[14px]">Loading topology…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <SiteNav />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-rule bg-paper/90 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`} className="text-[12.5px] text-mute hover:text-forest transition-colors">← {projectName}</Link>
          <span className="text-mute">/</span>
          <h1 className="text-[14px] font-semibold">Topology Editor</h1>
          <span className="rounded-full border border-forest/30 bg-mint/50 px-2 py-0.5 text-[10px] font-medium text-forest">
            {nodes.length} nodes · {edges.length} edges
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saved && (
              <motion.span key="saved" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-[12px] text-forest">✓ Saved</motion.span>
            )}
          </AnimatePresence>
          <Button variant="outline" onClick={save} disabled={saving || simulating}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button onClick={runScan} disabled={simulating || saving || nodes.length === 0}>
            {simulating ? "Scanning…" : "Run Fault Scan"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <aside className="flex w-48 flex-col gap-1 border-r border-rule bg-paper/80 p-3 backdrop-blur-md">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mute">Add node</p>
          {(Object.entries(KIND_META) as [ServiceKind, typeof KIND_META[ServiceKind]][]).map(([kind, meta]) => (
            <button key={kind} onClick={() => addNode(kind)}
              className="flex items-center gap-2 rounded-lg border border-rule bg-surface/40 px-3 py-2 text-left text-[12.5px] transition-colors hover:border-forest/40 hover:bg-mint/20">
              <span className="text-[16px]">{meta.icon}</span>
              <span className="font-medium text-ink">{meta.label}</span>
            </button>
          ))}
          <div className="mt-4 border-t border-rule pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mute">Tips</p>
            <ul className="space-y-1.5 text-[11px] text-mute leading-relaxed">
              <li>• Drag nodes to position</li>
              <li>• Drag from a node handle to connect</li>
              <li>• Click a node or edge to edit its properties</li>
              <li>• Save to persist to Atlas</li>
            </ul>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode="Delete"
            minZoom={0.3}
            maxZoom={2}
            snapToGrid
            snapGrid={[16, 16]}
            proOptions={{ hideAttribution: false }}
          >
            <Background color="rgb(var(--faint))" gap={20} size={1} />
            <Controls className="!bg-paper !border-rule !rounded-xl !shadow-md" />
            <MiniMap
              nodeColor={() => "rgb(var(--forest))"}
              maskColor="rgb(var(--paper) / 0.7)"
              className="!rounded-xl !border-rule"
            />
          </ReactFlow>
        </div>

        {/* Right property panel */}
        <AnimatePresence>
          {(selectedNode || selectedEdge) && (
            <motion.aside
              key="panel"
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 38 }}
              className="w-72 border-l border-rule bg-paper/90 p-5 backdrop-blur-md overflow-y-auto"
            >
              {selectedNode && (
                <NodePanel
                  node={selectedNode}
                  onChange={updateNodeData}
                  onDelete={deleteNode}
                />
              )}
              {selectedEdge && (
                <EdgePanel
                  edge={selectedEdge}
                  onChange={updateEdgeData}
                  onDelete={deleteEdge}
                />
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Fault Scan Results Bar */}
      <AnimatePresence>
        {(simulating || simResult || simError) && (
          <motion.div
            key="simbar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="border-t border-rule bg-paper/95 backdrop-blur-md px-6 py-4"
          >
            {simulating && (
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-forest border-t-transparent" />
                <span className="text-[13px] text-mute">Running 3 fault scenarios against your topology…</span>
              </div>
            )}
            {simError && <p className="text-[13px] text-crit">{simError}</p>}
            {simResult && (
              <div className="flex flex-wrap items-center gap-6">
                {/* Score */}
                <div className="flex items-baseline gap-2">
                  <span className="num text-[42px] font-light leading-none"
                    style={{ color: simResult.score >= 80 ? "#218B6A" : simResult.score >= 60 ? "#C9851F" : "#D94B45" }}>
                    {simResult.score}
                  </span>
                  <span className="text-[12px] text-mute">/ 100 resilience</span>
                </div>

                {/* Per-scenario breakdown */}
                <div className="flex flex-wrap gap-4">
                  {Object.entries(simResult.scenarios as Record<string, any>).map(([sc, data]) => {
                    const label: Record<string, string> = { db_latency: "DB Latency", service_down: "Service Down", traffic_spike: "Traffic Spike" };
                    const pen = simResult.penalties?.[sc] ?? 0;
                    const color = pen > 0.5 ? "#D94B45" : pen > 0.2 ? "#C9851F" : "#218B6A";
                    return (
                      <div key={sc} className="glass rounded-xl px-4 py-2.5">
                        <div className="text-[10px] text-mute mb-1">{label[sc] ?? sc}</div>
                        <div className="num text-[15px] font-medium" style={{ color }}>{data.p95_ms} ms</div>
                        <div className="text-[10px] text-mute">{(data.error_rate * 100).toFixed(1)}% err</div>
                      </div>
                    );
                  })}
                </div>

                {/* Baseline */}
                <div className="text-[11px] text-mute">
                  <div>Baseline p95: {simResult.baseline?.p95_ms} ms</div>
                  <div>{simResult.nodes} nodes · {simResult.edges_count} edges</div>
                </div>

                <button onClick={() => setSimResult(null)} className="ml-auto text-[11px] text-mute hover:text-ink">Dismiss</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
