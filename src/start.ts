import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { classifyError, isIncident, logError, metric, resolveRequestId } from "@/lib/observability/telemetry";

// Correlation id + erro classificado + latência por requisição. Nunca loga corpo, query ou headers.
const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const route = new URL(request.url).pathname.replace(/[0-9a-f-]{16,}/gi, ":id");
  const t0 = Date.now();
  try {
    const result = await next();
    metric("http.request", Date.now() - t0, "ok", { route, method: request.method }, requestId);
    return result;
  } catch (error) {
    const cls = classifyError(error);
    metric("http.request", Date.now() - t0, cls, { route, method: request.method }, requestId);
    if (error != null && typeof error === "object" && "statusCode" in error) {
      if (isIncident(cls)) logError("http.error", error, requestId, { route });
      throw error;
    }
    logError("http.error", error, requestId, { route });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", "x-request-id": requestId },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
