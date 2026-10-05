// Which organization the UI is acting as. Sent to the backend as X-Tenant-ID.
// Manages tenant login state and dispatches change events for UI synchronization.
export const DEFAULT_TENANT = "demo";
const KEY = "fg-tenant";
const USER_KEY = "fg-user-email";

export interface TenantInfo {
  tenant_id: string;
  name: string;
  plan: string;
}

export const KNOWN_TENANTS: TenantInfo[] = [
  { tenant_id: "demo", name: "Demo Org", plan: "free" },
  { tenant_id: "acme", name: "Acme Corp", plan: "pro" },
  { tenant_id: "beta", name: "Beta Inc", plan: "free" },
];

export function getTenant(): string {
  try {
    return (typeof window !== "undefined" && window.localStorage.getItem(KEY)) || DEFAULT_TENANT;
  } catch {
    return DEFAULT_TENANT;
  }
}

export function getUserEmail(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(USER_KEY) : null;
  } catch {
    return null;
  }
}

export function setTenant(id: string, email?: string) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, id);
      if (email) {
        window.localStorage.setItem(USER_KEY, email);
      }
      window.dispatchEvent(new CustomEvent("fg-tenant-change", { detail: { tenantId: id, email } }));
    }
  } catch {
    /* storage blocked */
  }
}

export function signOut() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent("fg-tenant-change", { detail: { tenantId: DEFAULT_TENANT, email: null } }));
    }
  } catch {
    /* storage blocked */
  }
}

export function getTenantInfo(id: string): TenantInfo {
  return KNOWN_TENANTS.find((t) => t.tenant_id === id) || { tenant_id: id, name: `${id.toUpperCase()} Org`, plan: "free" };
}
