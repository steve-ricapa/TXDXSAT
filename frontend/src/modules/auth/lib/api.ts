import { env } from "@/lib/env";
import { ApiError, authHeader, noteUnauthorized } from "@/services/api-client";
import { setToken } from "./auth-store";

export type UserRole = "SUPERADMIN" | "ADMIN";

export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
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
 * Client of the auth module. Accounts are never self-registered: only a
 * superadmin creates them (see `createUser`).
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
};

/** Convenience for tests/other modules that need the low-level request helper. */
export { request as authRequest };

/** Re-export so callers can persist a token directly (used by the provider). */
export { setToken };
