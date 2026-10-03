# FLOWGUARD - Master Build Brief for the AI Coding Assistant

**How to use this document.** Paste this ENTIRE document as the first message to your AI tool. Then send one Task Prompt from Section 15 (each teammate sends the one for their own area). The AI must treat everything here as the single source of truth. If something is not specified, the AI picks the simplest option, states the assumption in one line, and continues. It must not stop to ask more than ONE clarifying question.

## 1. Your role and ground rules (AI: read carefully)

You are a senior full-stack engineer on a 4-person hackathon team. You are building a PROTOTYPE of a product called FLOWGUARD in about 1.5 days. The goal is to WIN a national-level hackathon by showing an impressive, reliable, visually stunning demo. It is NOT a production system.

Rules you must follow:

- **Follow the contract exactly.** Endpoint names, JSON field names and types in Section 10 are fixed. Never rename them. If you think a change is needed, say so in one line and keep the original.
- **Stay in scope.** Build only what Section 3 says is IN scope. Do not add features, pages, databases, auth, Docker, Kubernetes or real telemetry.
- **Deterministic by default.** Every simulation uses a fixed random seed (7). The same input must give the same score every time.
- **Complete files only.** Output full working files with no placeholders like "TODO" or "rest of the code here".
- **Run instructions.** End every answer with (a) exact commands to run, (b) one way to verify it works, (c) which file paths you created.
- **Never break the demo.** Every network call in the frontend must have a fallback to recorded fixtures (Section 13). Every LLM call must have a canned fallback (Section 9).
- **ASCII-safe code and comments.** Keep it simple, readable and typed (TypeScript types on the frontend, Pydantic models on the backend).
- **Quality bar.** The frontend must look like a premium mission-control product, not a student project. Backend must be small, clear and correct.

## 2. Project context

**Product.** FLOWGUARD is a predictive reliability platform. It models how failures propagate through the services of an application and lets engineers detect, understand, predict, simulate and prevent cascading failures BEFORE they ship.

**One-line pitch.** "Other tools tell you what's broken. FLOWGUARD fixes it and proves it."

**Problem.** In microservice apps, a small slowdown in one component (for example a database) cascades: Database slows -> Inventory/Payment time out -> Order Service slows -> Gateway errors -> Checkout fails. Monitoring tells you something is wrong but not the origin, the spread, or what to fix first. Small teams have no SRE and no Datadog budget.

**Core idea.** Keep a live dependency graph of the application, detect abnormal behaviour, trace it back to the likely root cause, estimate blast radius, forecast what a failure will do (what-if), and check every pull request (PR) for reliability regressions. The signature feature is **Verified Auto-Fix**: FLOWGUARD generates a patch for a risky PR, RE-RUNS the same fault tests against the patched config, and only accepts the patch if the resilience score measurably improves.

**Five stages shown in the UI:** DETECT -> UNDERSTAND -> PREDICT -> SIMULATE -> RECOMMEND.

**Hackathon facts.** Event: CURIOUSPARC 2026 State Innovation Challenge. Prototype deadline: 4 Oct, 11:59 pm. Team CodeX: Shardul Kulkarni (frontend, AI prompts, demo/pitch owner), Abhiraj Mangire (backend, simulator, integration owner), Sneha Barge (intelligence/scoring), Vaishnavi Repal (PR checks, Auto-Fix, AI integration).

**Honest framing (important for the UI copy and README).** The prototype runs on a SIMULATED microservice environment that lives inside the backend. The production path is OpenTelemetry traces and real fault injection (Toxiproxy). Never claim the prototype monitors a real production system. Say "validated on a simulated environment".

## 3. Scope

**IN scope (must work reliably):**

1. A tick-based simulator of 6 services with queueing, timeouts, retries, circuit breakers and fallbacks. The cascade must EMERGE from the model, not be hardcoded.
2. Three fault scenarios: database latency, service down, traffic spike.
3. Intelligence layer: anomaly status per node, propagation path, root-cause ranking with confidence, blast radius, resilience score (0-100), analytic forecast (predictor).
4. What-If simulator: forecast vs measured result, with an honest accuracy figure.
5. PR Resilience Check on 2-3 demo PRs (config diffs): scan rules, score delta, GitHub-style comment.
6. Verified Auto-Fix: patch from templates, real re-run, acceptance gate, before/after.
7. AI Incident Commander: LLM-written incident brief streamed to the UI, with guardrails and a canned fallback.
8. A stunning frontend: Command Center (hero page) and PR report page, plus a landing page.
9. Demo mode: the whole product works from recorded fixtures if live mode fails.

