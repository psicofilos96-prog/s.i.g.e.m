import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { NEI_ROLE_LABEL, dashTotals, grantShapeProblem, scopeLabel, visibleAreas, type NeiAccess, type NeiDashRow, type NeiRole } from "./nei-areas";

// RPCs novas (0330–0333); tipagem local mínima para não depender da geração.
const rpc = ((fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => unknown }).rpc(fn, args)) as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const MSG: Record<string, string> = {
  "nei:cannot-manage": "Sua conta não pode gerir papéis do NEI.",
  "nei:self-grant": "Ninguém concede papel a si mesmo.",
  "nei:account-without-person": "Esta conta não está ligada a uma pessoa do cadastro institucional.",
  "nei:student-not-in-school": "O estudante não tem matrícula nesta escola.",
  "nei:grant-unknown": "Concessão não encontrada.",
};
const human = (m: string) => Object.entries(MSG).find(([k]) => m.includes(k))?.[1] ?? "Não foi possível concluir com o seu acesso.";

export function NeiPage() {
  const [access, setAccess] = useState<NeiAccess[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void rpc("nei_my_access").then((r) => { if (r.error) setErr(human(r.error.message)); else setAccess((r.data ?? []) as NeiAccess[]); });
  }, []);
  if (err) return <StatePanel tone="danger" title="Não foi possível abrir o NEI" description={err} />;
  if (access === null) return <StatePanel title="Conferindo seu acesso ao NEI…" description="Lendo seus papéis no servidor." />;
  if (access.length === 0) return (
    <div className="space-y-6">
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="NEI" />
      <EmptyState title="Sua conta não tem papel no NEI" description="O acesso é concedido pela coordenação do NEI ou pela administração geral, com escopo de rede, escola ou caso. Nenhum dado é mostrado sem esse papel." />
    </div>
  );
  return <NeiWorkspace access={access} />;
}

