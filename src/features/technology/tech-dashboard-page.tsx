/** Tecnologia L03 — painel operacional. Nada é lido antes da sessão; leitura pela RLS do usuário; não grava. */
import { operationalToday } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { techDashboard, type DashboardInput } from "./tech-dashboard";

/** Teto de leitura por fonte (páginas de 1000 via `readPages`); acima dele o painel avisa `truncated`. */
export const MAX_ROWS = 20000;
const CHUNK = 200;
const TITLE: Record<string, string> = { chamados: "Chamados", incidentes: "Incidentes e requisições", problemas: "Problemas", mudancas: "Mudanças", equipamentos: "Equipamentos", conectividade: "Conectividade", projetos: "Projetos" };
const db = supabase as unknown as { from: (t: string) => any };

async function all(table: string, cols: string, apply: (q: any) => any = (q) => q, order = "created_at") {
  const r = await readPages<any>((from, to) => apply(db.from(table).select(cols)).order(order, { ascending: false }).order("id", { ascending: true }).range(from, to), MAX_ROWS);
  if (r.error) throw r.error;
  return r;
}
/** Filhos lidos em lotes de ids (URL curta) e páginas de 1000, ordem estável por seq. */
async function children(table: string, cols: string, key: string, ids: string[]) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const r = await readPages<any>((from, to) => db.from(table).select(cols).in(key, part).order(key, { ascending: true }).order("seq", { ascending: true }).range(from, to), MAX_ROWS);
    if (r.error) throw r.error;
    out.push(...(r.data ?? []));
  }
  return out;
}

async function load(): Promise<DashboardInput> {
  const [req, probs, chs] = await Promise.all([
    all("ops_requests", "id, school_id, created_at", (q) => q.eq("sector", "tecnologia")),
    all("tech_problems", "id, school_id"),
    all("tech_changes", "id, school_id"),
  ]);
  const ids: string[] = (req.data ?? []).map((r: any) => r.id);
  const pIds = (probs.data ?? []).map((p: any) => p.id), cIds = (chs.data ?? []).map((c: any) => c.id);
  const [evs, recs, pevs, cevs] = await Promise.all([
    children("ops_request_events", "request_id, seq, kind, actor_person, created_at", "request_id", ids),
    children("tech_ticket_records", "request_id, seq, ticket_code, nature, reason", "request_id", ids),
    children("tech_problem_events", "problem_id, seq, action", "problem_id", pIds),
    children("tech_change_events", "change_id, seq, action", "change_id", cIds),
  ]);
  const by = (rows: any[], k: string, id: string) => rows.filter((r) => r[k] === id);
  return {
    today: operationalToday(),
    truncated: req.truncated || probs.truncated || chs.truncated,
    tickets: (req.data ?? []).map((r: any) => ({ id: r.id, schoolId: r.school_id, createdAt: r.created_at,
      events: by(evs, "request_id", r.id).map((e: any) => ({ seq: e.seq, kind: e.kind, actorPerson: e.actor_person, at: e.created_at })),
      records: by(recs, "request_id", r.id) })),
    problems: (probs.data ?? []).map((p: any) => ({ id: p.id, schoolId: p.school_id, events: by(pevs, "problem_id", p.id) })),
    changes: (chs.data ?? []).map((c: any) => ({ id: c.id, schoolId: c.school_id, events: by(cevs, "change_id", c.id) })),
  };
}

export function TechDashboardPage() {
  const a = useSessionAuthority();
  if (a.status === "signed-out") return <SignInRequired title="Painel de Tecnologia" what="os chamados e recursos de tecnologia" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  return <Dashboard />;
}

function Dashboard() {
  const [s, setS] = useState<{ input?: DashboardInput; err?: string } | null>(null);
  useEffect(() => { let live = true; load().then((input) => live && setS({ input }), () => live && setS({ err: "Dados de tecnologia não disponíveis para a sua conta." })); return () => { live = false; }; }, []);
  if (!s) return <SkeletonState label="Carregando painel" />;
  if (s.err) return <p role="alert" className="text-destructive">{s.err}</p>;
  const d = techDashboard(s.input!);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SIGEM Tecnologia" title="Painel operacional de tecnologia" description="Chamados, incidentes, problemas e mudanças calculados na hora a partir dos registros que sua conta pode ver." />
      <p className="text-sm text-muted-foreground">{d.schools} escola(s) com chamados visíveis{d.issues ? ` · ${d.issues} chamado(s) com histórico inconsistente` : ""}{d.truncated ? ` · mostrando os ${MAX_ROWS.toLocaleString("pt-BR")} mais recentes por fonte; o total pode ser maior` : ""}.</p>
      <div className="grid gap-3 md:grid-cols-2">{d.panels.map((p) => (
        <section key={p.key} className="rounded-md border p-3">
          <h2 className="font-medium">{TITLE[p.key]}</h2>
          {p.status === "ok" ? (Object.keys(p.values).length ? (
            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">{Object.entries(p.values).map(([k, n]) => (<div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{n}</dd></div>))}</dl>
          ) : <p className="mt-2 text-sm text-muted-foreground">Nenhum registro visível.</p>)
            : <p role="status" className="mt-2 text-sm text-muted-foreground">Indisponível: {p.reason}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Fonte: {p.source}</p>
        </section>))}</div>
    </div>
  );
}
