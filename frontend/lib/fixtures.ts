// Recorded from the reference simulator (reference_sim.py, seed 7). Same shapes as the API contract.
// Regenerate with scripts/record_fixtures.py once the backend exists.
import type { ScenarioId, WhatIfResponse } from "./types";

export interface ScenarioRun { score: number; baseline: { p95_ms: number; error_rate: number }; per: { scenario: ScenarioId; p95_ms: number; error_rate: number }[] }
export const RUNS: { base: ScenarioRun; pr12: ScenarioRun; healed: ScenarioRun } = {
 "base": {
  "score": 84,
  "baseline": {
   "p95_ms": 468,
   "error_rate": 0.0
  },
  "per": [
   {
    "scenario": "db_latency",
    "p95_ms": 628,
    "error_rate": 0.004
   },
   {
    "scenario": "service_down",
    "p95_ms": 369,
    "error_rate": 0.0
   },
   {
    "scenario": "traffic_spike",
    "p95_ms": 2018,
    "error_rate": 0.028
   }
  ]
 },
 "pr12": {
  "score": 32,
  "baseline": {
   "p95_ms": 468,
   "error_rate": 0.0
  },
  "per": [
   {
    "scenario": "db_latency",
    "p95_ms": 3000,
    "error_rate": 0.929
   },
   {
    "scenario": "service_down",
    "p95_ms": 206,
    "error_rate": 1.0
   },
   {
    "scenario": "traffic_spike",
    "p95_ms": 2018,
    "error_rate": 0.028
   }
  ]
 },
 "healed": {
  "score": 84,
  "baseline": {
   "p95_ms": 468,
   "error_rate": 0.0
  },
  "per": [
   {
    "scenario": "db_latency",
    "p95_ms": 628,
    "error_rate": 0.004
   },
   {
    "scenario": "service_down",
    "p95_ms": 369,
    "error_rate": 0.0
   },
   {
    "scenario": "traffic_spike",
    "p95_ms": 2018,
    "error_rate": 0.028
   }
  ]
 }
};

