import { UsersPage } from "@/modules/auth/pages/UsersPage";

/**
 * Superadmin portal. The only capability that exists today is account
 * administration (there is no public registration).
 */
export function SuperAdminHome() {
  return <UsersPage />;
}
