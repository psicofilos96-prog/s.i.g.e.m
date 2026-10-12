/** Tecnologia L03 — painel operacional. Nada é lido antes da sessão; leitura pela RLS do usuário; não grava. */
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { techDashboard, type DashboardInput } from "./tech-dashboard";

const LIMIT = 500;
const TITLE: Record<string, string> = { chamados: "Chamados", incidentes: "Incidentes e requisições", problemas: "Problemas", mudancas: "Mudanças", equipamentos: "Equipamentos", conectividade: "Conectividade", projetos: "Projetos" };
const db = supabase as unknown as { from: (t: string) => any };

async function load(): Promise<DashboardInput> {
  const req = await db.from("ops_requests").select("id, school_id, created_at").eq("sector", "tecnologia").order("created_at", { ascending: false }).limit(LIMIT);
  if (req.error) throw req.error;
  const ids: string[] = (req.data ?? []).map((r: any) => r.id);
  const inIds = (q: any) => (ids.length ? q.in("request_id", ids) : q.limit(0));
  const [evs, recs, probs, pevs, chs, cevs] = await Promise.all([
    inIds(db.from("ops_request_events").select("request_id, seq, kind, actor_person, created_at")),
    inIds(db.from("tech_ticket_records").select("request_id, seq, ticket_code, nature, reason")),
    db.from("tech_problems").select("id, school_id").limit(LIMIT),
    db.from("tech_problem_events").select("problem_id, seq, action").limit(5000),
    db.from("tech_changes").select("id, school_id").limit(LIMIT),
    db.from("tech_change_events").select("change_id, seq, action").limit(5000),
  ]);
  for (const r of [evs, recs, probs, pevs, chs, cevs]) if (r.error) throw r.error;
  const by = (rows: any[], k: string, id: string) => rows.filter((r) => r[k] === id);
  return {
    today: new Date().toISOString().slice(0, 10),
    truncated: ids.length >= LIMIT || (probs.data?.length ?? 0) >= LIMIT || (chs.data?.length ?? 0) >= LIMIT,
    tickets: (req.data ?? []).map((r: any) => ({ id: r.id, schoolId: r.school_id, createdAt: r.created_at,
      events: by(evs.data, "request_id", r.id).map((e: any) => ({ seq: e.seq, kind: e.kind, actorPerson: e.actor_person, at: e.created_at })),
      records: by(recs.data, "request_id", r.id) })),
    problems: (probs.data ?? []).map((p: any) => ({ id: p.id, schoolId: p.school_id, events: by(pevs.data, "problem_id", p.id) })),
    changes: (chs.data ?? []).map((c: any) => ({ id: c.id, schoolId: c.school_id, events: by(cevs.data, "change_id", c.id) })),
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
      <p className="text-sm text-muted-foreground">{d.schools} escola(s) com chamados visíveis{d.issues ? ` · ${d.issues} chamado(s) com histórico inconsistente` : ""}{d.truncated ? ` · mostrando os ${LIMIT} mais recentes; o total pode ser maior` : ""}.</p>
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