function NeiWorkspace({ access }: { access: NeiAccess[] }) {
  const areas = visibleAreas(access);
  const manage = access.some((a) => a.can_manage_staff);
  const [school, setSchool] = useState("");
  const [rows, setRows] = useState<NeiDashRow[] | null>(null);
  const [dashErr, setDashErr] = useState<string | null>(null);
  const load = (s: string) => { setRows(null); void rpc("nei_dashboard", { _school: s || null }).then((r) => { if (r.error) setDashErr(human(r.error.message)); else setRows((r.data ?? []) as NeiDashRow[]); }); };
  useEffect(() => load(school), [school]);
  const allSchools = useMemo(() => rows ?? [], [rows]);
  const [schoolOptions, setSchoolOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { if (school === "" && rows) setSchoolOptions(rows.map((r) => ({ id: r.school_id, name: r.school_name ?? r.school_id }))); }, [rows, school]);
  const t = dashTotals(allSchools);
  return (
    <div className="space-y-6">
      <Link to="/inclusao/nei/ficha" className="text-sm font-medium underline">Abrir ficha NEI, planos e casos de um estudante →</Link>
      <Link to="/inclusao/nei/aee" className="ml-4 text-sm font-medium underline">Oferta e agenda do AEE →</Link>
      <Link to="/inclusao/nei/apoio" className="ml-4 text-sm font-medium underline">Apoio e acessibilidade →</Link>
      <Link to="/inclusao/nei/agenda" className="ml-4 text-sm font-medium underline">Agenda, visitas e protocolos →</Link>
      <Link to="/inclusao/nei/protocolos" className="ml-4 text-sm font-medium underline">Protocolos recebidos →</Link>
      <Link to="/inclusao/nei/indicadores" className="ml-4 text-sm font-medium underline">Indicadores →</Link>
      <PageHeader eyebrow="Núcleo de Educação Inclusiva" title="Painel do NEI"
        description={`Seu acesso: ${[...new Set(access.map((a) => NEI_ROLE_LABEL[a.role] ?? a.role))].join(" · ")} — ${scopeLabel(access)}. Só contagens; dados individuais ficam nas telas próprias, com a permissão de cada uma.`} />

      <section aria-labelledby="nei-areas-h" className="space-y-2">
        <h2 id="nei-areas-h" className="text-sm font-semibold">Áreas do NEI</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <li key={a.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                {a.path ? <Link to={a.path} className="text-sm font-medium underline-offset-2 hover:underline">{a.title}</Link> : <span className="text-sm font-medium">{a.title}</span>}
                {a.pending ? <StatusBadge tone="warning">pendente</StatusBadge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.pending ?? a.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nei-dash-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="nei-dash-h" className="text-sm font-semibold">Situação por escola</h2>
          <label className="text-sm">Escola
            <select className="ml-2 rounded-md border border-input bg-background p-1.5" value={school} onChange={(e) => setSchool(e.target.value)}>
              <option value="">Todas do meu escopo</option>
              {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        {dashErr ? <StatePanel tone="danger" title="Painel indisponível" description={dashErr} /> : rows === null ? <StatePanel title="Carregando contagens…" description="Lendo do servidor dentro do seu escopo." /> : rows.length === 0 ? (
          <EmptyState title="Nada a mostrar neste escopo" description="O servidor não devolveu escolas para a sua conta neste filtro." />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[["Escolas", t.schools], ["Estudantes com registro de apoio", t.students], ["Atendimentos AEE vigentes", t.aee], ["Sessões AEE (30 dias)", t.sessions], ["Mediações vigentes", t.mediations], ["Estudantes com registro clínico", t.clinical ?? "sem acesso"]].map(([l, v]) => (
                <div key={String(l)} className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>
              ))}
            </div>
            {t.students + t.aee + t.mediations === 0 ? <p className="text-sm text-muted-foreground">Ainda não há registros de inclusão gravados neste escopo. Isso não significa que não existam estudantes com necessidades específicas: os registros anteriores foram apagados em 12/09/2026 e a reimportação está pendente.</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Contagens de inclusão por escola</caption>
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Escola</th><th className="p-2">Com registro</th><th className="p-2">AEE</th><th className="p-2">Sessões 30d</th><th className="p-2">Mediações</th><th className="p-2">Clínico</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.school_id} className="border-t border-border"><td className="p-2">{r.school_name ?? r.school_id}</td><td className="p-2 tabular-nums">{r.students_with_record}</td><td className="p-2 tabular-nums">{r.aee_active}</td><td className="p-2 tabular-nums">{r.aee_sessions_30d}</td><td className="p-2 tabular-nums">{r.mediations_active}</td><td className="p-2 tabular-nums">{r.clinical_students ?? "—"}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {manage ? <TeamPanel access={access} /> : null}
      {manage ? <AccessLog /> : null}
    </div>
  );
}

type Grant = { id: string; person_name: string | null; role: string; scope_kind: string; school_id: string | null; student_scoped: boolean; valid_from: string; valid_until: string | null; reason: string; revoked: boolean };

function TeamPanel({ access }: { access: NeiAccess[] }) {
  const canCoord = access.some((a) => a.can_manage_coordinators);
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState(""); const [cands, setCands] = useState<{ user_id: string; person_name: string }[]>([]);
  const [user, setUser] = useState(""); const [role, setRole] = useState<NeiRole>("tecnico"); const [scope, setScope] = useState<"rede" | "escola" | "caso">("escola");
  const [school, setSchool] = useState(""); const [student, setStudent] = useState(""); const [until, setUntil] = useState(""); const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const reload = () => void rpc("nei_role_grants_list").then((r) => setGrants(r.error ? [] : (r.data as Grant[])));
  useEffect(() => { reload(); void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m))); }, []);
  useEffect(() => { const h = setTimeout(() => { if (q.trim().length >= 3) void rpc("nei_candidate_accounts", { _query: q }).then((r) => setCands(r.error ? [] : (r.data as typeof cands))); else setCands([]); }, 300); return () => clearTimeout(h); }, [q]);
  const problem = !user ? "Escolha a pessoa." : grantShapeProblem(role, scope, school, student, reason);
  async function grant() {
    if (problem) return;
    const r = await rpc("record_nei_role_grant", { _user: user, _role: role, _scope: scope, _school: scope === "rede" ? null : school, _student: scope === "caso" ? student.trim() : null, _from: null, _until: until || null, _reason: reason.trim() });
    setMsg(r.error ? human(r.error.message) : "Papel concedido."); if (!r.error) { setReason(""); reload(); }
  }
  async function revoke(id: string) {
    const why = window.prompt("Motivo da revogação (mínimo 5 caracteres):") ?? "";
    if (why.trim().length < 5) return;
    const r = await rpc("revoke_nei_role_grant", { _grant: id, _reason: why.trim() });
    setMsg(r.error ? human(r.error.message) : "Papel revogado."); reload();
  }
  return (
    <section aria-labelledby="nei-team-h" className="space-y-3 rounded-md border border-border p-4">
      <h2 id="nei-team-h" className="text-sm font-semibold">Equipe e papéis do NEI</h2>
      <p className="text-xs text-muted-foreground">Só contas institucionais já existentes, ligadas a uma pessoa do cadastro. Nenhuma senha é criada aqui. {canCoord ? "" : "Coordenação é concedida só pela administração geral."}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Pessoa (busque pelo nome)
          <input className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={q} onChange={(e) => { setQ(e.target.value); setUser(""); }} />
          {cands.length > 0 && !user ? <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-border">{cands.map((c) => <li key={c.user_id}><button type="button" className="w-full p-1.5 text-left text-sm hover:bg-muted" onClick={() => { setUser(c.user_id); setQ(c.person_name); }}>{c.person_name}</button></li>)}</ul> : null}
        </label>
        <label className="text-sm">Papel
          <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={role} onChange={(e) => { const v = e.target.value as NeiRole; setRole(v); if (v === "coordenador") setScope("rede"); if (v === "aee" && scope === "rede") setScope("escola"); }}>
            {canCoord ? <option value="coordenador">Coordenação do NEI</option> : null}
            <option value="tecnico">Técnico(a) do NEI</option><option value="aee">Professor(a) de AEE</option>
          </select>
        </label>
        <label className="text-sm">Escopo
          <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            {role !== "aee" ? <option value="rede">Rede inteira</option> : null}
            {role !== "coordenador" ? <><option value="escola">Escola</option><option value="caso">Caso (estudante específico)</option></> : null}
          </select>
        </label>
        {scope !== "rede" ? <label className="text-sm">Escola
          <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label> : null}
        {scope === "caso" ? <label className="text-sm">Identificador do estudante<input className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={student} onChange={(e) => setStudent(e.target.value)} /></label> : null}
        <label className="text-sm">Válido até (opcional)<input type="date" className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Motivo<input className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      <div className="flex items-center gap-3"><Button type="button" disabled={!!problem} onClick={() => void grant()}>Conceder papel</Button><span className="text-xs text-muted-foreground" role="status">{msg ?? problem}</span></div>
      {grants === null ? <p className="text-sm text-muted-foreground">Carregando papéis…</p> : grants.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum papel concedido ainda.</p> : (
        <table className="w-full text-sm"><caption className="sr-only">Papéis do NEI</caption>
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Pessoa</th><th className="p-2">Papel</th><th className="p-2">Escopo</th><th className="p-2">Vigência</th><th className="p-2">Situação</th><th className="p-2" /></tr></thead>
          <tbody>{grants.map((g) => (
            <tr key={g.id} className="border-t border-border"><td className="p-2">{g.person_name ?? "—"}</td><td className="p-2">{NEI_ROLE_LABEL[g.role] ?? g.role}</td>
              <td className="p-2">{g.scope_kind === "rede" ? "Rede" : (schools.find((s) => s.id === g.school_id)?.name ?? g.school_id)}{g.student_scoped ? " · caso" : ""}</td>
              <td className="p-2">{g.valid_from}{g.valid_until ? ` a ${g.valid_until}` : ""}</td>
              <td className="p-2">{g.revoked ? <StatusBadge tone="neutral">revogado</StatusBadge> : <StatusBadge tone="success">vigente</StatusBadge>}</td>
              <td className="p-2">{g.revoked ? null : <Button type="button" size="sm" variant="outline" onClick={() => void revoke(g.id)}>Revogar</Button>}</td></tr>
          ))}</tbody></table>
      )}
    </section>
  );
}

function AccessLog() {
  const [rows, setRows] = useState<{ person_name: string; action: string; school_id: string | null; outcome: string; recorded_at: string }[] | null>(null);
  useEffect(() => { void rpc("nei_access_log", { _limit: 100 }).then((r) => setRows(r.error ? [] : (r.data as NonNullable<typeof rows>))); }, []);
  return (
    <section aria-labelledby="nei-log-h" className="space-y-2 rounded-md border border-border p-4">
      <h2 id="nei-log-h" className="text-sm font-semibold">Acessos registrados (últimos 100)</h2>
      {rows === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum acesso registrado.</p> : (
        <ul className="max-h-64 space-y-1 overflow-auto text-xs">{rows.map((r, i) => <li key={i}>{new Date(r.recorded_at).toLocaleString("pt-BR")} — {r.person_name} — {r.action}{r.school_id ? ` (${r.school_id})` : ""} — <strong>{r.outcome}</strong></li>)}</ul>
      )}
    </section>
  );
}
