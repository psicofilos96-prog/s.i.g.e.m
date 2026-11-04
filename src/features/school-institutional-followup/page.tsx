import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionAuthority, sessionContextKey } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { operationalToday } from "@/lib/academic-date";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { presentError } from "@/lib/observability/governed-errors";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { networkFollowup, networkPendingFollowup, monthlyFollowup, followupStatuses, recordVisitBundle, recordVisit, recordAction, recordUpdate, schoolFollowup } from "./source";
import { InstitutionalFollowupAnalytics } from "./analytics";
import { InstitutionalPendingPanel } from "./pending-panel";
import { exportFollowupNetwork, exportFollowupSchool, exportFollowupVisit } from "./report";
import { currentSituation, currentUpdate, filterSchoolActions, filterNetworkRows, isOverdue, networkIndicators, schoolIndicators, SITUATIONS, NO_UPDATE, type ActionView, type NetworkView } from "./model";

const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const textArea = input + " min-h-20";
const dateLabel = (d: string | null) => d ? d.split("-").reverse().join("/") : "Não informado";
const newAction = () => ({ description: "", responsible: "", due: "" });
type ActionDraft = ReturnType<typeof newAction>;

export function InstitutionalSchoolFollowupPage() {
  const authority = useSessionAuthority();
  const key = sessionContextKey(authority);
  if (authority.status !== "signed-in" || !key || !pathAllowed(authority, "/acompanhamento-unidades")) {
    return <StatePanel tone="info" title={authority.status === "loading" ? "Verificando acesso…" : "Acesso não disponível"}
      description="Entre com uma conta institucional autorizada para consultar ou registrar o acompanhamento." />;
  }
  return <FollowupWorkspace key={key} sessionKey={key} authority={authority} />;
}
type SignedIn = Extract<ReturnType<typeof useSessionAuthority>, { status: "signed-in" }>;