**OUT of scope (do NOT build):** Docker, Kubernetes, OpenTelemetry, Toxiproxy, Postgres/Redis, authentication, multi-tenancy, a real GitHub App, real security scanning, mobile layouts, incident replay page, command palette, tests beyond one simulator test.

## 4. Tech stack (fixed)

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, NetworkX (optional), httpx (LLM calls), python-dotenv. No database: keep state in memory, fixtures as JSON files.
- **Frontend:** Next.js 14 (App Router) + TypeScript, Tailwind CSS, Framer Motion, React Flow (package `@xyflow/react`), Recharts, Zustand, lucide-react. shadcn/ui optional.
- **Transport:** REST + one WebSocket (`/ws`) + one Server-Sent Events stream (`/api/brief`). CORS enabled for `http://localhost:3000`.
- **LLM:** provider-agnostic wrapper reading `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` from `.env`. If missing or failing, use the canned fallback.
- **Run:** backend `uvicorn app.main:app --reload --port 8000`; frontend `npm run dev` (port 3000); `start.sh` runs both.

## 5. Repository structure (fixed)

```
FLOWGUARD/
|-- README.md  .env.example  start.sh
|-- docs/api-contract.md  docs/demo-script.md
|-- fixtures/                      # recorded outputs, same JSON shapes as the API
|   |-- topology.json  graph.healthy.json
|   |-- run.db_latency.json  run.service_down.json  run.traffic_spike.json
|   |-- whatif.db_latency.json  pr.list.json  pr.risky.analyze.json  pr.risky.heal.json
|   `-- brief.sample.md
|-- scripts/record_fixtures.py     # runs the real engine and writes fixtures/
|-- backend/
|   |-- requirements.txt
|   `-- app/
|       |-- main.py  api.py  schemas.py  state.py
|       |-- sim/   topology.py  config.py  engine.py  faults.py
|       |-- intel/ anomaly.py  propagation.py  root_cause.py  blast_radius.py
|       |          scoring.py  predictor.py
|       |-- pr/    prs.py  scanner.py  heal.py  gate.py
|       |-- ai/    llm.py  brief.py  pr_comment.py  guardrails.py
|       |          prompts/incident_brief.md  prompts/pr_comment.md
|       `-- tests/test_sim.py
`-- frontend/
    |-- app/ layout.tsx  globals.css  page.tsx
    |        command-center/page.tsx  pull-requests/[id]/page.tsx
    |-- components/graph/    FlowGraph  ServiceNode  PropagationEdge
    |-- components/score/    ResilienceGauge  ScoreDelta
    |-- components/incident/ IncidentCommander  RootCauseRadar  CascadePath
    |-- components/sim/      ChaosButtons  WhatIfSlider  PredVsMeasured
    |-- components/heal/     DiffViewer  BeforeAfterPanel  VerifiedBadge
    |-- components/layout/   TopBar  StatusTicker  DemoModeToggle
    |-- components/effects/  GridBackground  GlowCard  NumberTicker
    |-- hooks/  useLiveGraph.ts  useStreamedText.ts
    |-- store/  flowguardStore.ts
    `-- lib/    api.ts  ws.ts  types.ts  mock.ts  colors.ts
