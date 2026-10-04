import type { NodeStatus } from "./types";

/** Illustrative cascade used by the marketing visuals (order matches the engine: database first, frontend last). */
export const CASCADE_STEPS = 6;
export function statusesForStep(step: number): Record<string, NodeStatus> {
  const s: Record<string, NodeStatus> = {};
  if (step >= 1) s.database = "critical";
  if (step >= 2) { s.payment = "degraded"; s.inventory = "degraded"; }
  if (step >= 3) s.order = "degraded";
  if (step >= 4) s.gateway = "critical";
  if (step >= 5) s.frontend = "critical";
  return s;
}
export const STEP_CAPTION = [
  "Six services, one checkout. Everything is steady.",
  "Database. Latency +320%.",
  "Payment and Inventory time out waiting on it.",
  "Order slows down.",
  "Gateway starts failing requests.",
  "Frontend. Checkout is down.",
];
export const STEP_VALUES: Record<string, string>[] = [
  {}, { database: "+320%" }, { database: "+320%", payment: "slow", inventory: "slow" },
  { database: "+320%", payment: "slow", inventory: "slow", order: "slow" },
  { database: "+320%", payment: "slow", inventory: "slow", order: "slow", gateway: "errors" },
  { database: "+320%", payment: "slow", inventory: "slow", order: "slow", gateway: "errors", frontend: "errors" },
];