function FollowupWorkspace({ sessionKey, authority }: { sessionKey: string; authority: SignedIn }) {
  const queryClient = useQueryClient();
  const today = operationalToday();
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [networkView, setNetworkView] = useState<NetworkView>("todas");
  const [school, setSchool] = useState("");
  const [day, setDay] = useState(today);
  const [diagnosis, setDiagnosis] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [summary, setSummary] = useState("");
  const [correctionBase, setCorrectionBase] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [draftActions, setDraftActions] = useState<ActionDraft[]>([newAction()]);
  const [saving, setSaving] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingMeasure, setSavingMeasure] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const visitRequests = useRef<{ signature: string; visit: string; actions: string[] } | null>(null);
  const updateRequest = useRef<{ signature: string; request: string } | null>(null);
  const measureRequest = useRef<{ signature: string; request: string } | null>(null);
  const [measureVisitId, setMeasureVisitId] = useState("");
  const [measureDraft, setMeasureDraft] = useState<ActionDraft>(newAction());
  const [actionView, setActionView] = useState<ActionView>("todas");
  const [actionQuery, setActionQuery] = useState("");
  const [actionId, setActionId] = useState("");
  const [situation, setSituation] = useState(SITUATIONS[0].value as string);
  const [updateDay, setUpdateDay] = useState(today);
  const [done, setDone] = useState("");
  const [notDone, setNotDone] = useState("");
  const [results, setResults] = useState("");
  const [referrals, setReferrals] = useState("");

  const network = useQuery({
    queryKey: ["institutional-followup-network", sessionKey, from, to],
    queryFn: () => networkFollowup(from, to), enabled: Boolean(from && to && from <= to), retry: false,
  });
  const monthly = useQuery({
    queryKey: ["institutional-followup-monthly", sessionKey, from, to],
    queryFn: () => monthlyFollowup(from, to), enabled: Boolean(from && to && from <= to), retry: false,
  });
  const pending = useQuery({
    queryKey: ["institutional-followup-pending", sessionKey],
    queryFn: networkPendingFollowup, retry: false,
  });
  const statuses = useQuery({
    queryKey: ["institutional-followup-statuses", sessionKey],
    queryFn: followupStatuses, retry: false,
  });
  const detail = useQuery({
    queryKey: ["institutional-followup-school", sessionKey, school],
    queryFn: () => schoolFollowup(school), enabled: Boolean(school), retry: false,
  });
  const rows = filterNetworkRows(network.data ?? [], search, networkView);
  const totals = networkIndicators(network.data ?? []);
  const selected = network.data?.find((r) => r.school_id === school);
  const canRecord = Boolean(authority.person) && authority.capabilities.some((c) =>
    c.capabilityId === "registrar-acompanhamento-institucional"
    && (c.schoolId === null || c.schoolId === school));
  const stats = detail.data ? schoolIndicators(detail.data, today) : null;
  const selectedAction = detail.data?.actions.find((a) => a.id === actionId);
  const updateMinDay = detail.data?.visits.find(
    (v) => v.logical_id === selectedAction?.visit_logical_id,
  )?.visit_date ?? null;
  const visibleActions = detail.data
    ? filterSchoolActions(detail.data.actions, detail.data.updates, actionView, actionQuery, today)
    : [];
  const maxVisits = Math.max(1, ...rows.map((r) => r.visits));
  useEffect(() => {
    if (correctionBase) document.getElementById("followup-visit-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [correctionBase]);
  useEffect(() => {
    if (measureVisitId) document.getElementById("followup-measure-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [measureVisitId]);
  async function exportReport(format: "csv" | "xlsx" | "pdf") {
    if (!network.isSuccess || exporting) return;
    setExporting(true); setError("");
    try { await exportFollowupNetwork(rows, from, to, format); }
    catch (e) { setError(presentError(e)); }
    finally { setExporting(false); }
  }
  async function exportSchoolReport(format: "csv" | "xlsx" | "pdf") {
    if (!school || !detail.isSuccess || exporting) return;
    setExporting(true); setError("");
    try {
      await exportFollowupSchool(detail.data, school, selected?.school_name ?? school, format);
    } catch (e) { setError(presentError(e)); }
    finally { setExporting(false); }
  }
  async function exportVisitReport(visitId: string, format: "csv" | "xlsx" | "pdf") {
    if (!school || !detail.isSuccess || exporting) return;
    setExporting(true); setError("");
    try {
      await exportFollowupVisit(detail.data, school, selected?.school_name ?? school, visitId, format);
    } catch (e) { setError(presentError(e)); }
    finally { setExporting(false); }
  }
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["institutional-followup-network", sessionKey] }),
      queryClient.invalidateQueries({ queryKey: ["institutional-followup-monthly", sessionKey] }),
      queryClient.invalidateQueries({ queryKey: ["institutional-followup-statuses", sessionKey] }),
      queryClient.invalidateQueries({ queryKey: ["institutional-followup-pending", sessionKey] }),
      queryClient.invalidateQueries({ queryKey: ["institutional-followup-school", sessionKey, school] }),
    ]);
  }
  async function saveVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!school || !canRecord || !diagnosis.trim() || !day || day > today || saving
      || (correctionBase !== null && !correctionReason.trim())) return;
    setSaving(true); setError(""); setNotice("");
    // Só repetir a mesma chave de operação quando o conteúdo for idêntico.
    const signature = JSON.stringify({ school, day, diagnosis, strengths, weaknesses, summary,
      draftActions: correctionBase === null ? draftActions : [], correctionBase, correctionReason });
    const requests = visitRequests.current?.signature === signature ? visitRequests.current
      : { signature, visit: crypto.randomUUID(), actions: draftActions.map(() => crypto.randomUUID()) };
    visitRequests.current = requests;
    try {
      if (correctionBase !== null) {
        await recordVisit({ school, day, diagnosis, strengths, weaknesses, summary,
          base: correctionBase, reason: correctionReason, request: requests.visit });
      } else {
        await recordVisitBundle({
          school, day, diagnosis, strengths, weaknesses, summary, request: requests.visit,
          actions: draftActions.map((a, index) => ({
            description: a.description, responsible: a.responsible,
            due: a.due || null, request: requests.actions[index] ?? crypto.randomUUID(),
          })),
        });
      }
      setDiagnosis(""); setStrengths(""); setWeaknesses(""); setSummary("");
      setDraftActions([newAction()]); visitRequests.current = null;
      setNotice(correctionBase === null
        ? "Visita e ações registradas. O histórico da escola foi preservado."
        : "Retificação registrada com justificativa. A versão anterior continua preservada.");
      setCorrectionBase(null); setCorrectionReason("");
      await refresh();
    } catch (e) {
      setError(presentError(e));
    } finally { setSaving(false); }
  }
  async function saveUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionId || !school || !canRecord || savingUpdate || !updateDay || updateDay > today
      || (updateMinDay !== null && updateDay < updateMinDay)) return;
    setSavingUpdate(true); setError(""); setNotice("");
    const signature = JSON.stringify({ actionId, school, updateDay, situation, done, notDone, results, referrals });
    if (updateRequest.current?.signature !== signature) {
      updateRequest.current = { signature, request: crypto.randomUUID() };
    }
    try {
      await recordUpdate({
        action: actionId, visit: null, day: updateDay, situation,
        done, notDone, results, referrals, request: updateRequest.current.request,
      });
      updateRequest.current = null;
      setActionId(""); setDone(""); setNotDone(""); setResults(""); setReferrals("");
      setNotice("Evolução da ação registrada, sem apagar as atualizações anteriores.");
      await refresh();
    } catch (e) { setError(presentError(e)); }
    finally { setSavingUpdate(false); }
  }
  async function saveMeasure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const visit = detail.data?.visits.find((v) => v.id === measureVisitId);
    if (!school || !canRecord || !visit || !measureDraft.description.trim() || savingMeasure
      || (measureDraft.due && measureDraft.due < visit.visit_date)) return;
    setSavingMeasure(true); setError(""); setNotice("");
    const signature = JSON.stringify({ school, visitId: visit.id, measureDraft });
    if (measureRequest.current?.signature !== signature) {
      measureRequest.current = { signature, request: crypto.randomUUID() };
    }
    try {
      await recordAction({
        visit: visit.id, description: measureDraft.description,
        responsible: measureDraft.responsible, due: measureDraft.due || null,
        request: measureRequest.current.request,
      });
      measureRequest.current = null;
      setMeasureVisitId(""); setMeasureDraft(newAction());
      setNotice("Nova medida adicionada ao plano da visita, com autoria e histórico preservados.");
      await refresh();
    } catch (e) { setError(presentError(e)); }
    finally { setSavingMeasure(false); }
  }
  function startMeasure(visit: NonNullable<typeof detail.data>["visits"][number]) {
    if (!canRecord) return;
    setMeasureVisitId(visit.id); setMeasureDraft(newAction());
    measureRequest.current = null; setError(""); setNotice("");

  }
  function startCorrection(visit: NonNullable<typeof detail.data>["visits"][number]) {
    if (!canRecord || !visit.can_correct) return;
    setCorrectionBase(visit.id);
    setCorrectionReason("");
    setDay(visit.visit_date);
    setDiagnosis(visit.diagnosis);
    setStrengths(visit.strengths);
    setWeaknesses(visit.weaknesses);
    setSummary(visit.summary ?? "");
    setDraftActions([newAction()]);
    visitRequests.current = null;
    setError(""); setNotice("Preencha a justificativa e confira os dados da visita original.");

  }
  function changeSchool(id: string) {
    setSchool(id); setActionId(""); setMeasureVisitId(""); setMeasureDraft(newAction());
    setActionView("todas"); setActionQuery("");
    setNotice(""); setError(""); visitRequests.current = null; updateRequest.current = null; measureRequest.current = null;
    setDiagnosis(""); setStrengths(""); setWeaknesses(""); setSummary(""); setDraftActions([newAction()]);
    setDay(today); setCorrectionBase(null); setCorrectionReason("");
  }
  return <div className="space-y-6">
    <PageHeader eyebrow="SIGEM • Acompanhamento institucional" title="Acompanhamento das unidades escolares"
      description="A equipe registra o diagnóstico e a evolução das ações. O Gabinete consulta o panorama da rede e seus históricos." />
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Panorama da rede">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Início do período<DateInput className={input} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Fim do período<DateInput className={input} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="min-w-40 flex-1 text-sm">Buscar unidade<input className={input} type="search" placeholder="Nome ou código INEP" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="text-sm">Situação das escolas
          <select className={input} value={networkView}
            onChange={(e) => setNetworkView(e.target.value as NetworkView)}>
            <option value="todas">Todas as unidades</option>
            <option value="visitadas">Com visitas no período</option>
            <option value="sem visita">Sem visitas no período</option>
            <option value="com prazo vencido">Com medidas vencidas</option>
          </select>
        </label>
        <Button variant="outline" onClick={() => void refresh()}>Atualizar</Button>
        {network.isSuccess && <div className="flex flex-wrap gap-2" aria-label="Exportar panorama autorizado">
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportReport("pdf")}>PDF</Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportReport("xlsx")}>Excel</Button>
          <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportReport("csv")}>CSV</Button>
        </div>}
      </div>
      {network.isPending && <p role="status" className="text-sm text-muted-foreground">Lendo registros autorizados…</p>}
      {network.isError && <StatePanel tone="danger" title="Não foi possível consultar a rede"
        description={presentError(network.error)} />}
      {network.isSuccess && <>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            ["Escolas acessíveis", totals.schools], ["Visitadas no período", totals.visitedSchools],
            ["Ainda sem visita no período", totals.schools - totals.visitedSchools],
            ["Visitas no período", totals.visits], ["Ações cadastradas", totals.actions],
            ["Concluídas (declaradas)", totals.completed], ["Com prazo vencido", totals.overdue],
            ["Ações sem atualização", statuses.data?.find((r) => r.situation === "sem atualização")?.actions ?? "Não apurado"],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>)}
        </div>
        <p className="text-xs text-muted-foreground">As visitas seguem o período selecionado; as ações e sua situação refletem o histórico vigente. Conclusão é sempre declarada pela equipe, não homologada pelo Gabinete.</p>
        {monthly.isSuccess && statuses.isSuccess && <InstitutionalFollowupAnalytics
          months={monthly.data} statuses={statuses.data}
          period={`${dateLabel(from)} a ${dateLabel(to)}`} />}
        {(monthly.isError || statuses.isError) && <p role="status" className="text-sm text-muted-foreground">
          Os gráficos estão indisponíveis. A lista de escolas permanece consultável.
        </p>}
        <h2 className="font-semibold">Escolas e visitas realizadas</h2>
        <p className="text-xs text-muted-foreground">
          {rows.length} de {network.data.length} escolas acessíveis na lista e na exportação.
          Os indicadores e gráficos acima consideram todas as escolas autorizadas.
          A lista é descritiva, sem ranking de qualidade.
        </p>
        {rows.length === 0 ? <EmptyState title="Nenhuma escola disponível" description="Nenhuma unidade foi encontrada neste escopo ou filtro." /> : <>
          <div className="space-y-2">
            {rows.slice(0, 8).map((r) => <div key={r.school_id} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-2 text-xs">
              <span className="truncate" title={r.school_name}>{r.school_name}</span>
              <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(r.visits / maxVisits) * 100}%` }} /></div>
              <span className="tabular-nums">{r.visits}</span>
            </div>)}
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <table className="w-full text-left text-sm"><caption className="sr-only">Unidades da rede e situação de acompanhamento</caption><thead className="sticky top-0 bg-background"><tr>
              <th scope="col" className="p-2">Unidade escolar</th><th scope="col" className="p-2">Visitas</th><th scope="col" className="p-2">Ações</th><th scope="col" className="p-2">Prazo vencido</th>
            </tr></thead><tbody>{rows.map((r) => <tr key={r.school_id} className="border-t">
              <td className="p-2"><button type="button" className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => changeSchool(r.school_id)}>{r.school_name}</button>
                {r.inep && <p className="text-xs text-muted-foreground">INEP: {r.inep}</p>}</td>
              <td className="p-2 tabular-nums">{r.visits}</td><td className="p-2 tabular-nums">{r.actions}</td><td className="p-2 tabular-nums">{r.overdue}</td>
            </tr>)}</tbody></table>
          </div>
        </>}
      </>}
    </section>
    <InstitutionalPendingPanel rows={pending.data ?? []} loading={pending.isPending}
      error={pending.isError ? pending.error : null} today={today} onOpenSchool={changeSchool} />
    {!school && <EmptyState title="Selecione uma unidade escolar" description="Escolha uma escola acima para abrir o histórico e, se você tiver permissão, registrar uma visita." />}
    {school && <section id="followup-school-detail" className="space-y-5" aria-label="Detalhamento da escola">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-semibold">{selected?.school_name ?? school}</h2>
          <p className="text-xs text-muted-foreground">INEP: {selected?.inep ?? "Não informado"}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {detail.isSuccess && <>
            <Button size="sm" variant="outline" disabled={exporting}
              onClick={() => void exportSchoolReport("pdf")}>Ficha PDF</Button>
            <Button size="sm" variant="outline" disabled={exporting}
              onClick={() => void exportSchoolReport("xlsx")}>Ficha Excel</Button>
            <Button size="sm" variant="outline" disabled={exporting}
              onClick={() => void exportSchoolReport("csv")}>Ficha CSV</Button>
          </>}
          <Button variant="outline" onClick={() => changeSchool("")}>Fechar escola</Button>
        </div>
      </div>
      {detail.isPending && <p role="status">Carregando histórico…</p>}
      {detail.isError && <StatePanel tone="danger" title="Histórico indisponível"
        description={presentError(detail.error)} />}
      {stats && <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-muted p-2">{stats.visits} visitas</span>
        <span className="rounded-lg bg-muted p-2">{stats.actions} ações</span>
        <span className="rounded-lg bg-muted p-2">{stats.completed} concluídas</span>
        <span className="rounded-lg bg-muted p-2">{stats.withoutUpdate} sem atualização</span>
        <span className="rounded-lg bg-muted p-2">{stats.noDueDate} sem prazo</span>
      </div>}
      {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
      {canRecord && <form id="followup-visit-form" className="space-y-4 rounded-xl border p-4" onSubmit={(e) => void saveVisit(e)}>
        <h3 className="font-semibold">{correctionBase ? "Retificar visita registrada" : "Registrar nova visita"}</h3>
        {correctionBase && <p className="text-sm text-muted-foreground">
          Uma nova versão será criada sem alterar as medidas vinculadas à visita. A versão original e a justificativa ficarão no histórico.
        </p>}
        <label className="block text-sm">Data da visita<DateInput className={input} max={today} required value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="block text-sm">Diagnóstico da realidade<textarea className={textArea} required maxLength={10000} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">Pontos fortes<textarea className={textArea} maxLength={10000} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
          <label className="block text-sm">Fragilidades e necessidades<textarea className={textArea} maxLength={10000} value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} /></label>
        </div>
        <label className="block text-sm">Observações e encaminhamentos da visita<textarea className={textArea} maxLength={10000} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        {correctionBase && <label className="block text-sm">Justificativa obrigatória da retificação
          <textarea className={textArea} required maxLength={4000} value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)} />
        </label>}
        {!correctionBase && <><h4 className="font-medium">Plano de ação — medidas propostas</h4>
        {draftActions.map((a, i) => <div key={i} className="space-y-2 rounded-lg bg-muted/30 p-3">
          <label className="block text-sm">O que precisa ser feito<textarea className={textArea} maxLength={4000} value={a.description}
            onChange={(e) => setDraftActions((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></label>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block text-sm">Responsável declarado<input className={input} maxLength={250} value={a.responsible}
              onChange={(e) => setDraftActions((prev) => prev.map((x, j) => j === i ? { ...x, responsible: e.target.value } : x))} /></label>
            <label className="block text-sm">Prazo, se houver<DateInput className={input} min={day} value={a.due}
              onChange={(e) => setDraftActions((prev) => prev.map((x, j) => j === i ? { ...x, due: e.target.value } : x))} /></label>
          </div>
        </div>)}</>}
        <div className="flex flex-wrap gap-2">
          {!correctionBase && <>
            <Button type="button" variant="outline" disabled={draftActions.length >= 50}
              onClick={() => { setDraftActions((a) => a.length < 50 ? [...a, newAction()] : a); visitRequests.current = null; }}>Adicionar medida</Button>
            {draftActions.length > 1 && <Button type="button" variant="ghost"
              onClick={() => { setDraftActions((a) => a.slice(0, -1)); visitRequests.current = null; }}>Remover última</Button>}
          </>}
          <Button type="submit" disabled={saving || !diagnosis.trim() || Boolean(correctionBase && !correctionReason.trim())}>
            {saving ? "Registrando…" : correctionBase ? "Salvar retificação" : "Salvar visita e plano"}
          </Button>
          {correctionBase && <Button type="button" variant="outline" onClick={() => {
            setCorrectionBase(null); setCorrectionReason(""); setDiagnosis(""); setStrengths("");
            setWeaknesses(""); setSummary(""); setDraftActions([newAction()]); setDay(today); visitRequests.current = null;
          }}>Cancelar retificação</Button>}
        </div>
        <p className="text-xs text-muted-foreground">O registro é permanente. Para evitar expor dados pessoais, não inclua nomes de estudantes, documentos pessoais ou laudos no texto livre.</p>
      </form>}
      {detail.data && canRecord && measureVisitId && <form id="followup-measure-form"
        className="space-y-3 rounded-xl border p-4" onSubmit={(e) => void saveMeasure(e)}>
        <h3 className="font-semibold">Acrescentar medida a uma visita existente</h3>
        <p className="text-sm text-muted-foreground">
          Visita de {dateLabel(detail.data.visits.find((v) => v.id === measureVisitId)?.visit_date ?? null)}.
          A nova medida é adicionada ao plano sem alterar o diagnóstico ou medidas anteriores.
        </p>
        <label className="block text-sm">O que precisa ser feito
          <textarea className={textArea} required maxLength={4000}
            value={measureDraft.description}
            onChange={(e) => setMeasureDraft((d) => ({ ...d, description: e.target.value }))} />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">Responsável declarado
            <input className={input} maxLength={250} value={measureDraft.responsible}
              onChange={(e) => setMeasureDraft((d) => ({ ...d, responsible: e.target.value }))} />
          </label>
          <label className="block text-sm">Prazo, se houver
            <DateInput className={input}
              min={detail.data.visits.find((v) => v.id === measureVisitId)?.visit_date}
              value={measureDraft.due}
              onChange={(e) => setMeasureDraft((d) => ({ ...d, due: e.target.value }))} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={savingMeasure || !measureDraft.description.trim()}>
            {savingMeasure ? "Salvando…" : "Acrescentar medida"}
          </Button>
          <Button type="button" variant="outline" onClick={() => {
            setMeasureVisitId(""); setMeasureDraft(newAction()); measureRequest.current = null;
          }}>Cancelar</Button>
        </div>
      </form>}
      {detail.data && <>
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Ações e evolução</h3>
            <span className="text-xs text-muted-foreground">{visibleActions.length} de {detail.data.actions.length} medidas</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Filtrar por situação e prazo
              <select className={input} value={actionView}
                onChange={(e) => setActionView(e.target.value as ActionView)}>
                <option value="todas">Todas as medidas</option>
                <option value="prazo vencido">Com prazo vencido</option>
                <option value="sem prazo">Sem prazo declarado</option>
                <option value={NO_UPDATE}>Sem atualização registrada</option>
                {SITUATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-sm">Buscar medida ou responsável
              <input className={input} type="search" placeholder="Descrição, responsável ou data"
                value={actionQuery} onChange={(e) => setActionQuery(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Medidas ordenadas pelo prazo declarado mais próximo; medidas sem prazo aparecem por último.
            Sem atualização não significa não realizada.
          </p>
          {!detail.data.actions.length && <p className="text-sm text-muted-foreground">Nenhuma medida cadastrada.</p>}
          {detail.data.actions.length > 0 && visibleActions.length === 0 &&
            <p className="text-sm text-muted-foreground">Nenhuma medida corresponde aos filtros. Os registros permanecem no histórico.</p>}
          {visibleActions.map((a) => {
            const latest = currentUpdate(a, detail.data!.updates);
            return <div key={a.id} className="space-y-2 border-b pb-3 last:border-0">
              <p className="font-medium">{a.description}</p>
              <p className="text-xs text-muted-foreground">
                Responsável: {a.responsible_label || "Não informado"} • Registro: {a.author_name || "Autoria registrada"}
                {" • "}Prazo: {dateLabel(a.due_on)} • Situação: {currentSituation(a, detail.data!.updates)}
                {isOverdue(a, detail.data!.updates, today) && <strong className="text-destructive"> • Prazo vencido</strong>}
              </p>
              {latest && <p className="text-sm">Última atualização ({dateLabel(latest.occurred_on)}): {latest.situation}</p>}
              {detail.data!.updates.some((u) => u.action_id === a.id) && <details className="rounded-lg bg-muted/30 p-3 text-sm">
                <summary className="cursor-pointer font-medium">Consultar histórico completo desta ação</summary>
                <ol className="mt-3 space-y-3">
                  {detail.data!.updates.filter((u) => u.action_id === a.id)
                    .sort((x, y) => y.occurred_on.localeCompare(x.occurred_on) || y.created_at.localeCompare(x.created_at))
                    .map((u) => <li key={u.id} className="space-y-1 border-b pb-2 last:border-0">
                      <p className="font-medium">{dateLabel(u.occurred_on)} — {u.situation} • {u.author_name || "Autoria registrada"}</p>
                      <p><strong>O que foi feito:</strong> {u.done_text || "Não informado"}</p>
                      <p><strong>O que não foi feito:</strong> {u.not_done_text || "Não informado"}</p>
                      <p><strong>Resultados:</strong> {u.results || "Não informado"}</p>
                      <p><strong>Encaminhamentos:</strong> {u.referrals || "Não informado"}</p>
                    </li>)}
                </ol>
              </details>}
              {canRecord && <Button size="sm" variant="outline" onClick={() => { setActionId(a.id); updateRequest.current = null; }}>Registrar evolução</Button>}
            </div>;
          })}
        </div>
        {canRecord && actionId && <form className="space-y-3 rounded-xl border p-4" onSubmit={(e) => void saveUpdate(e)}>
          <h3 className="font-semibold">Nova atualização da ação</h3>
          <label className="block text-sm">Data<DateInput className={input} required min={updateMinDay ?? undefined} max={today} value={updateDay} onChange={(e) => setUpdateDay(e.target.value)} /></label>
          <label className="block text-sm">Situação declarada<select className={input} value={situation} onChange={(e) => setSituation(e.target.value)}>
            {SITUATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select></label>
          <label className="block text-sm">O que foi feito<textarea className={textArea} maxLength={4000} value={done} onChange={(e) => setDone(e.target.value)} /></label>
          <label className="block text-sm">O que não foi feito<textarea className={textArea} maxLength={4000} value={notDone} onChange={(e) => setNotDone(e.target.value)} /></label>
          <label className="block text-sm">Resultados<textarea className={textArea} maxLength={4000} value={results} onChange={(e) => setResults(e.target.value)} /></label>
          <label className="block text-sm">Encaminhamentos<textarea className={textArea} maxLength={4000} value={referrals} onChange={(e) => setReferrals(e.target.value)} /></label>
          <div className="flex gap-2"><Button type="submit" disabled={savingUpdate}>{savingUpdate ? "Salvando…" : "Registrar atualização"}</Button>
            <Button type="button" variant="outline" onClick={() => setActionId("")}>Cancelar</Button></div>
        </form>}
        <div className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">Histórico de visitas</h3>
          {!detail.data.visits.length && <p className="text-sm text-muted-foreground">Nenhuma visita registrada.</p>}
          {detail.data.visits.map((v) => <article key={v.id} className="space-y-2 border-b pb-3 last:border-0">
            <p className="text-sm font-medium">{dateLabel(v.visit_date)} • {v.author_name || "Autoria institucional registrada"} {v.version > 1 ? `(retificação v${v.version})` : ""}</p>
            <p className="text-sm"><strong>Diagnóstico:</strong> {v.diagnosis}</p>
            <p className="text-sm"><strong>Pontos fortes:</strong> {v.strengths || "Não informado"}</p>
            <p className="text-sm"><strong>Fragilidades:</strong> {v.weaknesses || "Não informado"}</p>
            {v.summary && <p className="text-sm"><strong>Encaminhamentos:</strong> {v.summary}</p>}
            {v.correction_reason && <p className="text-sm"><strong>Justificativa da última retificação:</strong> {v.correction_reason}</p>}
            {v.version > 1 && <details className="rounded-md bg-muted/30 p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Ver {detail.data!.visit_history.filter((h) => h.logical_id === v.logical_id).length} versão(ões) anteriores
              </summary>
              <ol className="mt-2 space-y-3">
                {detail.data!.visit_history.filter((h) => h.logical_id === v.logical_id)
                  .sort((a, b) => b.version - a.version).map((h) => <li key={h.id} className="space-y-1 border-b pb-2 last:border-0">
                    <p className="font-semibold">Versão {h.version} • {dateLabel(h.visit_date)} • {h.author_name || "Autoria registrada"}</p>
                    <p><strong>Diagnóstico:</strong> {h.diagnosis}</p>
                    <p><strong>Pontos fortes:</strong> {h.strengths || "Não informado"}</p>
                    <p><strong>Fragilidades:</strong> {h.weaknesses || "Não informado"}</p>
                    <p><strong>Encaminhamentos:</strong> {h.summary || "Não informado"}</p>
                    {h.correction_reason && <p><strong>Motivo da correção desta versão:</strong> {h.correction_reason}</p>}
                  </li>)}
              </ol>
            </details>}
            <div className="flex flex-wrap gap-2" aria-label="Exportar relatório individual da visita">
              <Button type="button" size="sm" variant="outline" disabled={exporting}
                onClick={() => void exportVisitReport(v.id, "pdf")}>Relatório da visita PDF</Button>
              <Button type="button" size="sm" variant="outline" disabled={exporting}
                onClick={() => void exportVisitReport(v.id, "xlsx")}>Excel</Button>
              <Button type="button" size="sm" variant="outline" disabled={exporting}
                onClick={() => void exportVisitReport(v.id, "csv")}>CSV</Button>
            </div>
            {canRecord && <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => startMeasure(v)}>
                Acrescentar medida ao plano
              </Button>
              {v.can_correct && <Button type="button" size="sm" variant="outline"
                onClick={() => startCorrection(v)}>Retificar esta visita</Button>}
            </div>}
          </article>)}
        </div>
      </>}
    </section>}
  </div>;
}
