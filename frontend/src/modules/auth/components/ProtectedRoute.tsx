import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../lib/api";

interface ProtectedRouteProps {
  children: ReactNode;
  /** When set, only these roles may view the route. */
  roles?: UserRole[];
}

/**
 * Client-side guard. This is a UX layer only — the backend independently
 * rejects unauthenticated/unauthorised requests, so hiding a screen is never the
 * security boundary.
 */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-600)] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
