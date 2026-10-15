import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage } from "./HomePage";
import { EmployeeHome } from "@/modules/employee/pages/EmployeeHome";
import { AdminHome } from "@/modules/enterprise-admin/pages/AdminHome";
import { SuperAdminHome } from "@/modules/superadmin/pages/SuperAdminHome";
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
        { path: "admin", element: <AdminHome /> },
        { path: "superadmin", element: <SuperAdminHome /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
    // Live sessions render full-screen, outside the corporate shell.
    { path: "live/join", element: <JoinPage /> },
    { path: "live/play/:sessionId", element: <PlayPage /> },
    { path: "live/host/:sessionId", element: <HostPage /> },
    { path: "live/host", element: <HostPage /> },
    { path: "live/present/:sessionId", element: <PresentPage /> },
    { path: "live/editor", element: <QuizEditorPage /> },
  ],
  { basename: resolveBasename(import.meta.env.BASE_URL) },
);
