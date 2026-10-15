import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage } from "./HomePage";
import { EmployeeHome } from "@/modules/employee/pages/EmployeeHome";
import { AdminHome } from "@/modules/enterprise-admin/pages/AdminHome";
import { SuperAdminHome } from "@/modules/superadmin/pages/SuperAdminHome";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { AccountPage } from "@/modules/auth/pages/AccountPage";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { JoinPage } from "@/modules/live-sessions/pages/JoinPage";
import { PlayPage } from "@/modules/live-sessions/pages/PlayPage";
import { HostPage } from "@/modules/live-sessions/pages/HostPage";
import { PresentPage } from "@/modules/live-sessions/pages/PresentPage";
import { QuizEditorPage } from "@/modules/live-sessions/pages/QuizEditorPage";
import { NotFoundPage } from "./NotFoundPage";

/**
 * Router basename derived from the deployment base path so every route works
 * under `/sat` without hardcoding the prefix.
 */
export function resolveBasename(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** Keep the signed-in entry point stable while routing to the appropriate portal. */
function DashboardEntry() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "SUPERADMIN" ? "/superadmin" : user?.role === "EMPLOYEE" ? "/employee" : "/admin"} replace />;
}

export const router = createBrowserRouter(
  [
    { path: "/", element: <HomePage /> },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <DashboardEntry />
        </ProtectedRoute>
      ),
    },
    {
      element: <AppShell />,
      children: [
        { path: "employee", element: <ProtectedRoute><EmployeeHome /></ProtectedRoute> },
        {
          path: "admin",
          element: (
            <ProtectedRoute roles={["ADMIN", "SUPERADMIN"]}>
              <AdminHome />
            </ProtectedRoute>
          ),
        },
        {
          path: "superadmin",
          element: (
            <ProtectedRoute roles={["SUPERADMIN"]}>
              <SuperAdminHome />
            </ProtectedRoute>
          ),
        },
        {
          path: "account",
          element: (
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "live/editor",
          element: (
            <ProtectedRoute roles={["ADMIN", "SUPERADMIN"]}>
              <QuizEditorPage />
            </ProtectedRoute>
          ),
        },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
    // Login renders full-screen, outside the corporate shell.
    { path: "login", element: <LoginPage /> },
    // Players must be authenticated; host/presenter retain their capability tokens.
    { path: "live/join", element: <ProtectedRoute><JoinPage /></ProtectedRoute> },
    { path: "live/play/:sessionId", element: <ProtectedRoute><PlayPage /></ProtectedRoute> },
    {
      path: "live/host",
      element: (
        <ProtectedRoute roles={["ADMIN", "SUPERADMIN"]}>
          <HostPage />
        </ProtectedRoute>
      ),
    },
    { path: "live/host/:sessionId", element: <HostPage /> },
    { path: "live/present/:sessionId", element: <PresentPage /> },
  ],
  { basename: resolveBasename(import.meta.env.BASE_URL) },
);
