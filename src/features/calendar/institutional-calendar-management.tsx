import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { OWNER_DECISION_ACT_REF } from "@/features/calendar/calendar-central";
/**
 * B4.6.7b — Gestão institucional do calendário (Supervisão): tipos de dia, norma exclusiva, versões do calendário,
 * homologação/revogação e importação explícita do navegador.
 *
 * - Cada seção só aparece com a capacidade EXATA na sessão; o banco revalida tudo (a tela nunca é garantia).
 * - Toda gravação leva base esperada (última versão/decisão lida neste knownAt), ato e motivo.
 * - Seletores mostram rótulos humanos; IDs técnicos só no bloco "Auditoria".
 * - Ausência de ano/organização/períodos/escolas/valores homologados orienta a Administração; nada é inventado.
 */
import { classNamesAt } from "@/features/classes/class-names-batch";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { captureCalendarKnownAt } from "./institutional-calendar-source";
import { readCalendarDays, readCalendarList, readDayTypes, readNorm, type CalendarDayRead, type CalendarVersionSummary, type DayTypeVersion } from "./institutional-calendar-readers";
import {
  CalendarWriteRefused, decideCalendar, decideNorm, recordCalendarVersion, recordDayTypeVersion, recordExclusiveNormVersion,
  recordPresentationSnapshot, writeRefusalText, type Decision, type ScopeInput,
} from "./institutional-calendar-writers";
import {
  BROWSER_CALENDAR_KEY, buildDaysPayload, buildImportPlan, customizationsAgainstReference, readBrowserCalendarsOnRequest,
  referenceCalendars2027, sha256Hex, type BrowserCalendarRead, type ImportPlan, type InstitutionalTypeChoice,
} from "./calendar-browser-import";
import { loadAcademicYearOptions, loadSchoolOptions } from "@/features/curriculum/curricular-matrix-source";
import { homologatedValues } from "@/features/classes/class-offering-shift-source";
import type { NetworkCalendar } from "./calendar-types";
import { DateInput } from "@/components/sigem/date-input";
import {
  buildPrintModel, composePresentation, pendingPresentation, presentationTitle, readPresentation, titleCollision,
  type PendingPresentation, type PresentationRead,
} from "./institutional-calendar-presentation";
import { InstitutionalCalendarPrint, InstitutionalPrintSheet } from "./institutional-calendar-print";
import { DEFAULT_TEMPLATE, type PresentationTemplateCode } from "./calendar-external-model";
import { ExternalPresentationPanel, TemplateSelector } from "./calendar-external-panel";
import { AcademicStructureAssistant, B24_CAPABILITY } from "./calendar-activation-assistant";
import { councilProposals, readCouncilConfiguration, recordCouncilConfiguration } from "./institutional-calendar-councils";

export const CAP = {
  build: "construir-calendario-da-rede", homologate: "homologar-calendario-da-rede",
  normBuild: "construir-norma-composicao-calendario-da-rede", normHomologate: "homologar-norma-composicao-calendario-da-rede",
} as const;

const today = () => operationalToday();
const errText = (e: unknown) => e instanceof CalendarWriteRefused ? e.message : e instanceof Error ? writeRefusalText(e.message) : "Falha inesperada. Nada foi confirmado.";
const EFFECT_LABEL = (e: boolean | null) => e === true ? "conta como dia letivo" : e === false ? "não conta como dia letivo" : "efeito não declarado";
const effectFromValue = (v: string): boolean | null => v === "true" ? true : v === "false" ? false : null;
const effectToValue = (e: boolean | null) => e === true ? "true" : e === false ? "false" : "null";

/** Última versão por tipo (base esperada). */
const latestTypes = (vs: readonly DayTypeVersion[]) => {
  const m = new Map<string, DayTypeVersion>();
  for (const v of vs) { const c = m.get(v.dayTypeId); if (!c || v.version > c.version) m.set(v.dayTypeId, v); }
  return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
};

export function InstitutionalCalendarManagement({ contextKey, capabilities }: { contextKey: string; capabilities: readonly string[] }) {
  const has = (c: string) => capabilities.includes(c);
  const any = Object.values(CAP).some(has);
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tick, setTick] = useState(0);
  const qc = useQueryClient();
  const refresh = () => { setTick((t) => t + 1); void qc.invalidateQueries({ queryKey: ["b467-calendar-list"] }); };
  if (!any) return null;
  return (
    <section aria-label="Gestão do calendário da rede" className="space-y-6 rounded border border-border p-4">
      <h2 className="text-lg font-semibold">Gestão do calendário da rede</h2>
      <p className="text-sm text-muted-foreground">As ações abaixo aparecem conforme as capacidades da sua atuação vigente. O banco confere cada registro.</p>
      <Prerequisites contextKey={contextKey} />
      {has(CAP.build) && <DayTypesSection key={`t${tick}`} contextKey={contextKey} onDone={refresh} />}
      {(has(CAP.normBuild) || has(CAP.normHomologate)) && (
        <NormSection key={`n${tick}`} contextKey={contextKey} canBuild={has(CAP.normBuild)} canDecide={has(CAP.normHomologate)} onDone={refresh} />
      )}
      {has(CAP.build) && <CalendarVersionSection key={`c${tick}`} contextKey={contextKey} onDone={refresh} canWriteB24={has(B24_CAPABILITY)} />}
      {(has(CAP.homologate) || has(CAP.build)) && <CalendarDecisionSection key={`d${tick}`} contextKey={contextKey} knownAt={knownAt} onDone={refresh}
        canDecide={has(CAP.homologate)} canBuild={has(CAP.build)} />}
    </section>
  );
}

// ---------- pré-requisitos ----------
type B24 = { years: { id: string; name: string }[]; orgs: { id: string; yearId: string; name: string }[]; periods: { id: string; orgId: string; name: string; startsOn: string; endsOn: string }[] };
async function loadB24(on: string): Promise<B24> {
  const years = await loadAcademicYearOptions(on);
  const [ov, o, p, pv] = await Promise.all([
    supabase.from("institutional_period_organization_versions").select("organization_id, version, official_name, is_active").lte("valid_from", on).order("version", { ascending: false }),
    supabase.from("institutional_period_organizations").select("id, academic_year_id"),
    supabase.from("institutional_academic_periods").select("id, period_organization_id"),
    supabase.from("institutional_academic_period_versions").select("period_id, version, official_name, starts_on, ends_on, is_active").lte("valid_from", on).order("version", { ascending: false }),
  ]);
  for (const r of [ov, o, p, pv]) if (r.error) throw r.error;
  const orgName = new Map<string, { name: string; active: boolean }>();
  for (const r of ov.data ?? []) if (!orgName.has(r.organization_id)) orgName.set(r.organization_id, { name: r.official_name, active: r.is_active });
  const orgs = (o.data ?? []).flatMap((x) => { const n = orgName.get(x.id); return n?.active ? [{ id: x.id, yearId: x.academic_year_id, name: n.name }] : []; });
  const pName = new Map<string, NonNullable<typeof pv.data>[number]>();
  for (const r of pv.data ?? []) if (!pName.has(r.period_id)) pName.set(r.period_id, r);
  const periods = (p.data ?? []).flatMap((x) => {
    const v = pName.get(x.id); return v?.is_active && x.period_organization_id ? [{ id: x.id, orgId: x.period_organization_id, name: v.official_name, startsOn: v.starts_on, endsOn: v.ends_on }] : [];
  }).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return { years, orgs, periods };
}

