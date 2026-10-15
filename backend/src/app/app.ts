import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env, isProduction } from "../shared/config/env.ts";
import { newId } from "../shared/utils/id.ts";
import {
  errorHandler,
  notFoundHandler,
  requestContextMiddleware,
} from "../shared/middleware/index.ts";
import { getRequestContext } from "../shared/middleware/request-context.ts";
import { buildCorsOptions } from "./cors.ts";
import { createApiRouter } from "./router.ts";
import type { AppDependencies } from "./dependencies.ts";

/**
 * Build the Express application.
 *
 * HTTP concerns only: security headers, CORS, body parsing, request context,
 * structured request logging, the versioned API router, and the terminal
 * 404/error handlers. Business logic lives in modules.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  // Correct client IPs / protocol when running behind Nginx.
  if (env.TRUST_PROXY) app.set("trust proxy", true);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // The API serves JSON only; Nginx owns the SPA's CSP.
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(requestContextMiddleware);

  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: () => getRequestContext()?.requestId ?? newId(),
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "debug";
      },
    }),
  );

  // Service banner.
  app.get("/", (_req, res) => {
    res.json({
      service: env.APP_NAME,
      version: env.APP_VERSION,
      api: env.API_PREFIX,
    });
  });

  app.use(env.API_PREFIX, createApiRouter(deps));

  app.use(notFoundHandler());
  app.use(errorHandler(deps.logger));

  return app;
}
