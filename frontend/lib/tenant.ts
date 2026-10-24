// Which organization the UI is acting as. Sent to the backend as X-Tenant-ID.
// Manages real credentials, signed auth tokens, RBAC roles, and tenant state.
export const DEFAULT_TENANT = "demo";
const KEY = "fg-tenant";
const USER_KEY = "fg-user-email";
const ROLE_KEY = "fg-user-role";
const TOKEN_KEY = "fg-auth-token";
const USERNAME_KEY = "fg-user-username";
const NAME_KEY = "fg-user-name";

export type UserRole = "platform_owner" | "company_admin" | "company_engineer";

export interface TenantInfo {
  tenant_id: string;
  name: string;
  plan: string;
  servicesCount?: number;
  simulationsCount?: number;
  healthScore?: number;
}

export interface UserProfile {
  id: string;
  username?: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  title?: string;
  lastActive?: string;
}

// Exactly the 4 authorized Hackathon team members who have Super Admin privilege
export const TEAM_CODEX_SUPER_ADMINS = [
  {
    id: "admin-1",
    username: "shardul",
    name: "Shardul Kulkarni",
    email: "shardul@flowguard.io",
    role: "platform_owner" as UserRole,
    tenant_id: "flowguard",
    title: "Frontend, AI Prompts & Demo Lead",
    defaultPass: "shardul@codex2026",
  },
  {
    id: "admin-2",
    username: "abhiraj",
    name: "Abhiraj Mangire",
    email: "abhiraj@flowguard.io",
    role: "platform_owner" as UserRole,
    tenant_id: "flowguard",
    title: "Backend, Simulator & Integration Lead",
    defaultPass: "abhiraj@codex2026",
  },
  {
    id: "admin-3",
    username: "sneha",
    name: "Sneha Barge",
    email: "sneha@flowguard.io",
    role: "platform_owner" as UserRole,
    tenant_id: "flowguard",
    title: "Intelligence & Scoring Lead",
    defaultPass: "sneha@codex2026",
  },
  {
    id: "admin-4",
    username: "vaishnavi",
    name: "Vaishnavi Repal",
    email: "vaishnavi@flowguard.io",
    role: "platform_owner" as UserRole,
    tenant_id: "flowguard",
    title: "PR Checks & Auto-Fix Lead",
    defaultPass: "vaishnavi@codex2026",
  },
];

// Pre-seeded tenant credentials for judges/evaluators
export const PRESEEDED_TENANT_USERS = [
  {
    id: "u-acme-1",
    username: "acme_admin",
    name: "Sarah Chen",
    email: "admin@acme.com",
    role: "company_admin" as UserRole,
    tenant_id: "acme",
    title: "VP of Engineering",
    defaultPass: "acme@admin2026",
  },
  {
    id: "u-acme-2",
    username: "marcus",
    name: "Marcus Brody",
    email: "marcus@acme.com",
    role: "company_engineer" as UserRole,
    tenant_id: "acme",
    title: "Senior SRE",
    defaultPass: "marcus@acme2026",
  },
  {
    id: "u-beta-1",
    username: "beta_admin",
    name: "Alex Kumar",
    email: "dev@betainc.io",
    role: "company_admin" as UserRole,
    tenant_id: "beta",
    title: "Lead DevOps Architect",
    defaultPass: "beta@admin2026",
  },
  {
    id: "u-demo-1",
    username: "guest",
    name: "Guest Evaluator",
    email: "guest@demo.org",
    role: "company_engineer" as UserRole,
    tenant_id: "demo",
    title: "Hackathon Judge",
    defaultPass: "demo@guest2026",
  },
];

export const KNOWN_TENANTS: TenantInfo[] = [
  { tenant_id: "demo", name: "Demo Sandbox", plan: "free", servicesCount: 6, simulationsCount: 24, healthScore: 84 },
  { tenant_id: "acme", name: "Acme Corp", plan: "enterprise", servicesCount: 14, simulationsCount: 182, healthScore: 91 },
  { tenant_id: "beta", name: "Beta Inc", plan: "pro", servicesCount: 8, simulationsCount: 65, healthScore: 78 },
];