export interface WhatIfRow extends WhatIfResponse { resilience: number }
export const WHATIF: Record<'db_latency' | 'traffic_spike', WhatIfRow[]> = {
 "db_latency": [
  {
   "scenario": "db_latency",
   "factor": 1.0,
   "predicted": {
    "p95_ms": 468,
    "error_rate": 0.0,
    "risk": "LOW",
    "saturated": []
   },
   "measured": {
    "p95_ms": 468,
    "error_rate": 0.0
   },
   "accuracy": 0.999,
   "note": null,
   "resilience": 100
  },
  {
   "scenario": "db_latency",
   "factor": 1.5,
   "predicted": {
    "p95_ms": 512,
    "error_rate": 0.0,
    "risk": "LOW",
    "saturated": []
   },
   "measured": {
    "p95_ms": 513,
    "error_rate": 0.0
   },
   "accuracy": 0.999,
   "note": null,
   "resilience": 99
  },
  {
   "scenario": "db_latency",
   "factor": 2.0,
   "predicted": {
    "p95_ms": 602,
    "error_rate": 0.0,
    "risk": "LOW",
    "saturated": []
   },
   "measured": {
    "p95_ms": 603,
    "error_rate": 0.0
   },
   "accuracy": 1.0,
   "note": null,
   "resilience": 96
  },
  {
   "scenario": "db_latency",
   "factor": 2.5,
   "predicted": {
    "p95_ms": 873,
    "error_rate": 0.0,
    "risk": "MEDIUM",
    "saturated": []
   },
   "measured": {
    "p95_ms": 875,
    "error_rate": 0.0
   },
   "accuracy": 0.997,
   "note": null,
   "resilience": 88
  },
  {
   "scenario": "db_latency",
   "factor": 3.0,
   "predicted": {
    "p95_ms": 174,
    "error_rate": 0.0,
    "risk": "HIGH",
    "saturated": [
     "database"
    ]
   },
   "measured": {
    "p95_ms": 628,
    "error_rate": 0.004
   },
   "accuracy": 0.276,
   "note": "Forecast ignores retry feedback near saturation; risk level HIGH is still correct.",
   "resilience": 95
  },
  {
   "scenario": "db_latency",
   "factor": 3.5,
   "predicted": {
    "p95_ms": 174,
    "error_rate": 0.0,
    "risk": "HIGH",
    "saturated": [
     "database"
    ]
   },
   "measured": {
    "p95_ms": 321,
    "error_rate": 0.0
   },
   "accuracy": 0.541,
   "note": "Forecast ignores retry feedback near saturation; risk level HIGH is still correct.",
   "resilience": 100
  },
  {
   "scenario": "db_latency",
   "factor": 4.0,
   "predicted": {
    "p95_ms": 174,
    "error_rate": 0.0,
    "risk": "HIGH",
    "saturated": [
     "database"
    ]
   },
   "measured": {
    "p95_ms": 328,
    "error_rate": 0.0
   },
   "accuracy": 0.529,
   "note": "Forecast ignores retry feedback near saturation; risk level HIGH is still correct.",
   "resilience": 100
  }
 ],
 "traffic_spike": [
  {
   "scenario": "traffic_spike",
   "factor": 1.0,
   "predicted": {
    "p95_ms": 468,
    "error_rate": 0.0,
    "risk": "LOW",
    "saturated": []
   },
   "measured": {
    "p95_ms": 468,
    "error_rate": 0.0
   },
   "accuracy": 0.999,
   "note": null,
   "resilience": 100
  },
  {
   "scenario": "traffic_spike",
   "factor": 1.5,
   "predicted": {
    "p95_ms": 761,
    "error_rate": 0.0,
    "risk": "LOW",
    "saturated": []
   },
   "measured": {
    "p95_ms": 762,
    "error_rate": 0.0
   },
   "accuracy": 1.0,
   "note": null,
   "resilience": 92
  },
  {
   "scenario": "traffic_spike",
   "factor": 2.0,
   "predicted": {
    "p95_ms": 2015,
    "error_rate": 0.0,
    "risk": "HIGH",
    "saturated": [
     "payment"
    ]
   },
   "measured": {
    "p95_ms": 2018,
    "error_rate": 0.028
   },
   "accuracy": 0.998,
   "note": null,
   "resilience": 57
  },
  {
   "scenario": "traffic_spike",
   "factor": 2.5,
   "predicted": {
    "p95_ms": 3000,
    "error_rate": 0.0,
    "risk": "HIGH",
    "saturated": [
     "order",
     "inventory",
     "payment"
    ]
   },
   "measured": {
    "p95_ms": 3000,
    "error_rate": 0.612
   },
   "accuracy": 1.0,
   "note": null,
   "resilience": 0
  },
  {
   "scenario": "traffic_spike",
   "factor": 3.0,
   "predicted": {
    "p95_ms": 3000,
    "error_rate": 1.0,
    "risk": "HIGH",
    "saturated": [
     "order",
     "inventory",
     "payment",
     "database"
    ]
   },
   "measured": {
    "p95_ms": 2501,
    "error_rate": 0.398
   },
   "accuracy": 0.8,
   "note": null,
   "resilience": 12
  },
  {
   "scenario": "traffic_spike",
   "factor": 3.5,
   "predicted": {
    "p95_ms": 3000,
    "error_rate": 0.286,
    "risk": "HIGH",
    "saturated": [
     "order",
     "inventory",
     "payment",
     "database"
    ]
   },
   "measured": {
    "p95_ms": 2285,
    "error_rate": 0.435
   },
   "accuracy": 0.687,
   "note": "Forecast ignores retry feedback near saturation; risk level HIGH is still correct.",
   "resilience": 8
  },
  {
   "scenario": "traffic_spike",
   "factor": 4.0,
   "predicted": {
    "p95_ms": 3000,
    "error_rate": 0.375,
    "risk": "HIGH",
    "saturated": [
     "gateway",
     "order",
     "inventory",
     "payment",
     "database"
    ]
   },
   "measured": {
    "p95_ms": 2663,
    "error_rate": 0.477
   },
   "accuracy": 0.874,
   "note": null,
   "resilience": 3
  }
 ]
};
