import { Router } from "express";
import { createTenantsRouter } from "./tenants.routes.ts";

export interface TenantsModule {
  router: Router;
}

export function createTenantsModule(): TenantsModule {
  return {
    router: createTenantsRouter(),
  };
}
