# Demo script (3 minutes)

Pre-flight: `./start.sh`, open http://localhost:3000/command-center. If anything misbehaves, click **Replay** (top right); everything runs from recorded fixtures with the backend off.

1. **Healthy graph.** Calm graph, steady particles, checkout health near 100.
2. **Database slowdown** (key `1`). Database goes red first, then Inventory/Payment, Order, Gateway, Frontend, one hop per second.
3. **Origin lock-on.** Radar locks onto Database (confidence estimate), cascade chips light up, blast radius shows 5 services.
4. **Incident commander** types out the brief (badge shows LLM / template / fixture).
5. **What if.** Drag the slider 2.0x, 2.5x, 3.0x. Accuracy ~100% at 2.0x and 2.5x; at 3.0x the forecast says 174 ms vs 628 ms measured, accuracy drops, risk stays HIGH. Say it out loud: the forecast is deliberately simple.
6. **Pull requests, PR #12.** Score 84 to 32, three findings, GitHub-style comment.
7. **Run Verified Auto-Fix.** Diff appears, gauge sweeps 32 to 84, "Verified under 3 faults" badge.

Honest framing: validated on a simulated environment. Production path is OpenTelemetry traces plus Toxiproxy fault injection.
