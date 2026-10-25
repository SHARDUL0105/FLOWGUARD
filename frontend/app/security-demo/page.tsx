"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Database,
  GitBranch,
  Home,
  Moon,
  Network,
  Play,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sun,
  Terminal,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";

import { useFlowStore } from "@/store/flowguardStore";
import { cn } from "@/lib/utils";

type TabId = "overview" | "websocket" | "audit" | "events" | "topology";
type WsStatus = "disconnected" | "connecting" | "connected" | "error";

type WsMessage = {
  id: string;
  type: string;
  payload: unknown;
  time: string;
  direction: "in" | "out";
};

type AuditEntry = {
  id?: string | number;
  timestamp?: string;
  event?: string;
  action?: string;
  actor?: string;
  hash?: string;
  [key: string]: unknown;
};

type FlowEvent = {
  id?: string | number;
  event_id?: string | number;
  type?: string;
  event?: string;
  name?: string;
  timestamp?: string;
  time?: string;
  created_at?: string;
  [key: string]: unknown;
};

type FlowNode = {
  id?: string | number;
  name?: string;
  label?: string;
  status?: string;
  state?: string;
  [key: string]: unknown;
};

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "websocket", label: "WebSocket", icon: Wifi },
  { id: "audit", label: "Audit log", icon: ShieldCheck },
  { id: "events", label: "Events", icon: Activity },
  { id: "topology", label: "Topology", icon: Network },
];

function formatTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-rose-500";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Degraded";
  return "Critical";
}

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-emerald-500" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SecurityDemoPage() {
  const resilienceScore = useFlowStore((state) => state.resilience_score);
  const scenario = useFlowStore((state) => state.scenario);
  const severity = useFlowStore((state) => state.severity);
  const mode = useFlowStore((state) => state.mode);
  const nodes = useFlowStore((state) => state.nodes);
  const events = useFlowStore((state) => state.events);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [wsMessages, setWsMessages] = useState<WsMessage[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<Record<string, unknown> | null>(null);
  const [auditError, setAuditError] = useState("");
  const [loadingAudit, setLoadingAudit] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const numericScore = useMemo(() => {
    const value = Number(resilienceScore ?? 85);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 85;
  }, [resilienceScore]);

  const nodeList: FlowNode[] = Array.isArray(nodes) ? (nodes as FlowNode[]) : [];
  const eventList: FlowEvent[] = Array.isArray(events) ? (events as FlowEvent[]) : [];

  useEffect(() => {
    const saved = window.localStorage.getItem("security-demo-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setIsDark(saved ? saved === "dark" : Boolean(prefersDark));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("security-demo-theme", isDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const fetchAuditData = useCallback(async () => {
    setLoadingAudit(true);
    setAuditError("");

    try {
      const [verifyResponse, entriesResponse] = await Promise.all([
        fetch("/api/audit/verify", { cache: "no-store" }),
        fetch("/api/audit/entries?limit=20", { cache: "no-store" }),
      ]);

      if (!verifyResponse.ok) {
        throw new Error(`Audit verification returned HTTP ${verifyResponse.status}`);
      }
      if (!entriesResponse.ok) {
        throw new Error(`Audit entries returned HTTP ${entriesResponse.status}`);
      }

      const verifyData: unknown = await verifyResponse.json();
      const entriesData: unknown = await entriesResponse.json();

      setAuditVerification(
        verifyData && typeof verifyData === "object"
          ? (verifyData as Record<string, unknown>)
          : {},
      );

      if (Array.isArray(entriesData)) {
        setAuditEntries(entriesData as AuditEntry[]);
      } else if (
        entriesData &&
        typeof entriesData === "object" &&
        "entries" in entriesData &&
        Array.isArray((entriesData as { entries?: unknown }).entries)
      ) {
        setAuditEntries((entriesData as { entries: AuditEntry[] }).entries);
      } else {
        setAuditEntries([]);
      }
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "Could not load audit data.");
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    void fetchAuditData();
    const timer = window.setInterval(() => void fetchAuditData(), 15000);
    return () => window.clearInterval(timer);
  }, [fetchAuditData]);

  const disconnectWebSocket = useCallback(() => {
    const socket = wsRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      wsRef.current = null;
    }
    setWsStatus("disconnected");
  }, []);

  const connectWebSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setWsStatus("connecting");

    try {
      const token = window.localStorage.getItem("auth_token");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(`${protocol}//${window.location.hostname}:8000/ws`);
      url.searchParams.set("project_id", "demo");

      // Prefer secure authentication mechanisms on the server. This query parameter
      // is retained here only if the existing backend expects it.
      if (token) url.searchParams.set("token", token);

      const socket = new WebSocket(url.toString());
      wsRef.current = socket;

      socket.onopen = () => {
        if (wsRef.current !== socket) return;
        setWsStatus("connected");
        setWsMessages((current) =>
          [
            {
              id: `${Date.now()}-connected`,
              type: "connection",
              payload: { message: "WebSocket connected" },
              time: new Date().toLocaleTimeString(),
              direction: "in" as const,
            },
            ...current,
          ].slice(0, 50),
        );
      };

      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return;

        let parsed: { type?: string; payload?: unknown };
        try {
          parsed = JSON.parse(String(event.data)) as { type?: string; payload?: unknown };
        } catch {
          parsed = { type: "message", payload: event.data };
        }

        setWsMessages((current) =>
          [
            {
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              type: parsed.type ?? "message",
              payload: parsed.payload ?? parsed,
              time: new Date().toLocaleTimeString(),
              direction: "in" as const,
            },
            ...current,
          ].slice(0, 50),
        );
      };

      socket.onerror = () => {
        if (wsRef.current === socket) setWsStatus("error");
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
          setWsStatus("disconnected");
        }
      };
    } catch {
      setWsStatus("error");
    }
  }, []);

  useEffect(() => {
    return () => {
      const socket = wsRef.current;
      if (socket) {
        socket.onclose = null;
        socket.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendCommand = useCallback(
    (command: string, params: Record<string, unknown> = {}) => {
      const socket = wsRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setWsStatus("disconnected");
        return;
      }

      const payload = {
        type: "command",
        payload: { command, params },
        timestamp: Date.now() / 1000,
        message_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };

      try {
        socket.send(JSON.stringify(payload));
        setWsMessages((current) =>
          [
            {
              id: payload.message_id,
              type: "command",
              payload: payload.payload,
              time: new Date().toLocaleTimeString(),
              direction: "out" as const,
            },
            ...current,
          ].slice(0, 50),
        );
      } catch {
        setWsStatus("error");
      }
    },
    [],
  );

  const statusClass =
    wsStatus === "connected"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : wsStatus === "connecting"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : wsStatus === "error"
          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  const auditIsValid = auditVerification?.valid === true;
  const auditIsInvalid = auditVerification?.valid === false;

  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100",
        isDark && "dark",
      )}
    >
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">FLOWGUARD</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Security demo dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex",
                mode === "live"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
              )}
            >
              {mode === "live" ? "LIVE MODE" : "REPLAY MODE"}
            </span>
            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              className="rounded-xl border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className={cn(
            "h-fit rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900",
            !sidebarOpen && "lg:w-[72px]",
          )}
        >
          <div className="mb-3 flex items-center justify-between px-2 py-1">
            {sidebarOpen && (
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Navigation
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>

          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                title={label}
                aria-current={activeTab === id ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                  activeTab === id
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </button>
            ))}
          </nav>

          <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
            <div className="flex items-center gap-2 text-xs font-semibold">
              {wsStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-slate-400" />
              )}
              {sidebarOpen && <span>WebSocket: {wsStatus}</span>}
            </div>
            {sidebarOpen && (
              <button
                type="button"
                onClick={wsStatus === "connected" ? disconnectWebSocket : connectWebSocket}
                className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {wsStatus === "connected" ? "Disconnect" : "Connect"}
              </button>
            )}
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-emerald-600">Monitoring / Security</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">Security overview</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Monitor resilience, service topology, events, and audit integrity.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchAuditData()}
              disabled={loadingAudit}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <RefreshCw className={cn("h-4 w-4", loadingAudit && "animate-spin")} />
              Refresh audit
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium",
                  activeTab === id
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card title="Resilience score" icon={ShieldCheck}>
                  <div className={cn("text-4xl font-bold", scoreColor(numericScore))}>
                    {numericScore.toFixed(0)}
                    <span className="text-lg">/100</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {scoreLabel(numericScore)} system status
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        numericScore >= 80
                          ? "bg-emerald-500"
                          : numericScore >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500",
                      )}
                      style={{ width: `${numericScore}%` }}
                    />
                  </div>
                </Card>

                <Card title="Service nodes" icon={Server}>
                  <div className="text-4xl font-bold">{nodeList.length}</div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Nodes reported by the flow store
                  </p>
                </Card>

                <Card title="Recent events" icon={Activity}>
                  <div className="text-4xl font-bold">{eventList.length}</div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Events currently in state
                  </p>
                </Card>

                <Card title="Audit integrity" icon={Database}>
                  <div className="text-2xl font-bold">
                    {auditVerification
                      ? auditIsValid
                        ? "Verified"
                        : auditIsInvalid
                          ? "Invalid"
                          : "Available"
                      : "Pending"}
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {auditEntries.length} audit entries loaded
                  </p>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card title="Current scenario" icon={Zap}>
                  <dl className="space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Scenario</dt>
                      <dd className="text-right text-sm font-semibold">
                        {scenario ? String(scenario) : "No scenario selected"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Severity</dt>
                      <dd className="text-right text-sm font-semibold">
                        {severity ? String(severity) : "Not reported"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Operating mode</dt>
                      <dd className="text-right text-sm font-semibold">
                        {mode ? String(mode) : "Unknown"}
                      </dd>
                    </div>
                  </dl>
                </Card>

                <Card title="Quick actions" icon={Terminal}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("websocket");
                        if (wsStatus !== "connected") connectWebSocket();
                      }}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"
                    >
                      <Wifi className="h-5 w-5 text-emerald-500" />
                      <span>
                        <span className="block text-sm font-semibold">WebSocket console</span>
                        <span className="text-xs text-slate-500">View messages</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("audit")}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"
                    >
                      <ShieldCheck className="h-5 w-5 text-emerald-500" />
                      <span>
                        <span className="block text-sm font-semibold">Audit trail</span>
                        <span className="text-xs text-slate-500">Inspect integrity</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("topology")}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"
                    >
                      <GitBranch className="h-5 w-5 text-emerald-500" />
                      <span>
                        <span className="block text-sm font-semibold">Service topology</span>
                        <span className="text-xs text-slate-500">Inspect nodes</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("events")}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"
                    >
                      <Activity className="h-5 w-5 text-emerald-500" />
                      <span>
                        <span className="block text-sm font-semibold">Event stream</span>
                        <span className="text-xs text-slate-500">Review recent events</span>
                      </span>
                    </button>
                  </div>
                </Card>
              </div>
            </>
          )}

          {activeTab === "websocket" && (
            <Card title="WebSocket console" icon={Wifi}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", statusClass)} />
                  <span className="text-sm capitalize">{wsStatus}</span>
                </div>
                <div className="flex gap-2">
                  {wsStatus !== "connected" ? (
                    <button
                      type="button"
                      onClick={connectWebSocket}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <Play className="h-4 w-4" /> Connect
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={disconnectWebSocket}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setWsMessages([])}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={wsStatus !== "connected"}
                  onClick={() => sendCommand("ping")}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Send ping
                </button>
                <button
                  type="button"
                  disabled={wsStatus !== "connected"}
                  onClick={() => sendCommand("get_status")}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Get status
                </button>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-auto">
                {wsMessages.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800">
                    No WebSocket messages yet. Connect to begin.
                  </p>
                ) : (
                  wsMessages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {message.type}{" "}
                          <span className="font-normal text-slate-500">
                            ({message.direction})
                          </span>
                        </span>
                        <time className="text-xs text-slate-500">{message.time}</time>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                        {JSON.stringify(message.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {activeTab === "audit" && (
            <Card title="Audit log and integrity" icon={ShieldCheck}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <div className="flex items-center gap-3">
                  {auditIsValid ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : auditIsInvalid ? (
                    <XCircle className="h-6 w-6 text-rose-500" />
                  ) : (
                    <CircleHelp className="h-6 w-6 text-amber-500" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {auditIsValid
                        ? "Audit chain verified"
                        : auditIsInvalid
                          ? "Audit verification failed"
                          : "Verification status unavailable"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Verification endpoint: /api/audit/verify
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchAuditData()}
                  disabled={loadingAudit}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                >
                  <RefreshCw
                    className={cn("mr-2 inline h-4 w-4", loadingAudit && "animate-spin")}
                  />
                  Verify again
                </button>
              </div>

              {auditError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  {auditError}
                </p>
              )}

              {auditVerification && (
                <pre className="mb-5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300">
                  {JSON.stringify(auditVerification, null, 2)}
                </pre>
              )}

              <h3 className="mb-3 font-semibold">Recent entries ({auditEntries.length})</h3>
              {auditEntries.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">
                  No audit entries returned by the API.
                </p>
              ) : (
                <div className="space-y-3">
                  {auditEntries.map((entry, index) => (
                    <div
                      key={String(entry.id ?? index)}
                      className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {String(entry.event ?? entry.action ?? "Audit event")}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                        {JSON.stringify(entry, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === "events" && (
            <Card title="Recent events" icon={Activity}>
              {eventList.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center dark:bg-slate-800">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                  <p className="font-semibold">No events available</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Events will appear here when provided by the application store.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventList.map((event, index) => (
                    <div
                      key={String(event.id ?? event.event_id ?? index)}
                      className="flex gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <div className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {String(event.type ?? event.event ?? event.name ?? "Event")}
                          </p>
                          <time className="text-xs text-slate-500">
                            {formatTime(event.timestamp ?? event.time ?? event.created_at)}
                          </time>
                        </div>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                          {JSON.stringify(event, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === "topology" && (
            <Card title="Service topology" icon={Network}>
              {nodeList.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center dark:bg-slate-800">
                  <Server className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                  <p className="font-semibold">No topology nodes available</p>
                  <p className="mt-1 text-sm text-slate-500">
                    The dashboard will display nodes when the store receives topology data.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {nodeList.map((node, index) => (
                    <div
                      key={String(node.id ?? node.name ?? index)}
                      className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                          <Server className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {String(node.status ?? node.state ?? "unknown")}
                        </span>
                      </div>
                      <p className="font-semibold">
                        {String(node.name ?? node.label ?? node.id ?? `Node ${index + 1}`)}
                      </p>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-500 dark:text-slate-400">
                        {JSON.stringify(node, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <span>FLOWGUARD Security Demo</span>
            <span>Dashboard values depend on the backend and application store.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
