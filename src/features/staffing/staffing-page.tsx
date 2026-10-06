import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { FactValue } from "@/components/sigem/states";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { listSchools } from "@/features/onboarding/onboarding-source";
import { STAFFING_FORMULA, personLoads, projectClass, reconciles, scenarioTeachersNeeded, totals, type ClassResult } from "./staffing-model";
import { loadCurricula, loadScheduleRows, loadStaffingInputs } from "./staffing-source";
import { NECESSIDADE_PROFESSOR, TOTAL_AULAS_OFERTADAS, needRows, offeredRows } from "./teacher-need-reports";
import { runReport, toCsv, type ReportDefinition, type CellValue } from "@/features/reports/report-engine";
import { NETWORK_BRANDING } from "@/features/reports/report-registry";
import { classDemand, engagementLoads, needSummary, type Num } from "./teacher-need";

const STATE: Record<ClassResult["state"], string> = { ok: "Lida", "sem-grade": "Sem grade vigente", "grade-ilegivel": "Grade não pôde ser lida", "regencia-ilegivel": "Regências não puderam ser lidas" };
const h = (m: number | null) => (m == null ? null : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`);

export function StaffingPage() {
  const a = useSessionAuthority(); const uid = a.status === "signed-in" ? a.user.id : null;
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [perTeacher, setPerTeacher] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const schools = useQuery({ queryKey: ["st-schools", uid], enabled: !!uid, queryFn: listSchools });
  const data = useQuery({ queryKey: ["st", uid, schoolId, today], enabled: !!schoolId, queryFn: async () => {
    const knownAt = new Date().toISOString();
    const inputs = await loadStaffingInputs(schoolId!, today, knownAt);
    if (!inputs) return null;
    const [cur, sched] = await Promise.all([loadCurricula(schoolId!, inputs.map((c) => c.classId), today, knownAt), loadScheduleRows(schoolId!, today, knownAt)]);
    const results = inputs.map(projectClass);
    const demands = inputs.map((c, i) => classDemand(c.classId, cur[i] ?? null, []));
    const loadsX = sched == null ? null : engagementLoads(sched);
    return { knownAt, inputs, results, loadsX, demands, summary: needSummary(demands, results, loadsX ?? []) };
  } });
  if (a.status === "signed-out") return <EmptyState title="Entre para ver o quadro docente" description="A projeção usa só o que sua conta pode ler." />;
  if (a.status === "loading") return <p role="status">Carregando…</p>;
  const d = data.data; const t = d ? totals(d.results) : null;
  const minutes = Number(perTeacher.replace(",", ".")) * 60;
  const scen = t ? scenarioTeachersNeeded(t.uncoveredMinutes, perTeacher.trim() ? { minutesPerTeacher: minutes } : null) : null;
  const loads = d ? personLoads(d.inputs, null) : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Quadro docente" description="Aulas ofertadas, cobertura por regência e necessidade derivada da organização real. Nada aqui contrata, remove ou decide." />
      <label className="text-sm">Escola{" "}
        <select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={schoolId ?? ""} onChange={(e) => setSchoolId(e.target.value || null)}>
          <option value="">Selecione</option>{(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
      {!schoolId ? <EmptyState title="Escolha uma escola" description="A projeção é calculada na hora a partir da grade e das regências." />
        : data.isLoading ? <p role="status">Calculando…</p>
        : !d ? <EmptyState title="Turmas não puderam ser lidas" description="Sem leitura, nenhum número é mostrado." />
        : <>
          <dl className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Turmas</dt><dd className="text-lg">{t!.classes}</dd></div>
            <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Aulas ofertadas/semana</dt><dd className="text-lg"><FactValue value={t!.lessons} /></dd></div>
            <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Carga semanal</dt><dd className="text-lg"><FactValue value={h(t!.demandMinutes)} /></dd></div>
            <div className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">Sem regência (necessidade)</dt><dd className="text-lg"><FactValue value={h(t!.uncoveredMinutes)} /></dd></div>
          </dl>
          <section aria-labelledby="st-x" className="rounded-md border p-4 text-sm">
            <h2 id="st-x" className="font-medium">Necessidade de professor (grandezas separadas)</h2>
            <dl className="mt-2 grid gap-2 sm:grid-cols-4">{([["Aulas necessárias (matriz)", d.summary.necessarias], ["Aulas ofertadas (grade)", d.summary.ofertadas], ["Aulas cobertas", d.summary.cobertas], ["Aulas descobertas", d.summary.descobertas],
              ["Carga atribuída", d.summary.cargaAtribuidaMin, 1], ["Carga contratual", d.summary.cargaContratualMin, 1], ["Saldo funcional", d.summary.saldoMin, 1]] as [string, Num, number?][]).map(([k, n, isMin]) => (
              <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd><FactValue value={isMin ? h(n.value) : n.value} />{n.reason && <span className="block text-xs text-muted-foreground">{n.reason}</span>}</dd></div>))}</dl>
            <p className="mt-2 text-xs text-muted-foreground">Descoberto é déficit de cobertura; não é déficit contratual. Carga contratual só vem de fonte funcional (DP externo).</p>
          </section>
          {!t!.complete && <p className="text-sm">{t!.unreadable} turma(s) sem leitura da grade: totais não são fechados.</p>}
          {!reconciles(d.results) && <p role="alert" className="text-sm text-destructive">Reconciliação falhou: demanda ≠ cobertura + descoberto.</p>}
          <ul className="space-y-2">{d.results.map((r) => (
            <li key={r.classId} className="rounded-md border p-3">
              <button className="min-h-11 w-full text-left" aria-expanded={open === r.classId} onClick={() => setOpen(open === r.classId ? null : r.classId)}>
                <span className="font-medium">{r.label ?? "Turma sem nome declarado"}</span> — {STATE[r.state]} · {r.cells.reduce((s, c) => s + c.lessons, 0)} aulas</button>
              {open === r.classId && <table className="mt-2 w-full text-xs"><thead><tr><th className="text-left">Componente</th><th>Aulas</th><th>Carga</th><th>Coberta</th><th>Descoberta</th><th className="text-left">Composição</th></tr></thead>
                <tbody>{r.cells.map((c) => <tr key={c.componentId ?? "-"} className="align-top border-t">
                  <td>{c.componentId ?? "Sem componente"}</td><td className="text-center">{c.lessons}</td><td className="text-center">{h(c.demandMinutes)}</td>
                  <td className="text-center"><FactValue value={h(c.coveredMinutes)} /></td><td className="text-center"><FactValue value={h(c.uncoveredMinutes)} /></td>
                  <td>{c.refs.map((x) => `${x.kind}:${x.id}`).join(", ")}{c.reasons.length > 0 && <ul className="list-disc pl-4">{c.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>}</td></tr>)}</tbody></table>}
            </li>))}</ul>
          <section aria-labelledby="st-p" className="rounded-md border p-4 text-sm">
            <h2 id="st-p" className="font-medium">Carga atribuída por pessoa</h2>
            <p className="text-muted-foreground">Disponibilidade: não há fonte canônica de carga horária profissional; excedência e déficit por pessoa ficam "Não informado".</p>
            <ul className="mt-2">{loads.map((p) => <li key={p.personId}>{p.personId}: {h(p.assignedMinutes)} atribuídas em {p.engagementIds.length} atuação(ões) · saldo <FactValue value={h(p.balanceMinutes)} /></li>)}</ul>
          </section>
          <section aria-labelledby="st-s" className="rounded-md border p-4 text-sm">
            <h2 id="st-s" className="font-medium">Cenário de planejamento (opcional)</h2>
            <label>Horas semanais por professor (parâmetro seu, não norma){" "}
              <input inputMode="decimal" className="ml-1 min-h-11 w-24 rounded-md border bg-background px-2" value={perTeacher} onChange={(e) => setPerTeacher(e.target.value)} /></label>
            <p className="mt-1">Professores para cobrir o descoberto: <FactValue value={scen} /></p>
          </section>
          <section aria-labelledby="st-r" className="flex flex-wrap gap-2 text-sm">
            <h2 id="st-r" className="sr-only">Relatórios</h2>
            {([[TOTAL_AULAS_OFERTADAS, offeredRows({ scope: "escola", scopeLabel: schoolId }, d.results)],
               [NECESSIDADE_PROFESSOR, needRows({ scope: "escola", scopeLabel: schoolId }, d.summary, d.demands, d.results, d.loadsX ?? [])]] as [ReportDefinition, Record<string, CellValue>[]][]).map(([def, rows]) => (
              <button key={def.id} className="min-h-11 rounded-md border px-3" onClick={() => download(def, rows, today, d.knownAt)}>Exportar “{def.title}” (CSV)</button>))}
          </section>
          <p className="text-xs text-muted-foreground">Fórmula {STAFFING_FORMULA.id} v{STAFFING_FORMULA.version}: {STAFFING_FORMULA.demand} {STAFFING_FORMULA.coverage} Data {today}; conhecido até {new Date(d.knownAt).toLocaleString("pt-BR")}.</p>
        </>}
    </div>
  );
}

function download(def: ReportDefinition, rows: Record<string, CellValue>[], asOf: string, knownAt: string) {
  const res = runReport(def, { params: { asOf, knownAt, scope: "escola" } }, rows);
  const csv = toCsv(res, NETWORK_BRANDING, [`Data de referência: ${asOf}`, `Conhecido até: ${knownAt}`, "Natureza: projeção dinâmica (não oficial)"]);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${def.id}-${asOf}.csv`; a.click();
}