function Prerequisites({ contextKey }: { contextKey: string }) {
  const on = today();
  const q = useQuery({ queryKey: ["b467b-prereq", contextKey, on], retry: false, queryFn: async () => ({ b24: await loadB24(on), schools: await loadSchoolOptions(on) }) });
  if (q.error) return <p role="alert" className="text-sm text-destructive">Não foi possível ler os cadastros de base: {errText(q.error)}</p>;
  if (!q.data) return <p role="status" className="text-sm text-muted-foreground">Conferindo cadastros de base…</p>;
  const missing: string[] = [];
  if (q.data.b24.years.length === 0) missing.push("ano letivo ativo");
  if (q.data.b24.orgs.length === 0) missing.push("organização oficial de períodos");
  if (q.data.b24.periods.length === 0) missing.push("períodos letivos ativos");
  const noSchools = q.data.schools.length === 0;
  if (missing.length === 0 && !noSchools) return null;
  return (
    <div role="note" className="space-y-1 rounded border border-border bg-muted p-3 text-sm">
      {missing.length > 0 && <p>Para registrar uma versão do calendário ainda falta: {missing.join(", ")}. Clique em “Ler calendários deste navegador” abaixo: o assistente de ano letivo e períodos aparece com prévia a partir da fonte 2027; nada é gravado sem sua confirmação.</p>}
      {noSchools && <p>Sem unidades escolares cadastradas: o calendário pode ser construído e homologado, mas recortes por escola só existem depois do cadastro das escolas (<Link to="/administracao" className="underline">Administração</Link>).</p>}
    </div>
  );
}

// ---------- campos comuns ----------
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}
const inputCls = "w-full rounded border border-input bg-background px-2 py-1 text-sm";
function ActReason({ act, setAct, reason, setReason, reasonRequired }: { act: string; setAct: (s: string) => void; reason: string; setReason: (s: string) => void; reasonRequired: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Referência documental/fonte (opcional)"><input className={inputCls} value={act} onChange={(e) => setAct(e.target.value)} placeholder="Ex.: Portaria nº …" /></Field>
      <Field label={reasonRequired ? "Motivo (obrigatório)" : "Motivo (opcional)"}><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </div>
  );
}
function Status({ busy, msg, error }: { busy: boolean; msg: string | null; error: string | null }) {
  return <>{busy && <p role="status" className="text-sm text-muted-foreground">Gravando…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {msg && <p role="status" className="text-sm">{msg}</p>}</>;
}
function useWrite(onDone: () => void) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const run = async (f: () => Promise<string>) => {
    setBusy(true); setMsg(null); setError(null);
    try { setMsg(await f()); onDone(); } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  return { busy, msg, error, run };
}
function Audit({ rows }: { rows: [string, string | null][] }) {
  return <details className="text-xs text-muted-foreground"><summary>Auditoria</summary>
    <dl>{rows.map(([k, v]) => <div key={k}><dt className="inline">{k}: </dt><dd className="inline font-mono">{v ?? "—"}</dd></div>)}</dl></details>;
}

// ---------- tipos de dia ----------
function useDayTypes(contextKey: string) {
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return useQuery({ queryKey: ["b467b-types", contextKey, knownAt], retry: false, queryFn: () => readDayTypes({ knownAt }) });
}

function DayTypesSection({ contextKey, onDone }: { contextKey: string; onDone: () => void }) {
  const q = useDayTypes(contextKey);
  const [editing, setEditing] = useState<DayTypeVersion | null>(null);
  const [label, setLabel] = useState(""); const [effect, setEffect] = useState("null");
  const [act, setAct] = useState(OWNER_DECISION_ACT_REF); const [reason, setReason] = useState("");
  const w = useWrite(onDone);
  const types = q.data?.kind === "lido" ? latestTypes(q.data.versions) : [];
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Tipos de dia (feriado, recesso, férias, conselho…)</h3>
      {q.error && <p role="alert" className="text-sm text-destructive">{errText(q.error)}</p>}
      {q.data && q.data.kind !== "lido" && <p className="text-sm text-muted-foreground">Leitura dos tipos indisponível para a sua conta.</p>}
      {q.data?.kind === "lido" && (types.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum tipo de dia registrado.</p> : (
        <ul className="space-y-1 text-sm">{types.map((t) => (
          <li key={t.versionId} className="flex flex-wrap items-center gap-2">
            <span>{t.label} — {EFFECT_LABEL(t.schoolDayEffect)} (versão {t.version})</span>
            <Button size="sm" variant="outline" onClick={() => { setEditing(t); setLabel(t.label); setEffect(effectToValue(t.schoolDayEffect)); }}>Nova versão</Button>
            <Audit rows={[["Tipo", t.dayTypeId], ["Versão", t.versionId], ["Ato", t.actId]]} />
          </li>))}</ul>))}
      <form className="space-y-2 rounded border border-border p-3" onSubmit={(e) => { e.preventDefault();
        void w.run(async () => { await recordDayTypeVersion({ dayTypeId: editing?.dayTypeId ?? null, baseVersionId: editing?.versionId ?? null,
          label, schoolDayEffect: effectFromValue(effect), actRef: act, reason }); return editing ? "Nova versão do tipo registrada." : "Tipo de dia registrado."; }); }}>
        <p className="text-sm font-medium">{editing ? `Nova versão de "${editing.label}"` : "Novo tipo de dia"}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Nome"><input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field label="Efeito sobre o dia letivo (declaração explícita)">
            <select className={inputCls} value={effect} onChange={(e) => setEffect(e.target.value)}>
              <option value="true">Conta como dia letivo</option><option value="false">Não conta como dia letivo</option><option value="null">Ainda não declarado</option>
            </select>
          </Field>
        </div>
        <ActReason act={act} setAct={setAct} reason={reason} setReason={setReason} reasonRequired={!!editing} />
        <div className="flex gap-2"><Button type="submit" disabled={w.busy}>Registrar</Button>
          {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setLabel(""); setEffect("null"); }}>Cancelar nova versão</Button>}</div>
        <Status {...w} />
      </form>
    </div>
  );
}

// ---------- norma exclusiva ----------
function NormSection({ contextKey, canBuild, canDecide, onDone }: { contextKey: string; canBuild: boolean; canDecide: boolean; onDone: () => void }) {
  const on = today();
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({ queryKey: ["b467b-norm", contextKey, on, knownAt], retry: false, queryFn: () => readNorm({ on, knownAt }) });
  const [from, setFrom] = useState(on); const [until, setUntil] = useState("");
  const [act, setAct] = useState(OWNER_DECISION_ACT_REF); const [reason, setReason] = useState("");
  const w = useWrite(onDone);
  const versions = q.data?.kind === "lido" ? q.data.versions : [];
  const latest = [...versions].sort((a, b) => b.version - a.version)[0];
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Norma de composição: exclusividade</h3>
      <p className="text-sm text-muted-foreground">Exige um único calendário aplicável por data; havendo mais de um, o dia fica bloqueado. Nenhuma prioridade entre calendários é definida.</p>
      {q.error && <p role="alert" className="text-sm text-destructive">{errText(q.error)}</p>}
      {q.data?.kind === "lido" && (versions.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma norma registrada para hoje.</p> : (
        <ul className="space-y-2 text-sm">{versions.map((v) => (
          <li key={v.versionId} className="rounded border border-border p-2">
            Versão {v.version} — vigência {v.validFrom}{v.validTo ? ` a ${v.validTo}` : " sem término"} — situação: {v.state}
            {canDecide && <DecisionForm kind="norma" onSubmit={(d) => decideNorm({ versionId: v.versionId, expectedLastId: v.lastHomologationId, ...d })} onDone={onDone} hasPrior={!!v.lastHomologationId} />}
            <Audit rows={[["Norma", v.normId], ["Versão", v.versionId], ["Última decisão", v.lastHomologationId], ["Ato", v.actId]]} />
          </li>))}</ul>))}
      {canBuild && (
        <form className="space-y-2 rounded border border-border p-3" onSubmit={(e) => { e.preventDefault();
          void w.run(async () => { await recordExclusiveNormVersion({ normId: latest?.normId ?? null, baseVersionId: latest?.versionId ?? null,
            validFrom: from, validUntil: until || null, actRef: act, reason }); return "Versão da norma registrada (ainda não homologada)."; }); }}>
          <p className="text-sm font-medium">{latest ? "Nova versão da norma" : "Constituir a norma"}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Vigência a partir de"><DateInput className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Vigência até (opcional)"><DateInput className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
          </div>
          <ActReason act={act} setAct={setAct} reason={reason} setReason={setReason} reasonRequired={!!latest} />
          <Button type="submit" disabled={w.busy}>Registrar norma</Button>
          <Status {...w} />
        </form>
      )}
    </div>
  );
}

