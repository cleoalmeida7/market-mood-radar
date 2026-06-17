// Next.js instrumentation — captures uncaught server/route errors to Sentry
// (via src/lib/observability.ts). No-op unless SENTRY_DSN is set.

import type { Instrumentation } from "next";
import { captureError } from "@/lib/observability";

export function register() {
  // Nothing to initialise — the capture transport is lazy and env-gated.
}

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  captureError(err, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