```

## 6. Simulation specification (backend/app/sim)

The simulator is a **tick-based** model. 1 tick = 1 simulated second. A reference implementation is in **Appendix A**: reproduce its behaviour exactly (same constants, same equations, same seed). You may restructure it into the files above, but the numbers it produces must match Appendix B within rounding.

**Services** (`base_ms` = own latency at zero load; `capacity_rps` = requests/second handled at base latency):

| Service | base_ms | capacity_rps | Calls (in order) |
|---|---|---|---|
| frontend | 20 | 500 | gateway |
| gateway | 15 | 400 | order |
| order | 40 | 250 | inventory, then payment |
| inventory | 30 | 250 | database |
| payment | 60 | 200 | database |
| database | 10 | 600 | none |

Baseline external load: 100 checkout requests/second at the frontend (with +-2% seeded noise). A checkout flows frontend -> gateway -> order -> inventory -> database, then order -> payment -> database. So the database receives about 200 queries/second.

**Edge configuration** (this is what a PR changes). Defaults:

| Edge | timeout_ms | retries | breaker | fallback |
|---|---|---|---|---|
| frontend -> gateway | 3000 | 0 | false | false |
| gateway -> order | 2500 | 0 | false | false |
| order -> inventory | 700 | 1 | true | true (cached stock) |
| order -> payment | 900 | 0 | true | true (pay-later queue) |
| inventory -> database | 400 | 1 | false | false |
| payment -> database | 400 | 0 | false | false |

`timeout_ms = null` means no timeout (treated as 30000 ms). `fallback = true` means that when the call fails or the breaker is open, the caller still succeeds in a degraded way. `breaker = true` means: if the callee's last-tick success probability is below 0.5, the edge opens (fails fast in 2 ms, sends no load to the callee, uses fallback if enabled).

**Per-tick equations** (details and exact code in Appendix A):

1. Offered load: top-down. Each caller sends `load * expected_attempts` to each callee, where `expected_attempts = (1 - q^(retries+1)) / (1 - q)` and `q` is the single-attempt failure probability of that edge. This is how **retry storms emerge**.
2. Utilization: `rho = load / (capacity / latency_multiplier)`. Own latency = `base_ms * multiplier * noise / (1 - min(rho, 0.95))`. If `rho > 1`, the service serves only `1/rho` of requests (the rest are errors).
3. Edge attempt: single-attempt success probability = `callee_success * (1 - exp(-(timeout/callee_response)^2))` (a smooth timeout model). Edge success with retries = `1 - q^(retries+1)`; expected time = `min(response, timeout) * expected_attempts`.
4. Response time of a service = own latency + sum of expected edge times of its sequential calls. Success = served fraction x product of edge successes.
5. **One-tick lag:** callers read the callee's PREVIOUS-tick state. This makes degradation travel one hop upstream per tick, so the cascade has a real temporal order (database first, then inventory/payment, then order, gateway, frontend).
6. Checkout metrics: `p95_ms = min(1.5 * frontend_response, 3000)`, `error_rate = 1 - frontend_success`.

**Faults** (start at tick 10 of a run; severity is the factor):

| Scenario id | Effect | Default severity |
|---|---|---|
| `db_latency` | database latency multiplier = severity (its effective capacity drops by the same factor) | 3.0 |
| `service_down` | inventory returns instant errors (5 ms, success 0) | 1 |
| `traffic_spike` | external load multiplied by severity | 2.0 |

**Run modes:** (a) live mode: a background asyncio task advances the simulator 1 tick per second and broadcasts over `/ws`; (b) headless mode: run N ticks instantly and return metrics (used for scoring, what-if and PR checks). Headless runs use 10 warm-up ticks (not reported), then 60 ticks, fault at tick 10, and metrics are averaged over ticks 20-59.

## 7. Intelligence specification (backend/app/intel)

**Node status** per tick, comparing a node's response time `resp` with its healthy baseline `resp0` and its success probability `succ`:

- `critical` if `succ < 0.8` or `resp/resp0 >= 3`
- `degraded` if `succ < 0.98` or `resp/resp0 >= 1.5`
- otherwise `healthy`

An **anomaly start** event is emitted the first tick a node leaves `healthy` (record `t_first`). Emit `recovered` when it returns to healthy for 5 consecutive ticks.

**Propagation path.** Among anomalous nodes, build the chain from the root cause up through callers ordered by `t_first`. Return the longest chain, e.g. `["database","inventory","order","gateway","frontend"]`, plus the set of all affected nodes.

**Root-cause ranking** (always labelled "confidence estimate", never certainty). For each anomalous node:

```
earliness = 1 - (t_first - t_min) / (t_max - t_min + 1)
impact    = (number of anomalous transitive callers) / max(1, anomalous_nodes - 1)
severity  = min(1, (own_ms / base_ms) / 10)
raw       = 0.5*earliness + 0.3*impact + 0.2*severity
confidence = raw / sum(raw over candidates)
```

Return candidates sorted by confidence, each with `evidence` strings such as "latency rose first (tick 10)" and "4 upstream services degraded after it".

**Blast radius.** `direct` = services that call the root cause directly. `downstream` = all further transitive callers. Also return `total` and a `checkout_at_risk` boolean.

**Resilience score (0-100).** Run the 3 scenarios headless at their default severities. Baseline = no-fault run (same window).

```
err_pen  = min(1, error_rate / 0.5)
lat_pen  = min(1, max(0, p95 / baseline_p95 - 1) / 3)
scenario_penalty = 0.6*err_pen + 0.4*lat_pen
score = round(100 * (1 - mean(scenario_penalty over the 3 scenarios)))
```

**Predictor ("Cascade Risk Forecast").** `predict()` in Appendix A is a deliberately simpler STEADY-STATE analytic model: one attempt per request (no retry load), no lag, no noise, hard timeout threshold. It returns `p95_ms`, `error_rate`, per-service `utilization`, `saturated` services and a `risk` level (LOW/MEDIUM/HIGH from the highest utilization: <0.8 LOW, 0.8-0.95 MEDIUM, >=0.95 HIGH). Do NOT make it match the simulator exactly: it should be accurate in steady regimes and honestly diverge near the saturation cliff. The UI reports accuracy as `max(0, 1 - abs(pred - measured)/measured)` on p95. Name it "forecast", never "guaranteed prediction".

**What-If.** `POST /api/whatif {scenario, factor}` runs the predictor AND a headless simulation, and returns both plus accuracy, risk and a `note` string when accuracy < 80% ("Forecast ignores retry feedback near saturation; risk level HIGH is still correct.").

## 8. PR Resilience Check and Verified Auto-Fix (backend/app/pr)

PRs are demo data (no real GitHub). A PR = id, title, author, a unified diff of `order-service/config.yaml`, and the resulting edge config. Provide three:

| id | title | change | expected result |
|---|---|---|---|
| 12 | Refactor inventory client | on edge order->inventory: remove `timeout_ms`, set `retries: 4`, remove `circuit_breaker` and `fallback` | score drops (about 84 -> 32) |
| 13 | Update README and logging | no edge changes | score unchanged (84), no findings |
| 12-fix | Auto-Fix for PR 12 (generated) | restores timeout, bounded retries, breaker + fallback | score recovers (about 84) |

**Scanner rules** (only on edges CHANGED by the PR; each finding has rule id, severity, edge, human message, evidence):

- `R1_TIMEOUT` (high): `timeout_ms` is null OR larger than the caller's own upstream timeout. Message: "No effective timeout on order -> inventory; callers can hang until the gateway gives up."
- `R2_RETRY_STORM` (high): `retries >= 3`. Message: "4 retries without backoff multiplies load on a struggling dependency."
- `R3_NO_FALLBACK` (medium): `breaker == false` and `fallback == false` on a changed edge to a non-database service.

**Auto-Fix templates** (heal.py): R1 -> set timeout to 700 ms (or 0.3 x upstream timeout if lower). R2 -> set retries to 1. R3 -> set `breaker: true` and `fallback: true`. Produce the patched config and a unified diff string.

**Acceptance gate** (gate.py). Re-run the 3 scenarios + a no-fault smoke run on the patched config. ACCEPT only if all hold: `score_after >= score_pr + 15`; no scenario's error rate is worse than in the PR; healthy-path p95 <= 1.10 x baseline. Otherwise return `gate: "rejected"` with the reason. Always return the measured per-scenario numbers and `verified_under: ["db_latency","service_down","traffic_spike"]`.

**PR comment** (pr_comment.py) renders GitHub-style markdown: verdict line, score delta, table of the 3 scenarios (base vs PR), top finding with the cascade path, and the suggested fix. The UI shows the exact comment in a preview card.

## 9. AI layer (backend/app/ai)

AI is an EXPLANATION layer on structured evidence. It never invents numbers.

- `llm.py`: `async def complete_stream(system, user) -> AsyncIterator[str]`. Reads env vars. Timeout 6 s. On any error or missing key, raise `LLMUnavailable`.
- `brief.py`: builds an **evidence JSON** (scenario, severity, first-anomaly order with ticks, root-cause candidates with confidence, propagation path, blast radius, checkout p95/error rate before and now, predicted vs measured if available) and streams the incident brief.
- `guardrails.py`: after generation, extract every number from the text and verify it appears in the evidence JSON (allow +-1 rounding). If any number is not found, discard the text and use the deterministic template brief instead.
- **Fallback chain:** LLM stream -> deterministic template brief built with f-strings from the evidence -> `fixtures/brief.sample.md`. Streamed to the UI at about 40 characters per second so it looks live either way.

**System prompt for the incident brief (use verbatim):**

```
You are FLOWGUARD's Incident Commander, an SRE assistant. You receive EVIDENCE as JSON.
Write a concise incident brief for an engineer. Rules:
- Use ONLY facts and numbers present in the EVIDENCE. Never invent metrics or services.
- Root cause must be described as a confidence estimate, not certainty.
- Exactly 4 sections with these bold headings: What happened, Likely origin,
  Blast radius, Recommended actions.
