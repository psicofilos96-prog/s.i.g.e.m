// OpenAPI 3.1 gerado do mesmo registro de endpoints que a API executa.
import { ENDPOINTS } from "./integration-api";
import { ERROR_CODES, EVENT_CATALOG, PAGE_MAX, SCOPES } from "./integration-core";

export function openApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const params = e.method === "GET" ? [
      { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: PAGE_MAX } },
      { name: "cursor", in: "query", schema: { type: "string" }, description: "next_cursor da página anterior" },
    ] : [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 128 } }];
    (paths[e.route] ??= {})[e.method.toLowerCase()] = {
      summary: e.summary,
      security: [{ bearer: [] }],
      "x-required-scopes": e.scopes,
      parameters: params,
      responses: Object.fromEntries([[e.method === "POST" ? "202" : "200", { description: "ok" }], ...Object.entries(ERROR_CODES).map(([c, s]) => [String(s), { description: c, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }])]),
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "SIGEM — API de integração", version: "v1", description: "Chave de máquina (Bearer sgk_…), scopes mínimos, limite por minuto por cliente, Idempotency-Key em escritas. Webhooks assinados em X-SIGEM-Signature: t=<unix>,v1=HMAC-SHA256(segredo, t + '.' + corpo)." },
    servers: [{ url: serverUrl }],
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: { Error: { type: "object", properties: { error: { type: "object", properties: { code: { enum: Object.keys(ERROR_CODES) }, message: { type: "string" }, request_id: { type: "string" } } } } } },
    },
    "x-scopes": SCOPES,
    "x-webhook-events": EVENT_CATALOG,
  };
}
