import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage } from "./HomePage";
import { EmployeeHome } from "@/modules/employee/pages/EmployeeHome";
import { AdminHome } from "@/modules/enterprise-admin/pages/AdminHome";
import { SuperAdminHome } from "@/modules/superadmin/pages/SuperAdminHome";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { AccountPage } from "@/modules/auth/pages/AccountPage";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
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

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AppShell />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "employee", element: <EmployeeHome /> },
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
        { path: "*", element: <NotFoundPage /> },
      ],
    },
    // Login renders full-screen, outside the corporate shell.
    { path: "login", element: <LoginPage /> },
    // Live sessions render full-screen. Joining/playing/presenting is public
    // (PIN/token based); hosting and authoring require a session.
    { path: "live/join", element: <JoinPage /> },
    { path: "live/play/:sessionId", element: <PlayPage /> },
    {
      path: "live/host",
      element: (
        <ProtectedRoute>
          <HostPage />
        </ProtectedRoute>
      ),
    },
    { path: "live/host/:sessionId", element: <HostPage /> },
    { path: "live/present/:sessionId", element: <PresentPage /> },
    {
      path: "live/editor",
      element: (
        <ProtectedRoute>
          <QuizEditorPage />
        </ProtectedRoute>
      ),
    },
  ],
  { basename: resolveBasename(import.meta.env.BASE_URL) },
);