- Recommended actions: at most 3 bullets, concrete and ordered by priority.
- Maximum 140 words. Plain language. No markdown other than the bold headings and bullets.
```

## 10. API contract (fixed - backend serves it, frontend consumes it)

Base URL `http://localhost:8000`. All JSON. Fixtures in `fixtures/` use these exact shapes.

**GET /api/topology**

```json
{ "nodes": [{"id":"database","label":"Database","layer":4,"base_ms":10,"capacity_rps":600}],
  "edges": [{"source":"order","target":"inventory","timeout_ms":700,"retries":1,
             "breaker":true,"fallback":true}] }
```

**WS /ws** - one message per tick (1 per second in live mode):

```json
{ "type":"tick", "t":14, "mode":"live", "scenario":"db_latency", "severity":3.0,
  "nodes": { "database": {"status":"critical","p95_ms":300,"error_rate":0.0,
                          "load_rps":212.0,"utilization":1.04} },
  "checkout": {"p95_ms":468,"error_rate":0.0},
  "events": [{"t":10,"node":"database","kind":"anomaly_start","msg":"Database latency rising"}],
  "analysis": { "root_cause":[{"node":"database","confidence":0.71,
                  "evidence":["latency rose first (tick 10)","4 upstream services degraded after it"]}],
                "propagation_path":["database","inventory","order","gateway","frontend"],
                "blast_radius":{"direct":["inventory","payment"],
                  "downstream":["order","gateway","frontend"],"total":5,"checkout_at_risk":true} } }
```

