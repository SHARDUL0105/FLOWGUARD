import type { NodeStatus } from "./types";

// Status colours from the brief. "onGreen" variants stay legible on the forest background.
export const STATUS_COLOR: Record<NodeStatus, string> = { healthy: "#218B6A", degraded: "#C9851F", critical: "#D94B45" };
export const STATUS_ON_GREEN: Record<NodeStatus, string> = { healthy: "#9FE0C4", degraded: "#F2B84B", critical: "#FF8F89" };
export const STATUS_WORD: Record<NodeStatus, string> = { healthy: "Steady", degraded: "Degraded", critical: "Critical" };
export const STATUS_RANK: Record<NodeStatus, number> = { healthy: 0, degraded: 1, critical: 2 };
export const worst = (a: NodeStatus, b: NodeStatus): NodeStatus => (STATUS_RANK[a] >= STATUS_RANK[b] ? a : b);
