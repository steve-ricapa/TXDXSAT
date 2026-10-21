import { env } from "@/lib/env";
import { ApiError, authHeader, noteUnauthorized } from "@/services/api-client";
import { setToken } from "./auth-store";

export type UserRole = "SUPERADMIN" | "ADMIN" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  enrollmentStatus: "APPROVED" | "PENDING" | "REJECTED";
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  tenantId?: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  tenantId?: string | null;
  password?: string;
}

export interface EnrollmentInvite {
  id: string;
  tenantId: string;
  maxUses: number;
  uses: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  isAvailable: boolean;
}

export interface EnrollmentUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  enrollmentStatus: "APPROVED" | "PENDING" | "REJECTED";
  createdAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...authHeader() };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });
  if (response.status === 401) noteUnauthorized(response.status);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const payload = data as { error?: { message?: string; code?: string; details?: unknown } };
    throw new ApiError(
      response.status,
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      payload?.error?.code,
      payload?.error?.details,
    );
  }
  return data as T;
}

/**
 * Direct account creation is restricted to superadmin; invited collaborators
 * can request access and remain inactive until an administrator approves them.
 */
export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: AuthUser }>("/auth/me"),

  listUsers: () => request<{ users: AuthUser[] }>("/auth/users"),

  createUser: (payload: CreateUserPayload) =>
    request<{ user: AuthUser }>("/auth/users", { method: "POST", body: JSON.stringify(payload) }),

  updateUser: (id: string, patch: UpdateUserPayload) =>
    request<{ user: AuthUser }>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteUser: (id: string) => request<void>(`/auth/users/${id}`, { method: "DELETE" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/auth/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getEnrollmentInvite: (token: string) => request<{ organization: string; expiresAt: string }>(`/auth/enrollment/${encodeURIComponent(token)}`),
  registerFromInvite: (token: string, input: { name: string; email: string; password: string }) =>
    request<{ message: string }>(`/auth/enrollment/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify(input) }),
  listEnrollmentInvites: (tenantId?: string) =>
    request<{ invites: EnrollmentInvite[] }>(`/auth/enrollment-invites${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`),
  createEnrollmentInvite: (input: { tenantId?: string; expiresInDays: number; maxUses: number }) =>
    request<{ invite: EnrollmentInvite; token: string }>("/auth/enrollment-invites", { method: "POST", body: JSON.stringify(input) }),
  revokeEnrollmentInvite: (id: string) => request<void>(`/auth/enrollment-invites/${id}`, { method: "DELETE" }),
  listEnrollmentUsers: (tenantId?: string) =>
    request<{ users: EnrollmentUser[] }>(`/auth/enrollments/users${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`),
  decideEnrollment: (id: string, decision: "approve" | "reject") =>
    request<void>(`/auth/enrollments/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }),
};

/** Convenience for tests/other modules that need the low-level request helper. */
export { request as authRequest };

/** Re-export so callers can persist a token directly (used by the provider). */
export { setToken };