`analysis` is `null` while the system is healthy. Statuses are `"healthy" | "degraded" | "critical"`.

**POST /api/chaos** body `{"scenario":"db_latency","severity":3.0}` -> `{"started":true,"scenario":"db_latency","t0":10}`.
**POST /api/reset** -> `{"ok":true}`. **GET /api/health** -> `{"ok":true,"mode":"live"}`.
**GET /api/demo/mode** and **POST /api/demo/mode** body `{"mode":"live"|"replay"}`. In `replay` the backend streams `fixtures/run.*.json` over `/ws` with the same shape.

**POST /api/whatif** body `{"scenario":"db_latency","factor":2.5}`:

```json
{ "scenario":"db_latency","factor":2.5,
  "predicted":{"p95_ms":873,"error_rate":0.0,"risk":"MEDIUM","saturated":[]},
  "measured":{"p95_ms":875,"error_rate":0.0},
  "accuracy":0.998, "note":null }
```

**GET /api/pr** -> `[{"id":12,"title":"Refactor inventory client","author":"dev-a","status":"open"}, ...]`

**POST /api/pr/{id}/analyze**:

```json
{ "id":12, "score_base":84, "score_pr":32, "verdict":"regression",
  "per_scenario":[{"scenario":"db_latency","base":{"p95_ms":628,"error_rate":0.004},
                   "pr":{"p95_ms":3000,"error_rate":0.93}}],
  "findings":[{"rule":"R1_TIMEOUT","severity":"high","edge":"order->inventory",
               "message":"No effective timeout on order -> inventory","evidence":"timeout_ms: null"}],
  "cascade_path":["database","inventory","order","gateway","frontend"],
  "diff":"--- a/order-service/config.yaml\n+++ b/order-service/config.yaml\n...",
  "comment":"### FLOWGUARD Resilience Check ... (markdown)" }
```

**POST /api/pr/{id}/heal**:

