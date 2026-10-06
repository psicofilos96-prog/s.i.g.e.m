import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { useGeneralAdmin } from "@/features/institutional-admin/general-admin";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { governError } from "@/lib/observability/governed-errors";
import { BLOCKED_DEPENDENCIES, environmentCheck, migrationsCheck, probeCheck, recentTechFailures, recordTechFailure, type Check } from "./diagnostics-model";

const MIGRATIONS = Object.keys(import.meta.glob("/drizzle/migrations/*.sql"));
const STATE_LABEL = { ok: "OK", falha: "Falha", "nao-verificavel": "Não verificável aqui" } as const;

async function probe(fn: () => PromiseLike<{ error: unknown }>): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try { const { error } = await fn(); if (error) throw error; return { ok: true, ms: performance.now() - t0 }; }
  catch (e) { const g = governError(e); recordTechFailure({ at: new Date().toISOString(), source: "diagnostico", category: g.category, correlationId: g.correlationId }); return { ok: false, ms: performance.now() - t0 }; }
}

/** AV — painel de suporte só leitura, para Administrador Geral. Sem SQL, sem bypass. */
export function SupportPage() {
  const authority = useSessionAuthority();
  const admin = useGeneralAdmin(authority);
  const [probes, setProbes] = useState<{ db: { ok: boolean; ms: number }; caps: { ok: boolean; ms: number } } | null>(null);
  const [busy, setBusy] = useState(false);

  if (authority.status === "signed-out") return <StatePanel tone="neutral" title="Entre para acessar" description="O diagnóstico só existe com login de Administrador Geral." />;
  if (admin.status === "loading") return <p role="status" className="text-sm text-muted-foreground">Carregando…</p>;
  if (admin.status !== "general-admin") return <StatePanel tone="neutral" title="Acesso restrito" description="Esta área exige uma atuação vigente de Administrador Geral." />;

  const run = async () => {
    setBusy(true);
    const db = await probe(() => supabase.from("institutional_academic_years").select("id", { head: true, count: "exact" }));
    const caps = await probe(() => supabase.rpc("effective_capabilities"));
    setProbes({ db, caps }); setBusy(false);
  };
  const checks: Check[] = [
    environmentCheck(import.meta.env["VITE_SUPABASE_PROJECT_ID"] as string | undefined),
    migrationsCheck(MIGRATIONS),
    probeCheck("banco", "Banco de dados", probes?.db ?? null),
    probeCheck("leitor", "Leitor de capacidades", probes?.caps ?? null),
  ];
  const failures = recentTechFailures();
  return (
    <div className="space-y-6">
      <PageHeader title="Diagnóstico e suporte" description="Estado técnico do SIGEM. Nada aqui altera dados ou permissões." />
      <section aria-labelledby="sv-checks" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sv-checks" className="text-lg font-semibold">Dependências</h2>
          <button type="button" onClick={run} disabled={busy} className="rounded-md border border-input bg-background px-3 py-2 text-sm">{busy ? "Verificando…" : "Verificar agora"}</button>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {checks.map((c) => <li key={c.id} className="p-3 text-sm"><strong>{c.label}:</strong> {STATE_LABEL[c.state]} — <span className="text-muted-foreground">{c.detail}</span></li>)}
        </ul>
        <p className="text-xs text-muted-foreground">Versão do app: build {import.meta.env.MODE}.</p>
      </section>
      <section aria-labelledby="sv-fail" className="space-y-2">
        <h2 id="sv-fail" className="text-lg font-semibold">Falhas técnicas recentes desta sessão</h2>
        {failures.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma registrada nesta sessão.</p> : (
          <ul className="text-sm">{failures.map((f) => <li key={f.correlationId}>{f.at} · {f.source} · {f.category} · código {f.correlationId}</li>)}</ul>
        )}
      </section>
      <section aria-labelledby="sv-block" className="space-y-2">
        <h2 id="sv-block" className="text-lg font-semibold">Dependências bloqueadas</h2>
        <ul className="list-disc pl-5 text-sm">{BLOCKED_DEPENDENCIES.map((b) => <li key={b.id}>{b.label} <span className="text-muted-foreground">({b.id})</span></li>)}</ul>
        <p className="text-xs text-muted-foreground">Sem provedor externo de alertas: os eventos ficam no log estruturado da plataforma.</p>
      </section>
    </div>
  );
}
