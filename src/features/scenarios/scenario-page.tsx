import { operationalToday } from "@/lib/academic-date";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { FactValue } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { listSchools } from "@/features/onboarding/onboarding-source";
import { loadStaffingInputs } from "@/features/staffing/staffing-source";
import { scenarioTeachersNeeded } from "@/features/staffing/staffing-model";
import { addChange, compare, createScenario, isStale, memoryStore, PROMOTION_TARGET, type Scenario, type ScenarioStore } from "./scenario-model";

/** Armazenamento local do navegador, separado de qualquer fonte oficial. */
function browserStore(): ScenarioStore {
  return memoryStore({ get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) });
}
const h = (m: number | null) => (m == null ? null : `${m < 0 ? "−" : ""}${Math.floor(Math.abs(m) / 60)}h${String(Math.abs(m) % 60).padStart(2, "0")}`);

export function ScenarioPage() {
  const a = useSessionAuthority(); const uid = a.status === "signed-in" ? a.user.id : null;
  const [store, setStore] = useState<ScenarioStore | null>(null);
  useEffect(() => setStore(browserStore()), []);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [current, setCurrent] = useState<Scenario | null>(null);
  const [list, setList] = useState<Scenario[]>([]);
  const [form, setForm] = useState({ classId: "", blockKey: "", to: "", eng: "" });
  const [perTeacher, setPerTeacher] = useState("");
  useEffect(() => { if (store && uid) setList(store.list(uid)); }, [store, uid]);
  const today = operationalToday();
  const schools = useQuery({ queryKey: ["sim-schools", uid], enabled: !!uid, queryFn: listSchools });
  const live = useQuery({ queryKey: ["sim-base", uid, schoolId, today], enabled: !!schoolId, queryFn: () => loadStaffingInputs(schoolId!, today, new Date().toISOString()) });
  const cmp = useMemo(() => { try { return current ? compare(current) : null; } catch { return null; } }, [current]);
  const persist = (s: Scenario) => { setCurrent(s); store?.save(s); setList(store?.list(s.authorUserId) ?? []); };
  if (a.status !== "signed-in") return <EmptyState title="Entre para simular" description="Cenários são pessoais e nunca viram fato." />;
  const stale = current && current.schoolId === schoolId ? isStale(current, live.data ?? null) : null;
  const add = (c: Parameters<typeof addChange>[1]) => current && persist(addChange(current, c));
  return (
    <div className="space-y-6">
      <div role="status" className="rounded-md border-2 border-dashed border-primary bg-accent p-3 text-center font-semibold tracking-wide">MODO SIMULAÇÃO — nada aqui é gravado como fato nem aparece no Diário, documentos, Mapa ou painéis.</div>
      <PageHeader title="Simulador de cenários" description="Teste reorganização de turmas, grade, regência e necessidade docente sobre uma cópia da organização real." />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Escola <select className="ml-1 min-h-11 rounded-md border bg-background px-2" value={schoolId ?? ""} onChange={(e) => setSchoolId(e.target.value || null)}>
          <option value="">Selecione</option>{(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <Button size="sm" disabled={!live.data} onClick={() => persist(createScenario({ id: crypto.randomUUID(), authorUserId: uid!, schoolId: schoolId!, validOn: today, knownAt: new Date().toISOString(), label: `Cenário ${new Date().toLocaleString("pt-BR")}`, base: live.data! }))}>Novo cenário a partir da base atual</Button>
      </div>
      {list.length > 0 && <ul className="text-sm">{list.map((s) => <li key={s.id} className="flex items-center gap-2">
        <button className="min-h-11 underline" onClick={() => setCurrent(s)}>{s.label}</button> ({s.changes.length} alterações)
        <Button size="sm" variant="outline" onClick={() => { store?.remove(uid!, s.id); setList(store?.list(uid!) ?? []); if (current?.id === s.id) setCurrent(null); }}>Excluir cenário</Button></li>)}</ul>}
      {!current ? <EmptyState title="Nenhum cenário aberto" description="Crie um cenário: ele congela a base lida agora." /> : <>
        <p className="text-sm">Base: {current.base.length} turmas, lida em {new Date(current.knownAt).toLocaleString("pt-BR")} para {current.validOn}.
          {stale === true && <strong> A organização real mudou desde a criação: o cenário está desatualizado.</strong>}</p>
        <fieldset className="flex flex-wrap items-end gap-2 rounded-md border p-3 text-sm"><legend>Alteração hipotética</legend>
          {(["classId", "blockKey", "to", "eng"] as const).map((k) => <label key={k}>{({ classId: "Turma", blockKey: "Bloco", to: "Turma destino", eng: "Atuação responsável" })[k]}
            <input className="ml-1 min-h-11 w-36 rounded-md border bg-background px-2" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}
          <Button size="sm" variant="outline" onClick={() => add({ kind: "grade:remover-bloco", classId: form.classId, blockKey: form.blockKey })}>Remover bloco</Button>
          <Button size="sm" variant="outline" onClick={() => add({ kind: "turma:mover-blocos", fromClassId: form.classId, toClassId: form.to, blockKeys: [form.blockKey] })}>Mover bloco de turma</Button>
          <Button size="sm" variant="outline" onClick={() => add({ kind: "grade:trocar-responsavel", classId: form.classId, blockKey: form.blockKey, engagementIds: form.eng ? [form.eng] : [] })}>Trocar responsável</Button>
        </fieldset>
        {!cmp ? <p role="alert" className="text-sm text-destructive">Alguma alteração não se aplica à base (turma ou grade não lida). Exclua e recrie o cenário.</p> :
          <table className="w-full text-sm"><thead><tr><th className="text-left">Projeção</th><th>Base</th><th>Cenário</th><th>Diferença</th></tr></thead><tbody>
            <tr><td>Aulas/semana</td><td className="text-center"><FactValue value={cmp.baseline.lessons} /></td><td className="text-center"><FactValue value={cmp.scenario.lessons} /></td><td className="text-center"><FactValue value={cmp.delta.lessons} /></td></tr>
            <tr><td>Carga semanal</td><td className="text-center"><FactValue value={h(cmp.baseline.demandMinutes)} /></td><td className="text-center"><FactValue value={h(cmp.scenario.demandMinutes)} /></td><td className="text-center"><FactValue value={h(cmp.delta.demandMinutes)} /></td></tr>
            <tr><td>Sem regência</td><td className="text-center"><FactValue value={h(cmp.baseline.uncoveredMinutes)} /></td><td className="text-center"><FactValue value={h(cmp.scenario.uncoveredMinutes)} /></td><td className="text-center"><FactValue value={h(cmp.delta.uncoveredMinutes)} /></td></tr>
            <tr><td><label>Professores estimados (h/semana por professor: <input inputMode="decimal" className="min-h-11 w-16 rounded-md border bg-background px-1" value={perTeacher} onChange={(e) => setPerTeacher(e.target.value)} />)</label></td>
              <td className="text-center"><FactValue value={scenarioTeachersNeeded(cmp.baseline.uncoveredMinutes, perTeacher ? { minutesPerTeacher: Number(perTeacher) * 60 } : null)} /></td>
              <td className="text-center"><FactValue value={scenarioTeachersNeeded(cmp.scenario.uncoveredMinutes, perTeacher ? { minutesPerTeacher: Number(perTeacher) * 60 } : null)} /></td><td /></tr>
          </tbody></table>}
        <section aria-labelledby="sim-p" className="rounded-md border p-3 text-sm">
          <h2 id="sim-p" className="font-medium">Promover para a realidade</h2>
          <p className="text-muted-foreground">Nada é promovido automaticamente. Cada alteração só vira fato pela tela oficial, com confirmação e a permissão exigida pelo registro canônico.</p>
          <ol className="mt-2 list-decimal pl-5">{current.changes.map((c, i) => <li key={i}>{c.kind} — <Link className="underline" to={PROMOTION_TARGET[c.kind].screen as never}>abrir tela oficial</Link></li>)}</ol>
        </section>
      </>}
    </div>
  );
}
