import { createFileRoute } from "@tanstack/react-router";
import { handleApi } from "@/features/integration/integration-api";
import { openApiDocument } from "@/features/integration/openapi";
import { logError, resolveRequestId } from "@/lib/observability/telemetry";

// API de integração v1. Público na borda; a autenticação de máquina acontece no handler.
async function serve(request: Request, splat: string | undefined) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const route = `/v1/${splat ?? ""}`;
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-request-id": requestId, ...headers } });
  if (request.method === "GET" && route === "/v1/openapi.json") {
    const u = new URL(request.url);
    return json(200, openApiDocument(`${u.origin}/api/public`));
  }
  try {
    const { databaseStore } = await import("@/features/integration/integration-store.server");
    const r = await handleApi(request, route, await databaseStore(), { now: () => new Date(), fetch, newId: () => crypto.randomUUID() }, requestId);
    return json(r.status, r.body, r.headers);
  } catch (e) {
    logError("integration.api", e, requestId);
    return json(500, { error: { code: "internal.error", message: "internal.error", request_id: requestId }, api_version: "v1" });
  }
}

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => serve(request, params._splat),
      POST: ({ request, params }) => serve(request, params._splat),
    },
  },
});