function DecisionForm({ kind, onSubmit, onDone, hasPrior }: {
  kind: string; hasPrior: boolean; onDone: () => void;
  onSubmit: (d: { decision: Decision; effectiveFrom: string; actRef: string; reason: string }) => Promise<unknown>;
}) {
  const [decision, setDecision] = useState<Decision>("homologada"); const [eff, setEff] = useState(today());
  const [act, setAct] = useState(OWNER_DECISION_ACT_REF); const [reason, setReason] = useState("");
  const w = useWrite(onDone);
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault();
      void w.run(async () => { await onSubmit({ decision, effectiveFrom: eff, actRef: act, reason }); return decision === "homologada" ? `Homologação da ${kind} registrada.` : `Revogação da ${kind} registrada.`; }); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Decisão"><select className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value as Decision)}>
          <option value="homologada">Homologar</option><option value="revogada">Revogar</option></select></Field>
        <Field label="Com efeito a partir de"><DateInput className={inputCls} value={eff} onChange={(e) => setEff(e.target.value)} /></Field>
      </div>
      <ActReason act={act} setAct={setAct} reason={reason} setReason={setReason} reasonRequired={decision === "revogada" || hasPrior} />
      <Button type="submit" size="sm" disabled={w.busy}>Registrar decisão</Button>
      <Status {...w} />
    </form>
  );
}

// ---------- decisões sobre versões do calendário ----------
function CalendarDecisionSection({ contextKey, knownAt, onDone, canDecide, canBuild }: {
  contextKey: string; knownAt: string; onDone: () => void; canDecide: boolean; canBuild: boolean;
}) {
  const on = today();
  const q = useQuery({ queryKey: ["b467b-decide-list", contextKey, knownAt], retry: false, queryFn: async () => {
    const list = await readCalendarList({ knownAt });
    const versions = list.kind === "lido" ? list.versions : [];
    const pres = await Promise.all(versions.map((v) => readPresentation({ versionId: v.versionId, on, knownAt })));
    return { list, versions, pres: new Map(versions.map((v, i) => [v.versionId, pres[i]!])), b24: await loadB24(on) };
  } });
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Versões do calendário: apresentação, impressão e decisão</h3>
      {q.error && <p role="alert" className="text-sm text-destructive">{errText(q.error)}</p>}
      {q.data && q.data.versions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>}
      <ul className="space-y-2 text-sm">{q.data?.versions.map((v) => {
        const pr = q.data.pres.get(v.versionId)!;
        const title = pr.kind === "lido" ? presentationTitle(pr.snapshot.presentation) : null;
        return (
          <li key={v.versionId} className="space-y-1 rounded border border-border p-2">
            <p><strong>{title ?? "Calendário sem título declarado"}</strong> — versão {v.version} — vigência {v.validFrom}{v.validTo ? ` a ${v.validTo}` : ""} —{" "}
              {v.lastHomologation ? `${v.lastHomologation.decision} desde ${v.lastHomologation.effectiveFrom}` : "sem decisão"}</p>
            <PresentationState read={pr} />
            {pr.kind === "sem-snapshot" && !v.lastHomologation && canBuild && <AttachPresentation versionId={v.versionId} onDone={onDone} />}
            {pr.kind === "lido" && <PrintVersion version={v} presentation={pr.snapshot.presentation} knownAt={knownAt}
              periods={q.data.b24.periods.filter((p) => p.orgId === v.periodOrganizationId)} />}
            <CouncilRoles version={v} presentation={pr.kind === "lido" ? pr.snapshot.presentation : null} knownAt={knownAt} canBuild={canBuild} onDone={onDone} />
            {canDecide && (pr.kind === "lido" || v.lastHomologation
              ? <DecisionForm kind="versão do calendário" hasPrior={!!v.lastHomologation} onDone={onDone}
                  onSubmit={(d) => decideCalendar({ versionId: v.versionId, expectedLastId: v.lastHomologation?.recordId ?? null, ...d })} />
              : <p role="note" className="text-xs text-muted-foreground">Homologação indisponível: anexe primeiro a apresentação desta versão (título, simbologia, assinaturas e origem).</p>)}
            <Audit rows={[["Calendário", v.calendarId], ["Versão", v.versionId], ["Última decisão", v.lastHomologation?.recordId ?? null],
              ["Origem da apresentação", pr.kind === "lido" ? pr.snapshot.sourceKind : pr.kind], ["Resumo do original", pr.kind === "lido" ? pr.snapshot.sourceDigest : null]]} />
          </li>);
      })}</ul>
    </div>
  );
}

function PresentationState({ read }: { read: PresentationRead }) {
  if (read.kind === "lido") return <p className="text-xs text-muted-foreground">Apresentação anexada ({read.snapshot.sourceKind === "importacao-navegador" ? "calendário salvo no navegador"
    : read.snapshot.sourceKind === "referencia-codigo" ? "REFERÊNCIA do sistema, com declaração" : "edição institucional"}).</p>;
  if (read.kind === "sem-snapshot") return <p role="alert" className="text-xs text-destructive">Esta versão está sem apresentação anexada.</p>;
  if (read.kind === "acesso-negado") return <p className="text-xs text-muted-foreground">Apresentação não disponível para a sua conta.</p>;
  return <p role="alert" className="text-xs text-destructive">Não foi possível ler a aparência salva deste calendário. Nada foi alterado; tente abrir de novo.</p>;
}