```json
{ "id":12, "gate":"accepted", "reason":null, "score_before":32, "score_after":84,
  "patch_diff":"@@ order -> inventory @@\n+  timeout_ms: 700\n+  retries: 1 ...",
  "per_scenario_after":[{"scenario":"db_latency","p95_ms":628,"error_rate":0.004}],
  "verified_under":["db_latency","service_down","traffic_spike"] }
```

**GET /api/brief?scenario=db_latency** (or `?pr=12`) -> Server-Sent Events: `data: {"chunk":"..."}` repeated, then `data: {"done":true,"source":"llm|template|fixture"}`.

## 11. Frontend specification (frontend/) - this decides whether judges are impressed

**Design system.** Dark "mission control" look. Background `#070B14` with a faint animated grid. Cards are glass panels (`rgba(255,255,255,0.04)`, 1px border `rgba(255,255,255,0.08)`, backdrop blur, rounded-2xl) with a soft cursor-follow glow. Status colours: healthy cyan `#22D3EE`, degraded amber `#F59E0B`, critical red `#EF4444`, accent violet `#8B5CF6`. Fonts: Inter for UI, JetBrains Mono for numbers/metrics. Subtle motion everywhere (Framer Motion), never janky. Desktop 1440x900 is the target.

**Pages.**

1. `/` Landing: full-screen hero with the product name, the line "Don't wait for your system to fail. Predict it. Simulate it. Stop it.", the five stages DETECT -> UNDERSTAND -> PREDICT -> SIMULATE -> RECOMMEND animating in, and a glowing "Enter Command Center" button.
2. `/command-center` (HERO). Layout: top bar (logo, system status pill that turns red during incidents, Live/Replay toggle, link to Pull Requests). Left 68%: the React Flow graph, full height. Right 32%, stacked glass cards: Resilience gauge (live checkout health), Root Cause Radar, Cascade Path chips, Incident Commander. Bottom strip: Chaos Lab buttons (Database Slowdown, Inventory Down, Traffic Spike, Reset), What-If slider, and a scrolling status ticker of events.
3. `/pull-requests/[id]` PR report: header with PR title and author; big ScoreDelta (count-up 84 -> 32, red); findings list; per-scenario table; cascade path; the GitHub-style comment preview; a "Run Verified Auto-Fix" button that reveals the diff viewer, then the BeforeAfterPanel (gauge sweeping from 32 up to 84), then the glowing "Verified under 3 faults" badge. This is the climax of the demo.

**Fixed graph layout** (React Flow node positions): frontend (0,200), gateway (260,200), order (520,200), inventory (780,70), payment (780,330), database (1040,200). Use custom node and edge types, hide the React Flow attribution only if licence allows, otherwise keep it subtle.

**Components and behaviour.**

- `ServiceNode`: glass card with service name, status ring (colour by status), live p95 number (NumberTicker), tiny sparkline of the last 30 ticks, soft pulse when degraded, hard red pulse + subtle shake when critical.
- `PropagationEdge`: animated particles flowing along each dependency edge. Healthy: slow cyan particles. Degraded: amber, faster. Critical: red, fast and jittery. Edge label shows timeout/retries on hover.
- Cascade animation: when a fault starts, nodes change colour in the order the backend reports (`t_first`), producing a visible wave from the root cause. A shockwave ring expands from the root-cause node.
- `ResilienceGauge`: animated radial gauge 0-100; colour shifts red/amber/cyan; used live (checkout health = 100 * (1 - error_rate) adjusted by latency) and on the PR page (score).
- `RootCauseRadar`: circular radar with a rotating sweep that "locks" onto the top candidate; ranked list with confidence bars labelled "confidence estimate".
- `CascadePath`: chips like `Database -> Inventory -> Order -> Gateway -> Frontend` that light up sequentially.
- `IncidentCommander`: streams the brief from `/api/brief` with a typewriter effect (`useStreamedText`), shows a small source badge (LLM / template), and highlights numbers.
- `WhatIfSlider`: slider (1.0x-4.0x) for database latency; on release call `/api/whatif`; show `PredVsMeasured` paired bars, accuracy badge, risk badge, and the honest note when accuracy is low.
- `DiffViewer`: side-by-side unified diff with red/green lines and monospace font. `BeforeAfterPanel`: two gauges plus per-scenario bars. `VerifiedBadge`: glowing check badge "Verified under 3 faults".
- Effects: `GridBackground`, `GlowCard`, `NumberTicker`. On critical failure: brief red vignette over the screen (once, 600 ms), plus a toast-like alert strip.