export const MOCK_COMPANY_USERS: Record<string, UserProfile[]> = {
  flowguard: TEAM_CODEX_SUPER_ADMINS.map(m => ({
    id: m.id,
    username: m.username,
    name: m.name,
    email: m.email,
    role: m.role,
    tenant_id: m.tenant_id,
    title: m.title,
    lastActive: "Active Now"
  })),
  acme: [
    { id: "u-1", username: "acme_admin", name: "Sarah Chen", email: "admin@acme.com", role: "company_admin", tenant_id: "acme", title: "VP of Engineering", lastActive: "Just now" },
    { id: "u-2", username: "marcus", name: "Marcus Brody", email: "marcus@acme.com", role: "company_engineer", tenant_id: "acme", title: "Senior SRE", lastActive: "14m ago" },
    { id: "u-3", username: "elena", name: "Elena Rostova", email: "elena@acme.com", role: "company_engineer", tenant_id: "acme", title: "Infrastructure Engineer", lastActive: "2h ago" },
  ],
  beta: [
    { id: "u-4", username: "beta_admin", name: "Alex Kumar", email: "dev@betainc.io", role: "company_admin", tenant_id: "beta", title: "Lead DevOps Architect", lastActive: "Just now" },
    { id: "u-5", username: "chloe", name: "Chloe Bennett", email: "chloe@betainc.io", role: "company_engineer", tenant_id: "beta", title: "Reliability Engineer", lastActive: "1d ago" },
  ],
  demo: [
    { id: "u-6", username: "guest", name: "Guest Evaluator", email: "guest@demo.org", role: "company_engineer", tenant_id: "demo", title: "Hackathon Judge", lastActive: "Now" },
  ],
};

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

export function getUserName(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null;
  } catch {
    return null;
  }
}

export function getUserUsername(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(USERNAME_KEY) : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function getUserRole(): UserRole {
  try {
    return ((typeof window !== "undefined" && window.localStorage.getItem(ROLE_KEY)) as UserRole) || "company_engineer";
  } catch {
    return "company_engineer";
  }
}

/**
 * Super Admin privilege is strictly restricted to the 4 Team CodeX Hackathon members.
 */
export function isPlatformOwner(): boolean {
  const role = getUserRole();
  const email = (getUserEmail() || "").toLowerCase();
  const username = (getUserUsername() || "").toLowerCase();
  if (role !== "platform_owner") return false;
  
  const authorizedEmails = [
    "shardul@flowguard.io",
    "abhiraj@flowguard.io",
    "sneha@flowguard.io",
    "vaishnavi@flowguard.io",
    "owner@flowguard.io",
  ];
  const authorizedUsernames = ["shardul", "abhiraj", "sneha", "vaishnavi", "owner"];
  
  return authorizedEmails.includes(email) || authorizedUsernames.includes(username);
}

export function setAuthSession(data: {
  tenantId: string;
  email: string;
  role: UserRole;
  username?: string;
  name?: string;
  token?: string;
}) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, data.tenantId);
      window.localStorage.setItem(USER_KEY, data.email);
      window.localStorage.setItem(ROLE_KEY, data.role);
      if (data.username) window.localStorage.setItem(USERNAME_KEY, data.username);
      if (data.name) window.localStorage.setItem(NAME_KEY, data.name);
      if (data.token) window.localStorage.setItem(TOKEN_KEY, data.token);
      
      window.dispatchEvent(
        new CustomEvent("fg-tenant-change", {
          detail: {
            tenantId: data.tenantId,
            email: data.email,
            role: data.role,
            username: data.username,
            name: data.name,
          },
        })
      );
    }
  } catch {
    /* storage blocked */
  }
}

export function setTenant(id: string, email?: string, role?: UserRole) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, id);
      if (email) window.localStorage.setItem(USER_KEY, email);
      const computedRole =
        role ??
        (id === "flowguard" || email === "owner@flowguard.io"
          ? "platform_owner"
          : email?.includes("admin")
          ? "company_admin"
          : "company_engineer");
      window.localStorage.setItem(ROLE_KEY, computedRole);
      window.dispatchEvent(
        new CustomEvent("fg-tenant-change", { detail: { tenantId: id, email, role: computedRole } })
      );
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
      window.localStorage.removeItem(ROLE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USERNAME_KEY);
      window.localStorage.removeItem(NAME_KEY);
      window.dispatchEvent(
        new CustomEvent("fg-tenant-change", {
          detail: { tenantId: DEFAULT_TENANT, email: null, role: "company_engineer" },
        })
      );
    }
  } catch {
    /* storage blocked */
  }
}

export function getTenantInfo(id: string): TenantInfo {
  return (
    KNOWN_TENANTS.find((t) => t.tenant_id === id) || {
      tenant_id: id,
      name: id === "flowguard" ? "FLOWGUARD Platform Owner" : `${id.toUpperCase()} Org`,
      plan: id === "flowguard" ? "enterprise" : "free",
      servicesCount: 6,
      simulationsCount: 10,
      healthScore: 84,
    }
  );
}

export function getCompanyUsers(tenantId: string): UserProfile[] {
  return (
    MOCK_COMPANY_USERS[tenantId] ?? [
      {
        id: `u-${tenantId}-1`,
        username: `eng_${tenantId}`,
        name: "Staff Engineer",
        email: `eng@${tenantId}.com`,
        role: "company_engineer",
        tenant_id: tenantId,
        title: "Staff Reliability Engineer",
        lastActive: "Today",
      },
    ]
  );
}
