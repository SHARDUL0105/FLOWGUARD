from __future__ import annotations

import asyncio
import json
from collections import deque

from .sim.config import DEFAULT_SEVERITY, FAULT_AT, SEED
from .sim.engine import Simulator
from .sim.topology import ORDER
from .intel.runtime.anomaly import status, update_tracking
from .intel.runtime.root_cause import rank


class AppState:
    def __init__(self):
        self.mode = "live"
        self.lock = asyncio.Lock()
        self.clients = set()
        self.task = None
        self.reset()

    def _calculate_healthy_baseline(self):
        sim = Simulator(
            scenario=None,
            seed=SEED,
        )

        samples = {service: [] for service in ORDER}

        while True:
            result = sim.step()

            if result is None:
                continue

            if result.t < 20:
                for service in ORDER:
                    samples[service].append(
                        result.nodes[service]["resp"]
                    )
                continue

            break

        return {
            service: sum(values) / len(values)
            for service, values in samples.items()
        }

    def reset(self):
        self.scenario = None
        self.severity = 3.0

        self.sim = Simulator(
            scenario=None,
            seed=SEED,
        )

        self.first = {}
        self.previous = {
            service: "healthy"
            for service in ORDER
        }
        self.recovered = {}

        self.baseline = self._calculate_healthy_baseline()

        self.history = deque(maxlen=30)
        self.latest = None

    async def start(self):
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._loop())

    async def _loop(self):
        while True:
            await asyncio.sleep(1)

            if self.mode != "live":
                continue

            result = self.sim.step()

            if result is None:
                continue

            message = self.make_tick(result)

            self.latest = message
            self.history.append(message)

            if not self.clients:
                continue

            dead_clients = []

            for websocket in list(self.clients):
                try:
                    await websocket.send_text(
                        json.dumps(message)
                    )
                except Exception:
                    dead_clients.append(websocket)

            for websocket in dead_clients:
                self.clients.discard(websocket)

    def configure_fault(self, scenario, severity=None):
        self.scenario = scenario

        self.severity = (
            DEFAULT_SEVERITY[scenario]
            if severity is None
            else severity
        )

        self.sim = Simulator(
            scenario=scenario,
            severity=self.severity,
            seed=SEED,
        )

        self.first = {}
        self.previous = {
            service: "healthy"
            for service in ORDER
        }
        self.recovered = {}

        self.history.clear()
        self.latest = None

    def make_tick(self, result):
        nodes = {}

        for service, data in result.nodes.items():
            nodes[service] = {
                "status": status(
                    data["resp"],
                    self.baseline[service],
                    data["succ"],
                ),
                "p95_ms": round(1.5 * data["resp"]),
                "error_rate": round(1 - data["succ"], 3),
                "load_rps": round(data["load"], 1),
                "utilization": round(data["rho"], 2),
            }

        current_status = {
            service: nodes[service]["status"]
            for service in ORDER
        }

        events = update_tracking(
            self.previous,
            current_status,
            result.t,
            self.first,
            self.recovered,
        )

        self.previous = current_status

        anomalous = [
            service
            for service in ORDER
            if nodes[service]["status"] != "healthy"
        ]

        analysis = None

        if anomalous:
            analysis = rank(
                self.first,
                anomalous,
                result.nodes,
            )

        return {
            "type": "tick",
            "t": result.t,
            "mode": self.mode,
            "scenario": (
                self.scenario
                if result.t >= FAULT_AT
                else None
            ),
            "severity": self.severity,
            "nodes": nodes,
            "checkout": {
                "p95_ms": round(result.p95),
                "error_rate": round(result.err, 3),
            },
            "events": events,
            "analysis": analysis,
        }


state = AppState()