**State and data.** Zustand store holds topology, per-node history (last 30 ticks), checkout metrics, events, analysis, mode. `lib/ws.ts` connects to `/ws` with auto-reconnect. `lib/api.ts` wraps REST and, when the backend is unreachable or mode is `replay`, loads from `lib/mock.ts` (which reads the same JSON as `fixtures/`). The UI must work end-to-end with the backend OFF (replay/mock mode).

**TypeScript types** in `lib/types.ts` must mirror Section 10 exactly (NodeStatus, NodeMetrics, TickMessage, Analysis, RootCauseCandidate, WhatIfResponse, PRListItem, AnalyzeResponse, HealResponse).

## 12. Demo script and acceptance criteria

**The 3-minute demo (everything must work with one click each):**

1. Command Center, healthy: graph is calm, cyan particles flowing, gauge at 100.
2. Click "Database Slowdown". The database turns red first, then inventory and payment, then order, gateway, frontend, one hop per second. Anomaly events appear in the ticker.
3. Root Cause Radar locks onto Database (top confidence). Cascade path chips light up. Blast radius shows 5 affected services.
4. Incident Commander streams the brief.
5. What-If: drag the slider 2.0x -> 2.5x -> 3.0x. Show predicted vs measured, accuracy near 100% at 2.0x/2.5x and the honest divergence + HIGH risk badge at 3.0x.
6. Open Pull Requests -> PR 12. Score drops 84 -> 32. Findings and the GitHub-style comment appear.
7. Click "Run Verified Auto-Fix": diff appears, gauge sweeps 32 -> 84, "Verified under 3 faults" badge glows.

**Acceptance checklist (the app is done when all are true):**

- [ ] `./start.sh` starts backend and frontend; the Command Center loads with no console errors.
- [ ] Simulator is deterministic: two runs with the same inputs produce identical scores.
- [ ] Base score is about 84, PR 12 about 32, healed about 84 (Appendix B), and the UI shows whatever the engine returns.
- [ ] The DB-latency cascade order is database -> payment/inventory -> order -> gateway -> frontend.
- [ ] Root cause ranking puts `database` first for `db_latency` and `inventory` first for `service_down`.
- [ ] Turning the backend OFF and enabling Replay still plays the full demo from fixtures.
- [ ] LLM key missing -> the brief still streams (template/fixture).
- [ ] No placeholder text, no "lorem ipsum", no broken layout at 1440x900 and 1920x1080.

## 13. Fixtures (recorded fallback)

`scripts/record_fixtures.py` runs the real engine and writes the files listed in Section 5, using the exact API shapes. `run.*.json` = `{"scenario":..., "ticks":[<TickMessage>, ...]}` for 40 ticks with the fault at tick 10. The frontend `mock.ts` and the backend `/api/demo/mode = replay` both read these files. Commit the fixtures to the repo so a teammate with a broken backend can still develop and demo.

## 14. Team ownership and git rules

| Person | Owns (edit only these) |
|---|---|
| Shardul | `frontend/`, `backend/app/ai/prompts/`, `docs/demo-script.md` |
| Abhiraj | `backend/app/main.py api.py schemas.py state.py`, `backend/app/sim/`, `fixtures/`, `scripts/`, `start.sh`, integration |
| Sneha | `backend/app/intel/`, `backend/app/tests/` |
| Vaishnavi | `backend/app/pr/`, `backend/app/ai/*.py` |

Branches `feat/<area>`, small PRs into `main`, `main` must always run. Abhiraj merges. Freeze features at 4 pm on 4 Oct; only bug fixes after.

## 15. Task prompts (send ONE of these after pasting this document)

**Task prompt - Shardul (frontend):**

