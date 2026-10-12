/** Tecnologia L23 — catálogo de relatórios e ficha do chamado com linha do tempo. Nada é lido antes da sessão. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { AbsenceState, ErrorState, LoadingState } from "@/components/sigem/states";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { buildTimeline, reportStatus, TECH_REPORTS, TECH_TIMELINE_REPORT, timelineRows, type TimelineItem } from "./tech-reports";
import { runReport, downloadBlob, type ReportDefinition } from "@/features/reports/report-engine";
import { auditedExport } from "@/features/reports/audited-export";
import { safeErrorMessage } from "@/lib/safe-error";

const db = supabase as unknown as { from: (t: string) => any };
const SATISFIED = new Set<string>(); // nenhuma decisão institucional registrada ainda

async function loadTimeline(code: string): Promise<{ items: TimelineItem[]; undated: number } | null> {
  const rec = await db.from("tech_ticket_records").select("request_id").eq("ticket_code", code.trim()).limit(1);
  if (rec.error) throw rec.error;
  const id = rec.data?.[0]?.request_id;
  if (!id) return null;
  const [evs, recs, sess] = await Promise.all([
    db.from("ops_request_events").select("seq, kind, created_at").eq("request_id", id),
    db.from("tech_ticket_records").select("seq, nature, created_at").eq("request_id", id),
    db.from("tech_service_sessions").select("result, started_at").eq("request_id", id),
  ]);
  for (const r of [evs, recs, sess]) if (r.error) throw r.error;
  return buildTimeline([
    ...(evs.data ?? []).map((e: any) => ({ at: e.created_at, source: "evento", seq: e.seq, label: `Evento: ${e.kind}` })),
    ...(recs.data ?? []).map((e: any) => ({ at: e.created_at, source: "natureza", seq: e.seq, label: `Natureza: ${e.nature}` })),
    ...(sess.data ?? []).map((e: any) => ({ at: e.started_at, source: "sessao", label: `Atendimento: ${e.result}` })),
  ]);
}

export function TechReportsPage() {
  const auth = useSessionAuthority();
  const [code, setCode] = useState("");
  const [state, setState] = useState<{ k: "idle" } | { k: "loading" } | { k: "error"; m: string } | { k: "none" } | { k: "ok"; t: { items: TimelineItem[]; undated: number } }>({ k: "idle" });
  if (auth.status === "signed-out") return <SignInRequired title="Relatórios de Tecnologia" what="os relatórios de tecnologia" />;
  if (auth.status === "loading") return auth.error ? <ErrorState description={auth.error} /> : <LoadingState />;

  const [exp, setExp] = useState<string | null>(null);
  const exportTimeline = async (format: "csv" | "xlsx" | "pdf") => {
    if (state.k !== "ok") return;
    setExp("Registrando emissão…");
    try {
      const def = TECH_TIMELINE_REPORT as unknown as ReportDefinition;
      const result = runReport(def, { params: { codigo: code.trim() } }, timelineRows(state.t.items));
      const out = await auditedExport({ sector: "tecnologia", definitionId: def.id, definitionVersion: def.version, title: def.title, source: def.source, result, format, meta: [`Chamado: ${code.trim()}`, `Registros sem data fora: ${state.t.undated}`], branding: { headerLines: ["SIGEM — Tecnologia"], title: def.title }, idempotencyKey: `tech-ficha-${crypto.randomUUID()}` }, window.location.origin);
      downloadBlob(out.name, out.blob);
      setExp(`Emissão registrada. Código de verificação ${out.code}.`);
    } catch (e) { setExp(safeErrorMessage(e)); }
  };

  const search = async () => {
    if (code.trim().length < 3) return;
    setState({ k: "loading" });
    try { const t = await loadTimeline(code); setState(t ? { k: "ok", t } : { k: "none" }); }
    catch (e) { setState({ k: "error", m: e instanceof Error ? e.message : "Falha na leitura" }); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <PageHeader title="Relatórios de Tecnologia" description="22 relatórios declarados, lidos com as suas permissões. Bloqueio indica decisão institucional ainda não registrada." />
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link to="/painel-de-tecnologia" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">Painel operacional</Link>
      </nav>

      <section aria-labelledby="ficha" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 id="ficha" className="text-lg font-semibold">Ficha do chamado</h2>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input aria-label="Código do chamado" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código do chamado"
            className="min-w-0 rounded-md border border-input bg-background px-3 py-2" />
          <button type="button" onClick={search} className="shrink-0 rounded-md bg-primary px-4 py-2 text-primary-foreground">Consultar</button>
        </div>
        {state.k === "loading" && <LoadingState />}
        {state.k === "error" && <ErrorState description={state.m} />}
        {state.k === "none" && <AbsenceState kind="nenhum-resultado" compact />}
        {state.k === "ok" && (
          <ol className="space-y-2 border-l border-border pl-4">
            {state.t.items.map((i, n) => (
              <li key={n} className="min-w-0"><time className="text-xs text-muted-foreground">{new Date(i.at).toLocaleString("pt-BR")}</time><p className="truncate">{i.label}</p></li>
            ))}
            {state.t.undated > 0 && <li className="text-sm text-muted-foreground">{state.t.undated} registro(s) sem data fora da linha do tempo.</li>}
          </ol>
        )}
        {state.k === "ok" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(["csv", "xlsx", "pdf"] as const).map((f) => (
              <button key={f} type="button" onClick={() => void exportTimeline(f)} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">Exportar {f.toUpperCase()}</button>
            ))}
            {exp && <p role="status" className="text-muted-foreground">{exp}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="catalogo" className="space-y-3">
        <h2 id="catalogo" className="text-lg font-semibold">Catálogo</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TECH_REPORTS.map((r) => {
            const s = reportStatus(r, SATISFIED);
            return (
              <li key={r.key} className="min-w-0 space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="text-muted-foreground">{r.methodology}</p>
                <p><span className="text-muted-foreground">Data de referência:</span> {r.dateBasis}</p>
                <p><span className="text-muted-foreground">Filtros:</span> {r.filters.join(", ")}</p>
                <p className="break-words text-xs text-muted-foreground">Fonte: {r.sources.join(", ")}</p>
                <p className={s.status === "bloqueado" ? "text-destructive" : "text-primary"}>{s.status === "bloqueado" ? `Bloqueado: ${s.reason}` : "Disponível"}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
