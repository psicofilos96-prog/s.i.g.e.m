import { createFileRoute } from "@tanstack/react-router";
import { BUILD_INFO } from "@/config/build-info";
import { classifyError, metric } from "@/lib/observability/telemetry";

// Liveness (?) e readiness (?ready=1). Público, sem dados: só status, versão e estado de dependências.
async function probe(url: string, key: string): Promise<"ok" | "indisponivel"> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(3000) });
    metric("health.probe", Date.now() - t0, r.ok ? "ok" : "incident.dependency", { target: new URL(url).pathname });
    return r.ok ? "ok" : "indisponivel";
  } catch (e) {
    metric("health.probe", Date.now() - t0, classifyError(e), { target: new URL(url).pathname });
    return "indisponivel";
  }
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = { "cache-control": "no-store", "content-type": "application/json" };
        const base = { status: "ok", commit: BUILD_INFO.commit, builtAt: BUILD_INFO.builtAt };
        if (new URL(request.url).searchParams.get("ready") !== "1") return new Response(JSON.stringify(base), { headers });
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response(JSON.stringify({ ...base, status: "nao-pronto", config: "ausente" }), { status: 503, headers });
        const [auth, db] = await Promise.all([probe(`${url}/auth/v1/health`, key), probe(`${url}/rest/v1/`, key)]);
        const ready = auth === "ok" && db === "ok";
        return new Response(JSON.stringify({ ...base, status: ready ? "pronto" : "nao-pronto", auth, database: db }), { status: ready ? 200 : 503, headers });
      },
    },
  },
});