```
Using the FLOWGUARD Master Build Brief, build the complete frontend in /frontend.
Order of work: (1) project setup, Tailwind theme tokens, lib/types.ts from Section 10,
lib/mock.ts reading fixtures; (2) Command Center page with FlowGraph, ServiceNode,
PropagationEdge driven by mock tick data; (3) WebSocket hook + Zustand store;
(4) ChaosButtons, ResilienceGauge, CascadePath, RootCauseRadar, IncidentCommander
(typewriter), WhatIfSlider + PredVsMeasured; (5) PR report page with ScoreDelta, findings,
comment preview, DiffViewer, BeforeAfterPanel, VerifiedBadge; (6) landing page, effects,
Live/Replay toggle, red-vignette on critical. Deliver step 1-2 first as complete files,
then continue when I say "next". Follow Section 11 exactly. Must work with backend OFF.
```

**Task prompt - Abhiraj (backend and simulator):**

```
Using the FLOWGUARD Master Build Brief, build backend/app/main.py, api.py, schemas.py,
state.py and the whole backend/app/sim package, plus start.sh and
scripts/record_fixtures.py. Implement Appendix A faithfully (same constants and equations,
seed 7). Provide: live mode (asyncio task, 1 tick/s, WebSocket /ws), headless runs,
/api/topology, /api/chaos, /api/reset, /api/health, /api/demo/mode with fixture replay,
CORS for localhost:3000. Stub intel/pr/ai calls behind clean function signatures so
teammates can plug in. Include tests/test_sim.py checking determinism and the baseline
numbers in Appendix B.
```

**Task prompt - Sneha (intelligence):**

```
Using the FLOWGUARD Master Build Brief, implement backend/app/intel: anomaly.py (status
thresholds and first-anomaly tracking), propagation.py (path), root_cause.py (ranking
formula in Section 7), blast_radius.py, scoring.py (resilience score) and predictor.py
(wrapping predict() from Appendix A, plus accuracy and risk and the what-if endpoint
logic). Pure functions with type hints, importing the simulator headless API. Add tests
that assert: db_latency -> root cause database; service_down -> inventory; base score ~84.
```

**Task prompt - Vaishnavi (PR checks, Auto-Fix, AI):**

```
Using the FLOWGUARD Master Build Brief, implement backend/app/pr (prs.py with the 3 demo
PRs, scanner.py with rules R1-R3, heal.py templates and unified diff, gate.py acceptance
gate) and backend/app/ai (llm.py, brief.py, guardrails.py, pr_comment.py and the prompt
files). Implement POST /api/pr/{id}/analyze, POST /api/pr/{id}/heal and GET /api/brief
(SSE) exactly as in Section 10, using the simulator and scoring functions. LLM must have
the fallback chain in Section 9 and the number-verification guardrail.
```

## 16. Definition of done and risks

- A judge can run the full 3-minute demo without anyone touching code, in live mode AND in replay mode.
- Biggest risks: integration late on Saturday (fix: contract + fixtures from hour 1), LLM latency (fix: fallback chain), scope creep (fix: Section 3 OUT list), flaky live demo (fix: replay toggle + backup video).
- If time runs short, cut in this order: landing page polish, effects, What-If note text, comment preview. NEVER cut: graph cascade, root cause, score delta, Auto-Fix reveal, replay mode.

## Appendix A - Reference simulator (implement this exactly)

{{REFERENCE_SIM}}

## Appendix B - Expected reference numbers (seed 7, tolerance +-2 points / +-5%)

| Check | Expected |
|---|---|
| Baseline checkout (no fault) | p95 about 468 ms, error rate 0.0 |
| Base resilience score | 84 |
| db_latency x3 (base config) | p95 about 628 ms, error about 0.004; cascade DB (tick 10) -> payment/inventory (11) -> order (12) -> gateway (13) -> frontend (14) |
| service_down (inventory), base config | p95 about 369 ms, error 0.0 (fallback holds) |
| traffic_spike x2 (base config) | p95 about 2018 ms, error about 0.028 (payment saturates) |
| PR 12 (risky) score | 32 (db_latency error about 0.93; service_down error 1.0) |
| PR 12 after Auto-Fix | 84 |
| Forecast vs measured, db_latency | x1.5: 100%, x2.0: 100%, x2.5: 100% accurate; x3.0: forecast under-predicts p95 (174 vs 628 ms) but risk is HIGH |

Note for the team: the numbers on the pitch deck slide 5 (86 -> 47 -> 88) were illustrative. Update them to the engine's real output (84 -> 32 -> 84) before submitting.