/** Nova tentativa do anexo SEM nova versão: reaproveita o pacote pendente desta aba ou uma apresentação mínima declarada. */
function AttachPresentation({ versionId, onDone }: { versionId: string; onDone: () => void }) {
  const p = pendingPresentation.get(versionId);
  const [title, setTitle] = useState("");
  const w = useWrite(onDone);
  const attach = () => w.run(async () => {
    const pk: PendingPresentation = p ?? await (async () => {
      if (!title.trim()) throw new CalendarWriteRefused("form:titulo-obrigatorio");
      const presentation = composePresentation({ base: null, title, typeMap: {}, baseVersionId: null });
      return { versionId, sourceKind: "edicao-institucional" as const, sourceKey: null, sourceEntryId: null,
        digest: await sha256Hex(JSON.stringify(presentation)), raw: null, presentation, note: null, lastError: "" };
    })();
    await recordPresentationSnapshot({ versionId, sourceKind: pk.sourceKind, sourceKey: pk.sourceKey, sourceEntryId: pk.sourceEntryId,
      digest: pk.digest, raw: pk.raw, presentation: pk.presentation, note: pk.note });
    pendingPresentation.clear(versionId);
    return "Apresentação anexada à versão existente. Nenhuma nova versão foi criada.";
  });
  return (
    <div className="space-y-1 rounded border border-border p-2">
      {p ? <p className="text-xs">O anexo preparado nesta tela falhou ({p.lastError}). Tente de novo com o mesmo conteúdo (original e aparência preservados).</p>
        : <Field label="Título do calendário (ex.: Calendário Regular 2027)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>}
      {!p && <p className="text-xs text-muted-foreground">O pacote original desta versão não está mais nesta tela; será anexada só uma apresentação mínima declarada por você.</p>}
      <Button type="button" size="sm" disabled={w.busy} onClick={() => void attach()}>{p ? "Tentar anexar de novo" : "Anexar apresentação"}</Button>
      <Status {...w} />
    </div>
  );
}

function PrintVersion({ version, presentation, knownAt, periods, autoLoad = false, canEdit = true }: {
  version: CalendarVersionSummary; presentation: Record<string, unknown>; knownAt: string; periods: { name: string; startsOn: string; endsOn: string }[];
  autoLoad?: boolean; canEdit?: boolean;
}) {
  const [model, setModel] = useState<ReturnType<typeof buildPrintModel> | null>(null);
  const [readDays, setReadDays] = useState<readonly CalendarDayRead[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [template, setTemplate] = useState<PresentationTemplateCode>(DEFAULT_TEMPLATE);
  const load = async () => {
    setErr(null);
    try {
      const to = version.validTo ?? `${version.validFrom.slice(0, 4)}-12-31`;
      const r = await readCalendarDays({ calendarId: version.calendarId, from: version.validFrom, to, knownAt });
      if (r.kind !== "lido") { setErr("Declarações desta versão indisponíveis para impressão."); return; }
      setReadDays(r.days); setModel(buildPrintModel(presentation, r.days, periods));
    } catch (e) { setErr(errText(e)); }
  };
  useEffect(() => { if (autoLoad) void load(); }, [autoLoad, version.versionId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-1">
      {autoLoad && !model && !err && <p role="status" className="text-xs text-muted-foreground">Lendo as declarações da versão…</p>}
      {autoLoad && err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      {model && <TemplateSelector value={template} onChange={setTemplate} />}
      {template === "interno" ? (
        <>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Visualizar folha institucional</Button>
            {model && <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button>}
          </div>
          {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
          {model && <><InstitutionalPrintSheet model={model} presentation={presentation} versionId={version.versionId} /><InstitutionalCalendarPrint model={model} presentation={presentation} versionId={version.versionId} /></>}
        </>
      ) : model && (
        <ExternalPresentationPanel template={template} model={model} presentation={presentation} calendarId={version.calendarId} versionId={version.versionId} days={readDays} on={version.validFrom} knownAt={knownAt} canEdit={canEdit} />
      )}
    </div>
  );
}

/**
 * Papéis de conselho da versão (B4.6.7f): declaração explícita sob a construção, antes da homologação da MESMA
 * versão. A proposta da fonte (councilRole) aparece ao lado e só vale se a pessoa a escolher.
 */
function CouncilRoles({ version, presentation, knownAt, canBuild, onDone }: {
  version: CalendarVersionSummary; presentation: Record<string, unknown> | null; knownAt: string; canBuild: boolean; onDone: () => void;
}) {
  const on = version.validFrom;
  const cfg = useQuery({ queryKey: ["b467f-council-config", version.versionId, knownAt], retry: false,
    queryFn: () => readCouncilConfiguration({ versionId: version.versionId, on, knownAt }) });
  const types = useQuery({ queryKey: ["b467f-types", knownAt], enabled: canBuild, retry: false, queryFn: () => readDayTypes({ knownAt }) });
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [act, setAct] = useState(OWNER_DECISION_ACT_REF);
  const w = useWrite(onDone);
  if (cfg.error) return <p role="alert" className="text-xs text-destructive">{errText(cfg.error)}</p>;
  if (!cfg.data) return <p role="status" className="text-xs text-muted-foreground">Lendo papéis de conselho…</p>;
  const c = cfg.data;
  if (c.kind === "configurada") return (
    <p className="text-xs">Papéis de conselho declarados (ato {c.actRef}): {c.declaresNone ? "nenhum tipo de dia é conselho nesta versão." : c.roles.map((r) => {
      const t = types.data?.kind === "lido" ? types.data.versions.find((x) => x.dayTypeId === r.dayTypeId) : undefined;
      return `${t?.label ?? "tipo de dia"} = ${r.role}`; }).join("; ")}</p>);
  if (c.kind !== "nao-configurada") return <p className="text-xs text-muted-foreground">Papéis de conselho indisponíveis para a sua conta.</p>;
  if (version.lastHomologation) return <p role="note" className="text-xs text-muted-foreground">Esta versão foi decidida sem papéis de conselho; a agenda fica “não configurada” para ela. Para declará-los, registre uma nova versão.</p>;
  if (!canBuild) return <p role="note" className="text-xs text-muted-foreground">Papéis de conselho ainda não declarados nesta versão.</p>;
  const proposals = councilProposals(presentation);
  const all = types.data?.kind === "lido" ? types.data.versions : [];
  const latest = latestTypes(all);
  const proposalOf = (dayTypeId: string) => all.filter((v) => v.dayTypeId === dayTypeId).map((v) => proposals.get(v.versionId)).find(Boolean) ?? null;
  const submit = (none: boolean) => w.run(async () => {
    const roles = none ? [] : Object.entries(chosen).filter(([, r]) => r !== undefined).map(([dayTypeId, role]) => ({ dayTypeId, role, sourceProposal: proposalOf(dayTypeId) }));
    if (!none && roles.length === 0) throw new CalendarWriteRefused("calendar-council:roles-required");
    await recordCouncilConfiguration({ versionId: version.versionId, roles, actRef: act });
    return none ? "Declarado: nenhum tipo de dia é conselho nesta versão." : "Papéis de conselho declarados nesta versão; serão aprovados junto com a homologação dela.";
  });
  return (
    <fieldset className="space-y-1 rounded border border-border p-2 text-xs">
      <legend className="font-medium">Papéis de conselho desta versão (antes da homologação)</legend>
      <p className="text-muted-foreground">Marque só os tipos de dia que são conselho. O nome do tipo e a proposta da fonte não decidem nada sozinhos.</p>
      {latest.map((t) => { const prop = proposalOf(t.dayTypeId); const sel = chosen[t.dayTypeId];
        return <div key={t.dayTypeId} className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={sel !== undefined}
            onChange={(e) => { const n = { ...chosen }; if (e.target.checked) n[t.dayTypeId] = ""; else delete n[t.dayTypeId]; setChosen(n); }} />{t.label} ({EFFECT_LABEL(t.schoolDayEffect)})</label>
          {sel !== undefined && <input aria-label={`Papel de conselho para ${t.label}`} className={`${inputCls} max-w-xs`} value={sel} placeholder="Ex.: Conselho de Classe"
            onChange={(e) => setChosen({ ...chosen, [t.dayTypeId]: e.target.value })} />}
          {prop && <span className="text-muted-foreground">Proposta da fonte: “{prop}”{sel === undefined ? " (não aplicada)" : ""}
            {sel === "" && <Button type="button" size="sm" variant="ghost" onClick={() => setChosen({ ...chosen, [t.dayTypeId]: prop })}>Usar proposta</Button>}</span>}
        </div>; })}
      <Field label="Referência documental/fonte (opcional)"><input className={inputCls} value={act} onChange={(e) => setAct(e.target.value)} /></Field>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={w.busy} onClick={() => void submit(false)}>Declarar papéis de conselho</Button>
        <Button type="button" size="sm" variant="outline" disabled={w.busy} onClick={() => void submit(true)}>Declarar que nenhum tipo é conselho</Button>
      </div>
      <Status {...w} />
    </fieldset>
  );
}

// ---------- versão do calendário (edição + importação) ----------
type DayEntry = { typeVersionId: string; label: string | null };
type Source =
  | { kind: "importacao-navegador"; raw: string; entry: NetworkCalendar; plan: ImportPlan; customizations: string[] | null }
  | { kind: "referencia-codigo"; entry: NetworkCalendar; plan: ImportPlan };

function CalendarVersionSection({ contextKey, onDone, canWriteB24 }: { contextKey: string; onDone: () => void; canWriteB24: boolean }) {
  const on = today();
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useQuery({ queryKey: ["b467b-base", contextKey, on, knownAt], retry: false, queryFn: async () => ({
    b24: await loadB24(on), schools: await loadSchoolOptions(on), values: await homologatedValues(null, on),
    list: await readCalendarList({ knownAt }), types: await readDayTypes({ knownAt }) }) });
  const [title, setTitle] = useState("");
  const [basePres, setBasePres] = useState<Record<string, unknown> | null>(null);
  const titles = useQuery({ queryKey: ["b467c-titles", contextKey, on, knownAt, base.data ? 1 : 0], enabled: !!base.data, retry: false, queryFn: async () => {
    const vs = base.data!.list.kind === "lido" ? base.data!.list.versions : [];
    return Promise.all(vs.map(async (v) => { const r = await readPresentation({ versionId: v.versionId, on, knownAt });
      return { calendarId: v.calendarId, academicYearId: v.academicYearId, title: r.kind === "lido" ? presentationTitle(r.snapshot.presentation) : null }; }));
  } });
  const [baseVersion, setBaseVersion] = useState<CalendarVersionSummary | null>(null);
  const [yearId, setYearId] = useState(""); const [orgId, setOrgId] = useState(""); const [periodIds, setPeriodIds] = useState<string[]>([]);
  const [from, setFrom] = useState(""); const [until, setUntil] = useState("");
  const [act, setAct] = useState(OWNER_DECISION_ACT_REF); const [reason, setReason] = useState("");
  const [days, setDays] = useState<Map<string, DayEntry>>(new Map());
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [mapping, setMapping] = useState<Record<string, InstitutionalTypeChoice | undefined>>({});
  const [refNote, setRefNote] = useState("");
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const [browser, setBrowser] = useState<BrowserCalendarRead | null>(null);
  const w = useWrite(onDone);

  if (base.error) return <p role="alert" className="text-sm text-destructive">{errText(base.error)}</p>;
  if (!base.data) return <SkeletonState label="Carregando cadastros para a versão do calendário" />;
  const { b24, schools, values, list } = base.data;
  const types = base.data.types.kind === "lido" ? latestTypes(base.data.types.versions) : [];
  const typeLabel = new Map(types.map((t) => [t.versionId, t]));
  const versions = list.kind === "lido" ? list.versions : [];
  const latestByCal = new Map<string, CalendarVersionSummary>();
  for (const v of versions) { const c = latestByCal.get(v.calendarId); if (!c || v.version > c.version) latestByCal.set(v.calendarId, v); }
  const yearName = new Map(b24.years.map((y) => [y.id, y.name]));

  const loadPrevious = async (v: CalendarVersionSummary) => {
    setBaseVersion(v); setYearId(v.academicYearId); setOrgId(v.periodOrganizationId); setFrom(v.validFrom); setUntil(v.validTo ?? "");
    setLoadMsg("Lendo as declarações da versão anterior…");
    try {
      const pr = await readPresentation({ versionId: v.versionId, on, knownAt });
      if (pr.kind === "lido") { setBasePres(pr.snapshot.presentation); setTitle(presentationTitle(pr.snapshot.presentation) ?? ""); }
      else { setBasePres(null); }
      const end = v.validTo ?? `${v.validFrom.slice(0, 4)}-12-31`;
      const r = await readCalendarDays({ calendarId: v.calendarId, from: v.validFrom, to: end, knownAt });
      if (r.kind !== "lido") { setLoadMsg("Declarações da versão anterior indisponíveis."); return; }
      const m = new Map<string, DayEntry>(); const conflicts: string[] = [];
      for (const d of r.days) {
        const decl = (d.rows ?? []).filter((x) => x.declarationId && x.dayTypeVersionId);
        const ids = new Set(decl.map((x) => x.dayTypeVersionId));
        if (ids.size === 1) m.set(d.on, { typeVersionId: decl[0]!.dayTypeVersionId!, label: decl.find((x) => x.eventLabel)?.eventLabel ?? null });
        else if (ids.size > 1) conflicts.push(d.on);
      }
      setDays(m);
      setLoadMsg(conflicts.length ? `Declarações carregadas. ${conflicts.length} data(s) com tipos diferentes na versão anterior ficaram sem declaração para você decidir: ${conflicts.slice(0, 10).join(", ")}${conflicts.length > 10 ? "…" : ""}.` : "Declarações da versão anterior carregadas para edição.");
    } catch (e) { setLoadMsg(errText(e)); }
  };

  const doImportRead = () => {
    let r: BrowserCalendarRead;
    try { r = readBrowserCalendarsOnRequest((k) => window.localStorage.getItem(k)); }
    catch (e) { r = { state: "erro-leitura", reason: e instanceof Error ? e.message : "armazenamento inacessível" }; }
    setBrowser(r);
  };
  const chooseEntry = (entry: NetworkCalendar, kind: "importacao-navegador" | "referencia-codigo", raw?: string) => {
    const plan = buildImportPlan(entry);
    setSource(kind === "importacao-navegador" ? { kind, raw: raw!, entry, plan, customizations: customizationsAgainstReference(entry) } : { kind, entry, plan });
    setMapping({});
    if (!title) setTitle(entry.title);
    if (!from && plan.firstDay) setFrom(plan.firstDay);
    if (!until && plan.lastDay) setUntil(plan.lastDay);
  };
  const applyImport = () => {
    if (!source) return;
    const res = buildDaysPayload(source.plan, mapping, from && until ? { from, to: until } : undefined);
    if (!res.ok) { setLoadMsg(res.problems.join(" ")); return; }
    const labels = new Map(source.plan.days.map((d) => [d.day, d.label]));
    setDays(new Map(res.days.map((d) => [d.day, { typeVersionId: d.day_type_version_id, label: labels.get(d.day) ?? null }])));
    setLoadMsg(`${res.days.length} datas convertidas em declarações explícitas. Revise antes de registrar.`);
  };

  const orgsOfYear = b24.orgs.filter((o) => o.yearId === yearId);
  const periodsOfOrg = b24.periods.filter((p) => p.orgId === orgId);
  const submit = () => w.run(async () => {
    if (!yearId || !orgId) throw new CalendarWriteRefused("form:ano-organizacao");
    if (!from) throw new CalendarWriteRefused("calendar:valid-from-required");
    if (scopes.length === 0) throw new CalendarWriteRefused("calendar-applicability:scopes-required");
    if (source?.kind === "referencia-codigo" && !refNote.trim()) throw new CalendarWriteRefused("form:referencia-sem-declaracao");
    if (!title.trim()) throw new CalendarWriteRefused("form:titulo-obrigatorio");
    if (!titles.data) throw new CalendarWriteRefused("form:titulos-nao-lidos");
    if (titleCollision(title, yearId, baseVersion?.calendarId ?? null, titles.data)) throw new CalendarWriteRefused("form:titulo-repetido");
    const winUntil = until || `${from.slice(0, 4)}-12-31`;
    const scopeInputs: ScopeInput[] = scopes.map((s, i) => {
      const conds: ScopeInput["conditions"] = [];
      if (s.schoolId) conds.push({ kind: "escola", school_id: s.schoolId });
      if (s.valueKey) { const v = values.find((x) => `${x.schemeId}|${x.valueId}|${x.version}` === s.valueKey)!;
        conds.push({ kind: "valor-de-eixo", scheme_id: v.schemeId, value_id: v.valueId, value_version: v.version }); }
      if (s.allocationId) conds.push({ kind: "alocacao", allocation_logical_id: s.allocationId });
      if (s.positionId) conds.push({ kind: "posicao-curricular", position_logical_id: s.positionId });
      return { scopeKey: `recorte-${i + 1}`, label: s.label, windowFrom: from, windowUntil: winUntil, conditions: conds };
    });
    const dayList = [...days].filter(([d]) => d >= from && (!until || d <= until)).sort(([a], [b]) => a.localeCompare(b))
      .map(([day, e]) => ({ day, day_type_version_id: e.typeVersionId }));
    const r = await recordCalendarVersion({ calendarId: baseVersion?.calendarId ?? null, baseVersionId: baseVersion?.versionId ?? null,
      academicYearId: yearId, periodOrganizationId: orgId, validFrom: from, validUntil: until || null, actRef: act, reason,
      periodIds, days: dayList, scopes: scopeInputs,
      events: [...days].filter(([d, e]) => e.label && d >= from && (!until || d <= until)).map(([d, e]) => ({ starts_on: d, ends_on: d, label: e.label!, day_type_version_id: e.typeVersionId })) });
    const versionId = String((r as Record<string, unknown>)["version_id"] ?? "");
    const typeMap: Record<string, string> = {};
    if (source) for (const [code, m] of Object.entries(mapping)) if (m) typeMap[m.versionId] = code;
    const presentation = composePresentation({ base: source ? source.plan.presentation : basePres, title, typeMap, baseVersionId: baseVersion?.versionId ?? null });
    const pk: PendingPresentation = source
      ? { versionId, sourceKind: source.kind, sourceKey: source.kind === "importacao-navegador" ? BROWSER_CALENDAR_KEY : null, sourceEntryId: source.entry.id,
          digest: await sha256Hex(source.kind === "importacao-navegador" ? source.raw : JSON.stringify(source.entry)),
          raw: source.kind === "importacao-navegador" ? source.entry : null, presentation, note: source.kind === "referencia-codigo" ? refNote : null, lastError: "" }
      : { versionId, sourceKind: "edicao-institucional", sourceKey: null, sourceEntryId: null, digest: await sha256Hex(JSON.stringify(presentation)),
          raw: null, presentation, note: null, lastError: "" };
    try {
      await recordPresentationSnapshot({ versionId, sourceKind: pk.sourceKind, sourceKey: pk.sourceKey, sourceEntryId: pk.sourceEntryId,
        digest: pk.digest, raw: pk.raw, presentation: pk.presentation, note: pk.note });
    } catch (e) {
      pendingPresentation.put({ ...pk, lastError: errText(e) });
      throw new CalendarWriteRefused(`A versão foi registrada, mas a apresentação NÃO foi anexada: ${errText(e)} Use "Tentar anexar de novo" na lista de versões; nenhuma nova versão será criada.`);
    }
    if (!source) return basePres ? "Nova versão registrada, com a apresentação da versão anterior preservada (ainda não homologada)." : "Versão registrada com apresentação institucional (ainda não homologada).";
    return source.kind === "importacao-navegador" ? "Versão registrada a partir do calendário salvo neste navegador, com original e apresentação preservados. O registro do navegador não foi alterado."
      : "Versão registrada a partir da REFERÊNCIA do sistema (não do salvo no navegador), com a sua declaração anexada.";
  });

  const typeOptions = types.filter((t) => t.schoolDayEffect !== undefined);
  const sortedDays = [...days].sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="space-y-3">
      <h3 className="font-medium">Registrar versão do calendário</h3>
      {latestByCal.size > 0 && (
        <Field label="Partir de uma versão existente (nova versão com base esperada)">
          <select className={inputCls} value={baseVersion?.versionId ?? ""} onChange={(e) => { const v = [...latestByCal.values()].find((x) => x.versionId === e.target.value); if (v) void loadPrevious(v); else setBaseVersion(null); }}>
            <option value="">Novo calendário</option>
            {[...latestByCal.values()].map((v) => <option key={v.versionId} value={v.versionId}>{titles.data?.find((t) => t.calendarId === v.calendarId)?.title ?? "Sem título"} — ano letivo {yearName.get(v.academicYearId) ?? "sem nome"} — versão {v.version}</option>)}
          </select>
        </Field>
      )}

      <div className="space-y-2 rounded border border-border p-3">
        <p className="text-sm font-medium">Importar calendário 2027 registrado neste navegador</p>
        <p className="text-xs text-muted-foreground">A leitura só acontece quando você clica. O registro do navegador nunca é alterado.</p>
        <Button type="button" variant="outline" onClick={doImportRead}>Ler calendários deste navegador</Button>
        {browser?.state === "erro-leitura" && <p role="alert" className="text-sm text-destructive">O navegador recusou a leitura do registro. Isso não significa que não há calendário salvo; nada foi importado e a referência não é oferecida.</p>}
        {browser?.state === "ilegivel" && <div role="alert" className="text-sm text-destructive"><p>O registro do navegador está em formato inesperado ({browser.reason}). Nada foi importado e o registro não foi alterado.</p>
          <details><summary>Conteúdo bruto preservado ({browser.raw.length} caracteres)</summary><pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{browser.raw.slice(0, 4000)}</pre></details></div>}
        {browser?.state === "ausente" && (
          <div role="note" className="space-y-1 text-sm">
            <p>Não há calendário salvo neste navegador. Abaixo está a <strong>REFERÊNCIA 2027 do sistema</strong> — ela não é o calendário salvo e pode não conter as suas personalizações.</p>
            {referenceCalendars2027().map((c) => <Button key={c.id} type="button" size="sm" variant="ghost" onClick={() => chooseEntry(c, "referencia-codigo")}>Usar referência: {c.title}</Button>)}
          </div>
        )}
        {browser?.state === "lido" && (
          <ul className="space-y-1 text-sm">{browser.entries.map((c) => {
            const cz = customizationsAgainstReference(c);
            return <li key={c.id}><Button type="button" size="sm" variant="ghost" onClick={() => chooseEntry(c, "importacao-navegador", browser.raw)}>
              {c.title} ({c.year}) — {cz === null ? "sem referência correspondente" : cz.length ? `personalizado: ${cz.join(", ")}` : "igual à referência"}</Button></li>;
          })}</ul>
        )}
        {source && (
          <div className="space-y-2">
            <p className="text-sm">{source.kind === "importacao-navegador" ? "Prévia do calendário salvo neste navegador" : "Prévia da REFERÊNCIA do sistema"}: {source.plan.title} — {source.plan.days.length} datas resolvidas{source.plan.firstDay ? ` de ${source.plan.firstDay} a ${source.plan.lastDay}` : ""}.</p>
            <p className="text-xs text-muted-foreground">Escolha para cada tipo da fonte o tipo institucional com o MESMO efeito. Datas que a fonte não resolveu ficam sem declaração.</p>
            <table className="w-full text-sm"><thead><tr className="text-left"><th scope="col">Tipo na fonte</th><th scope="col">Efeito na fonte</th><th scope="col">Datas</th><th scope="col">Tipo institucional</th></tr></thead>
              <tbody>{source.plan.types.map((t) => (
                <tr key={t.code} className="border-t border-border"><td>{t.label}{t.councilRole ? ` (papel de conselho na fonte: ${t.councilRole} — proposta; declare-o em "Papéis de conselho" da versão)` : ""}</td><td>{EFFECT_LABEL(t.countsAsSchoolDay)}</td><td>{t.days}</td>
                  <td><select aria-label={`Tipo institucional para ${t.label}`} className={inputCls} value={mapping[t.code]?.versionId ?? ""}
                    onChange={(e) => { const x = typeLabel.get(e.target.value); setMapping({ ...mapping, [t.code]: x ? { versionId: x.versionId, schoolDayEffect: x.schoolDayEffect } : undefined }); }}>
                    <option value="">— escolher —</option>
                    {typeOptions.filter((x) => x.schoolDayEffect === t.countsAsSchoolDay).map((x) => <option key={x.versionId} value={x.versionId}>{x.label}</option>)}
                  </select>
                  {typeOptions.every((x) => x.schoolDayEffect !== t.countsAsSchoolDay) && <span className="text-xs text-muted-foreground">Nenhum tipo institucional com este efeito; registre um em "Tipos de dia".</span>}</td></tr>))}</tbody></table>
            {source.kind === "referencia-codigo" && (
              <Field label="Declaração obrigatória sobre o uso da referência"><input className={inputCls} value={refNote} onChange={(e) => setRefNote(e.target.value)}
                placeholder="Ex.: Calendário aprovado corresponde à referência, conferido em …" /></Field>)}
            <AcademicStructureAssistant entry={source.entry} canWrite={canWriteB24} years={b24.years}
              onCreated={(r) => { void base.refetch().then(() => { setYearId(r.yearId); setOrgId(r.orgId); setPeriodIds(r.periodIds); }); }} />
            <Button type="button" onClick={applyImport}>Converter em declarações</Button>
          </div>
        )}
      </div>

      <Field label="Título do calendário (distinto por ano, ex.: Calendário Regular 2027 / Calendário EJA 2027)">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Ano letivo"><select className={inputCls} value={yearId} onChange={(e) => { setYearId(e.target.value); setOrgId(""); setPeriodIds([]); }}>
          <option value="">— escolher —</option>{b24.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
        <Field label="Organização de períodos"><select className={inputCls} value={orgId} onChange={(e) => { setOrgId(e.target.value); setPeriodIds([]); }}>
          <option value="">— escolher —</option>{orgsOfYear.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Vigência a partir de"><DateInput className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Vigência até"><DateInput className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
      </div>
      {orgId && (periodsOfOrg.length === 0 ? <p className="text-sm text-muted-foreground">Esta organização não tem períodos ativos cadastrados.</p> : (
        <fieldset className="text-sm"><legend className="font-medium">Períodos incluídos</legend>
          {periodsOfOrg.map((p) => <label key={p.id} className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={periodIds.includes(p.id)}
            onChange={(e) => setPeriodIds(e.target.checked ? [...periodIds, p.id] : periodIds.filter((x) => x !== p.id))} />{p.name} ({p.startsOn} a {p.endsOn})</label>)}
        </fieldset>))}

      <ScopesEditor scopes={scopes} setScopes={setScopes} schools={schools} values={values} yearId={yearId} on={from || on} knownAt={knownAt} />
      <DaysEditor days={sortedDays} types={typeOptions} onSet={(f, t, typeId, label) => {
        const m = new Map(days); for (let d = f; d <= t; d = nextDay(d)) { if (typeId) m.set(d, { typeVersionId: typeId, label: label || null }); else m.delete(d); } setDays(m);
      }} typeLabel={typeLabel} />
      {loadMsg && <p role="status" className="text-sm">{loadMsg}</p>}
      <ActReason act={act} setAct={setAct} reason={reason} setReason={setReason} reasonRequired={!!baseVersion} />
      <Button type="button" disabled={w.busy} onClick={() => void submit()}>Registrar versão do calendário</Button>
      <Status {...w} />
    </div>
  );
}

const nextDay = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

type ScopeRow = { label: string; schoolId: string; valueKey: string; classId: string; allocationId: string; positionId: string; who: string };
const emptyScope = (): ScopeRow => ({ label: "", schoolId: "", valueKey: "", classId: "", allocationId: "", positionId: "", who: "" });

/** Pessoas da turma por alocação canônica (nomes humanos); posição B3.3 só se registrada. IDs ficam fora da tela. */
async function loadClassPeople(schoolId: string, classId: string, on: string, knownAt: string) {
  const a = await supabase.rpc("class_allocations_at" as never, { _school: schoolId, _class: classId, _valid_on: on, _known_at: knownAt } as never);
  if (a.error) throw a.error;
  const rows = (a.data ?? []) as { logical_id: string; student_id: string }[];
  const ids = rows.map((r) => r.student_id);
  const names = ids.length ? await supabase.from("institutional_students").select("id, display_name").in("id", ids) : { data: [], error: null };
  if (names.error) throw names.error;
  const pos = await supabase.rpc("allocation_curricular_positions_at" as never, { _school: schoolId, _class: classId, _valid_on: on, _known_at: knownAt } as never);
  if (pos.error) throw pos.error;
  const posRows = (pos.data ?? []) as { allocation_logical_id: string; position_logical_id: string | null }[];
  const nm = new Map((names.data ?? []).map((n) => [n.id, n.display_name as string]));
  return rows.map((r) => { const alloc = r.logical_id;
    return { allocationId: alloc, name: nm.get(r.student_id) ?? "Estudante sem nome registrado", positionId: posRows.find((p) => p.allocation_logical_id === alloc)?.position_logical_id ?? null }; })
    .filter((x) => x.allocationId).sort((x, y) => x.name.localeCompare(y.name));
}

function IndividualPicker({ row, onChange, on, knownAt, yearId }: { row: ScopeRow; onChange: (r: ScopeRow) => void; on: string; knownAt: string; yearId: string }) {
  const classes = useQuery({ queryKey: ["b467c-scope-classes", row.schoolId, yearId, on], enabled: !!row.schoolId && !!yearId, retry: false, queryFn: async () => {
    const r = await supabase.from("institutional_classes").select("id, school_id, academic_year_id").eq("school_id", row.schoolId).eq("academic_year_id", yearId);
    if (r.error) throw r.error;
    const names = await classNamesAt(supabase, (r.data ?? []).map((c) => c.id), { validOn: on, knownAt });
    if ([...names.values()].some((o) => o.kind === "erro")) throw new Error("class_at: leitura recusada");
    return (r.data ?? []).flatMap((c) => { const o = names.get(c.id); return o?.kind === "ok" ? [{ id: c.id, name: o.name }] : []; });
  } });
  const people = useQuery({ queryKey: ["b467c-scope-people", row.schoolId, row.classId, on, knownAt], enabled: !!row.classId, retry: false,
    queryFn: () => loadClassPeople(row.schoolId, row.classId, on, knownAt) });
  if (!row.schoolId) return <span className="text-xs text-muted-foreground">Escolha a escola para declarar um estudante.</span>;
  if (!yearId) return <span className="text-xs text-muted-foreground">Escolha o ano letivo.</span>;
  return (
    <div className="grid gap-2 sm:col-span-4 sm:grid-cols-3">
      <select aria-label="Turma" className={inputCls} value={row.classId} onChange={(e) => onChange({ ...row, classId: e.target.value, allocationId: "", positionId: "", who: "" })}>
        <option value="">Turma (opcional, para recorte individual)</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      {row.classId && (people.error ? <span role="alert" className="text-xs text-destructive">{errText(people.error)}</span> : (
        <select aria-label="Estudante (alocação)" className={inputCls} value={row.allocationId}
          onChange={(e) => { const p = people.data?.find((x) => x.allocationId === e.target.value); onChange({ ...row, allocationId: e.target.value, positionId: "", who: p?.name ?? "" }); }}>
          <option value="">Estudante (alocação na turma)</option>{people.data?.map((p) => <option key={p.allocationId} value={p.allocationId}>{p.name}</option>)}</select>))}
      {row.allocationId && (() => { const p = people.data?.find((x) => x.allocationId === row.allocationId);
        return p?.positionId ? <label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={!!row.positionId}
          onChange={(e) => onChange({ ...row, positionId: e.target.checked ? p.positionId! : "" })} />Exigir também a posição curricular registrada deste estudante</label>
          : <span className="text-xs text-muted-foreground">Sem posição curricular registrada; nenhuma é presumida.</span>; })()}
    </div>
  );
}

function ScopesEditor({ scopes, setScopes, schools, values, yearId, on, knownAt }: {
  scopes: ScopeRow[]; setScopes: (s: ScopeRow[]) => void; yearId: string; on: string; knownAt: string;
  schools: { id: string; name: string }[]; values: { schemeId: string; valueId: string; version: number; label: string }[];
}) {
  const set = (i: number, r: ScopeRow) => setScopes(scopes.map((x, j) => j === i ? r : x));
  return (
    <fieldset className="space-y-2 text-sm"><legend className="font-medium">Aplicabilidade (a quem este calendário se aplica)</legend>
      <p className="text-xs text-muted-foreground">Cada recorte declara escola, valor homologado (ex.: oferta Regular ou EJA) e, se preciso, um estudante pela sua alocação e posição. Nada é associado automaticamente; AEE só existe se você o declarar.</p>
      {values.length === 0 && <p className="text-xs text-muted-foreground">Não há valores de catálogo homologados; recortes por oferta exigem catálogo na <Link to="/administracao" className="underline">Administração</Link>.</p>}
      {scopes.map((s, i) => (
        <div key={i} className="grid gap-2 rounded border border-border p-2 sm:grid-cols-4">
          <input aria-label="Nome do recorte" className={inputCls} value={s.label} placeholder="Nome do recorte" onChange={(e) => set(i, { ...s, label: e.target.value })} />
          <select aria-label="Escola" className={inputCls} value={s.schoolId} onChange={(e) => set(i, { ...s, schoolId: e.target.value, classId: "", allocationId: "", positionId: "", who: "" })}>
            <option value="">Qualquer escola</option>{schools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select aria-label="Valor homologado" className={inputCls} value={s.valueKey} onChange={(e) => set(i, { ...s, valueKey: e.target.value })}>
            <option value="">Sem condição de catálogo</option>{values.map((v) => <option key={`${v.schemeId}|${v.valueId}|${v.version}`} value={`${v.schemeId}|${v.valueId}|${v.version}`}>{v.label}</option>)}</select>
          <Button type="button" variant="ghost" size="sm" onClick={() => setScopes(scopes.filter((_, j) => j !== i))}>Remover</Button>
          <IndividualPicker row={s} onChange={(r) => set(i, r)} on={on} knownAt={knownAt} yearId={yearId} />
          {s.who && <p className="text-xs sm:col-span-4">Recorte individual: {s.who}{s.positionId ? " (com a posição registrada)" : ""}.</p>}
        </div>))}
      <Button type="button" variant="outline" size="sm" onClick={() => setScopes([...scopes, emptyScope()])}>Adicionar recorte</Button>
    </fieldset>
  );
}

function DaysEditor({ days, types, onSet, typeLabel }: {
  days: [string, DayEntry][]; types: DayTypeVersion[]; typeLabel: Map<string, DayTypeVersion>;
  onSet: (from: string, to: string, typeId: string, label: string) => void;
}) {
  const [f, setF] = useState(""); const [t, setT] = useState(""); const [ty, setTy] = useState(""); const [lb, setLb] = useState("");
  return (
    <fieldset className="space-y-2 text-sm"><legend className="font-medium">Declarações por data ({days.length})</legend>
      <p className="text-xs text-muted-foreground">Cada data recebe uma única declaração explícita. Datas sem declaração ficam sem efeito declarado — nunca contam como letivas nem não letivas.</p>
      <div className="grid gap-2 sm:grid-cols-5">
        <DateInput aria-label="De" className={inputCls} value={f} onChange={(e) => setF(e.target.value)} />
        <DateInput aria-label="Até" className={inputCls} value={t} onChange={(e) => setT(e.target.value)} />
        <select aria-label="Tipo de dia" className={inputCls} value={ty} onChange={(e) => setTy(e.target.value)}>
          <option value="">Remover declaração</option>{types.map((x) => <option key={x.versionId} value={x.versionId}>{x.label} — {EFFECT_LABEL(x.schoolDayEffect)}</option>)}</select>
        <input aria-label="Descrição (opcional)" className={inputCls} value={lb} placeholder="Descrição (opcional)" onChange={(e) => setLb(e.target.value)} />
        <Button type="button" size="sm" disabled={!f || (!!t && t < f)} onClick={() => onSet(f, t || f, ty, lb)}>Aplicar às datas</Button>
      </div>
      {days.length > 0 && (
        <details><summary>Ver declarações</summary>
          <ul className="max-h-64 overflow-auto">{days.map(([d, e]) => <li key={d}>{d}: {typeLabel.get(e.typeVersionId)?.label ?? "tipo não encontrado na leitura atual"}{e.label ? ` — ${e.label}` : ""}</li>)}</ul>
        </details>)}
    </fieldset>
  );
}

/**
 * CAL.EXT.1.2 — Ponte do fluxo principal ("Abrir" na lista) para os modelos de apresentação. Lê a versão
 * institucional do MESMO calendário (`institutionalCalendarId` vem do vínculo central já existente, nunca
 * inferido), prefere a homologada e reaproveita PrintVersion/ExternalPresentationPanel. Nada é gravado aqui;
 * personalizar só aparece com `canEdit` e o banco revalida a autoridade.
 */
export function CalendarPresentationAccess({ contextKey, institutionalCalendarId, preferredVersionId, canEdit }: {
  contextKey: string; institutionalCalendarId: string; preferredVersionId: string | null; canEdit: boolean;
}) {
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = today();
  const q = useQuery({ queryKey: ["calext12-presentation", contextKey, institutionalCalendarId, preferredVersionId, knownAt], retry: false, queryFn: async () => {
    const list = await readCalendarList({ knownAt });
    if (list.kind !== "lido") return { state: "indisponivel" as const };
    const mine = list.versions.filter((v) => v.calendarId === institutionalCalendarId);
    const v = mine.find((x) => x.versionId === preferredVersionId) ?? [...mine].sort((a, b) => b.version - a.version)[0];
    if (!v) return { state: "sem-versao" as const };
    const pr = await readPresentation({ versionId: v.versionId, on, knownAt });
    // Lote 3: períodos da versão são lidos na própria vigência dela (ano futuro: hoje < início ⇒ lista vazia na folha).
    return { state: "ok" as const, v, pr, b24: await loadB24(v.validFrom > on ? v.validFrom : on) };
  } });
  if (q.error) return <p role="alert" className="text-xs text-destructive">{errText(q.error)}</p>;
  if (!q.data) return <p role="status" className="text-xs text-muted-foreground">Lendo a versão institucional…</p>;
  if (q.data.state === "indisponivel") return <p className="text-xs text-muted-foreground">Versões institucionais indisponíveis para a sua conta.</p>;
  if (q.data.state === "sem-versao") return <p role="note" className="text-xs text-muted-foreground">Este calendário ainda não tem versão salva no banco; salve-o para visualizar os modelos.</p>;
  const { v, pr, b24 } = q.data;
  if (pr.kind !== "lido") return <PresentationState read={pr} />;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Versão {v.version}{v.lastHomologation?.decision === "homologada" ? " (homologada)" : " (não homologada)"} — conteúdo lido do banco; o modelo escolhido muda só a aparência.</p>
      <PrintVersion version={v} presentation={pr.snapshot.presentation} knownAt={knownAt} autoLoad canEdit={canEdit}
        periods={b24.periods.filter((p) => p.orgId === v.periodOrganizationId)} />
    </div>
  );
}
