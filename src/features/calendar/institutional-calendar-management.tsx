/**
 * B4.6.7b — Gestão institucional do calendário (Supervisão): tipos de dia, norma exclusiva, versões do calendário,
 * homologação/revogação e importação explícita do navegador.
 *
 * - Cada seção só aparece com a capacidade EXATA na sessão; o banco revalida tudo (a tela nunca é garantia).
 * - Toda gravação leva base esperada (última versão/decisão lida neste knownAt), ato e motivo.
 * - Seletores mostram rótulos humanos; IDs técnicos só no bloco "Auditoria".
 * - Ausência de ano/organização/períodos/escolas/valores homologados orienta a Administração; nada é inventado.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { captureCalendarKnownAt } from "./institutional-calendar-source";
import { readCalendarDays, readCalendarList, readDayTypes, readNorm, type CalendarVersionSummary, type DayTypeVersion } from "./institutional-calendar-readers";
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

export const CAP = {
  build: "construir-calendario-da-rede", homologate: "homologar-calendario-da-rede",
  normBuild: "construir-norma-composicao-calendario-da-rede", normHomologate: "homologar-norma-composicao-calendario-da-rede",
} as const;

const today = () => new Date().toISOString().slice(0, 10);
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
      {has(CAP.build) && <CalendarVersionSection key={`c${tick}`} contextKey={contextKey} onDone={refresh} />}
      {has(CAP.homologate) && <CalendarDecisionSection key={`d${tick}`} contextKey={contextKey} knownAt={knownAt} onDone={refresh} />}
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
  if (q.data.schools.length === 0) missing.push("unidades escolares ativas");
  if (missing.length === 0) return null;
  return (
    <div role="note" className="rounded border border-border bg-muted p-3 text-sm">
      Para registrar uma versão do calendário ainda falta cadastrar: {missing.join(", ")}. Esses cadastros pertencem à{" "}
      <Link to="/administracao" className="underline">Administração</Link>; nada é criado automaticamente aqui.
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
      <Field label="Ato que fundamenta"><input className={inputCls} value={act} onChange={(e) => setAct(e.target.value)} placeholder="Ex.: Portaria nº …" /></Field>
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
  const [act, setAct] = useState(""); const [reason, setReason] = useState("");
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
  const [act, setAct] = useState(""); const [reason, setReason] = useState("");
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
            <Field label="Vigência a partir de"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Vigência até (opcional)"><input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
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
  const [act, setAct] = useState(""); const [reason, setReason] = useState("");
  const w = useWrite(onDone);
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault();
      void w.run(async () => { await onSubmit({ decision, effectiveFrom: eff, actRef: act, reason }); return decision === "homologada" ? `Homologação da ${kind} registrada.` : `Revogação da ${kind} registrada.`; }); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Decisão"><select className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value as Decision)}>
          <option value="homologada">Homologar</option><option value="revogada">Revogar</option></select></Field>
        <Field label="Com efeito a partir de"><input type="date" className={inputCls} value={eff} onChange={(e) => setEff(e.target.value)} /></Field>
      </div>
      <ActReason act={act} setAct={setAct} reason={reason} setReason={setReason} reasonRequired={decision === "revogada" || hasPrior} />
      <Button type="submit" size="sm" disabled={w.busy}>Registrar decisão</Button>
      <Status {...w} />
    </form>
  );
}

// ---------- decisões sobre versões do calendário ----------
function CalendarDecisionSection({ contextKey, knownAt, onDone }: { contextKey: string; knownAt: string; onDone: () => void }) {
  const q = useQuery({ queryKey: ["b467b-decide-list", contextKey, knownAt], retry: false, queryFn: () => readCalendarList({ knownAt }) });
  const versions = q.data?.kind === "lido" ? q.data.versions : [];
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Homologar ou revogar versões do calendário</h3>
      {q.error && <p role="alert" className="text-sm text-destructive">{errText(q.error)}</p>}
      {q.data?.kind === "lido" && versions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>}
      <ul className="space-y-2 text-sm">{versions.map((v) => (
        <li key={v.versionId} className="rounded border border-border p-2">
          Versão {v.version} — vigência {v.validFrom}{v.validTo ? ` a ${v.validTo}` : ""} —{" "}
          {v.lastHomologation ? `${v.lastHomologation.decision} desde ${v.lastHomologation.effectiveFrom}` : "sem decisão"}
          <DecisionForm kind="versão do calendário" hasPrior={!!v.lastHomologation} onDone={onDone}
            onSubmit={(d) => decideCalendar({ versionId: v.versionId, expectedLastId: v.lastHomologation?.recordId ?? null, ...d })} />
          <Audit rows={[["Calendário", v.calendarId], ["Versão", v.versionId], ["Última decisão", v.lastHomologation?.recordId ?? null]]} />
        </li>))}</ul>
    </div>
  );
}

// ---------- versão do calendário (edição + importação) ----------
type DayEntry = { typeVersionId: string; label: string | null };
type Source =
  | { kind: "importacao-navegador"; raw: string; entry: NetworkCalendar; plan: ImportPlan; customizations: string[] | null }
  | { kind: "referencia-codigo"; entry: NetworkCalendar; plan: ImportPlan };

function CalendarVersionSection({ contextKey, onDone }: { contextKey: string; onDone: () => void }) {
  const on = today();
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useQuery({ queryKey: ["b467b-base", contextKey, on, knownAt], retry: false, queryFn: async () => ({
    b24: await loadB24(on), schools: await loadSchoolOptions(on), values: await homologatedValues(null, on),
    list: await readCalendarList({ knownAt }), types: await readDayTypes({ knownAt }) }) });
  const [baseVersion, setBaseVersion] = useState<CalendarVersionSummary | null>(null);
  const [yearId, setYearId] = useState(""); const [orgId, setOrgId] = useState(""); const [periodIds, setPeriodIds] = useState<string[]>([]);
  const [from, setFrom] = useState(""); const [until, setUntil] = useState("");
  const [act, setAct] = useState(""); const [reason, setReason] = useState("");
  const [days, setDays] = useState<Map<string, DayEntry>>(new Map());
  const [scopes, setScopes] = useState<{ label: string; schoolId: string; valueKey: string }[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [mapping, setMapping] = useState<Record<string, InstitutionalTypeChoice | undefined>>({});
  const [refNote, setRefNote] = useState("");
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const w = useWrite(onDone);

  if (base.error) return <p role="alert" className="text-sm text-destructive">{errText(base.error)}</p>;
  if (!base.data) return <p role="status" className="text-sm text-muted-foreground">Carregando cadastros para a versão do calendário…</p>;
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
    const r: BrowserCalendarRead = readBrowserCalendarsOnRequest((k) => window.localStorage.getItem(k));
    setBrowser(r);
  };
  const [browser, setBrowser] = useState<BrowserCalendarRead | null>(null);
  const chooseEntry = (entry: NetworkCalendar, kind: "importacao-navegador" | "referencia-codigo", raw?: string) => {
    const plan = buildImportPlan(entry);
    setSource(kind === "importacao-navegador" ? { kind, raw: raw!, entry, plan, customizations: customizationsAgainstReference(entry) } : { kind, entry, plan });
    setMapping({});
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
    const winUntil = until || `${from.slice(0, 4)}-12-31`;
    const scopeInputs: ScopeInput[] = scopes.map((s, i) => {
      const conds: ScopeInput["conditions"] = [];
      if (s.schoolId) conds.push({ kind: "escola", school_id: s.schoolId });
      if (s.valueKey) { const v = values.find((x) => `${x.schemeId}|${x.valueId}|${x.version}` === s.valueKey)!;
        conds.push({ kind: "valor-de-eixo", scheme_id: v.schemeId, value_id: v.valueId, value_version: v.version }); }
      return { scopeKey: `recorte-${i + 1}`, label: s.label, windowFrom: from, windowUntil: winUntil, conditions: conds };
    });
    const dayList = [...days].filter(([d]) => d >= from && (!until || d <= until)).sort(([a], [b]) => a.localeCompare(b))
      .map(([day, e]) => ({ day, day_type_version_id: e.typeVersionId }));
    const r = await recordCalendarVersion({ calendarId: baseVersion?.calendarId ?? null, baseVersionId: baseVersion?.versionId ?? null,
      academicYearId: yearId, periodOrganizationId: orgId, validFrom: from, validUntil: until || null, actRef: act, reason,
      periodIds, days: dayList, scopes: scopeInputs });
    const versionId = String((r as Record<string, unknown>)["version_id"] ?? "");
    if (!source) return `Versão registrada (ainda não homologada).`;
    const rawEntry = JSON.stringify(source.entry);
    try {
      await recordPresentationSnapshot({ versionId, sourceKind: source.kind, sourceKey: source.kind === "importacao-navegador" ? BROWSER_CALENDAR_KEY : null,
        sourceEntryId: source.entry.id, digest: await sha256Hex(source.kind === "importacao-navegador" ? source.raw : rawEntry),
        raw: source.kind === "importacao-navegador" ? source.entry : null, presentation: source.plan.presentation,
        note: source.kind === "referencia-codigo" ? refNote : null });
    } catch (e) {
      throw new CalendarWriteRefused(`A versão foi registrada, mas a apresentação/origem NÃO foi anexada: ${errText(e)} Anexe-a antes de homologar.`);
    }
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
            {[...latestByCal.values()].map((v) => <option key={v.versionId} value={v.versionId}>Ano letivo {yearName.get(v.academicYearId) ?? "sem nome"} — versão {v.version}</option>)}
          </select>
        </Field>
      )}

      <div className="space-y-2 rounded border border-border p-3">
        <p className="text-sm font-medium">Importar calendário 2027 registrado neste navegador</p>
        <p className="text-xs text-muted-foreground">A leitura só acontece quando você clica. O registro do navegador nunca é alterado.</p>
        <Button type="button" variant="outline" onClick={doImportRead}>Ler calendários deste navegador</Button>
        {browser?.state === "ilegivel" && <p role="alert" className="text-sm text-destructive">O registro do navegador não pôde ser lido ({browser.reason}). Nada foi importado.</p>}
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
            <table className="w-full text-sm"><thead><tr className="text-left"><th>Tipo na fonte</th><th>Efeito na fonte</th><th>Datas</th><th>Tipo institucional</th></tr></thead>
              <tbody>{source.plan.types.map((t) => (
                <tr key={t.code} className="border-t border-border"><td>{t.label}{t.councilRole ? " (conselho)" : ""}</td><td>{EFFECT_LABEL(t.countsAsSchoolDay)}</td><td>{t.days}</td>
                  <td><select aria-label={`Tipo institucional para ${t.label}`} className={inputCls} value={mapping[t.code]?.versionId ?? ""}
                    onChange={(e) => { const x = typeLabel.get(e.target.value); setMapping({ ...mapping, [t.code]: x ? { versionId: x.versionId, schoolDayEffect: x.schoolDayEffect } : undefined }); }}>
                    <option value="">— escolher —</option>
                    {typeOptions.filter((x) => x.schoolDayEffect === t.countsAsSchoolDay).map((x) => <option key={x.versionId} value={x.versionId}>{x.label}</option>)}
                  </select>
                  {typeOptions.every((x) => x.schoolDayEffect !== t.countsAsSchoolDay) && <span className="text-xs text-muted-foreground">Nenhum tipo institucional com este efeito; registre um em "Tipos de dia".</span>}</td></tr>))}</tbody></table>
            {source.kind === "referencia-codigo" && (
              <Field label="Declaração obrigatória sobre o uso da referência"><input className={inputCls} value={refNote} onChange={(e) => setRefNote(e.target.value)}
                placeholder="Ex.: Calendário aprovado corresponde à referência, conferido em …" /></Field>)}
            <Button type="button" onClick={applyImport}>Converter em declarações</Button>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Ano letivo"><select className={inputCls} value={yearId} onChange={(e) => { setYearId(e.target.value); setOrgId(""); setPeriodIds([]); }}>
          <option value="">— escolher —</option>{b24.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></Field>
        <Field label="Organização de períodos"><select className={inputCls} value={orgId} onChange={(e) => { setOrgId(e.target.value); setPeriodIds([]); }}>
          <option value="">— escolher —</option>{orgsOfYear.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <Field label="Vigência a partir de"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Vigência até"><input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
      </div>
      {orgId && (periodsOfOrg.length === 0 ? <p className="text-sm text-muted-foreground">Esta organização não tem períodos ativos cadastrados.</p> : (
        <fieldset className="text-sm"><legend className="font-medium">Períodos incluídos</legend>
          {periodsOfOrg.map((p) => <label key={p.id} className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={periodIds.includes(p.id)}
            onChange={(e) => setPeriodIds(e.target.checked ? [...periodIds, p.id] : periodIds.filter((x) => x !== p.id))} />{p.name} ({p.startsOn} a {p.endsOn})</label>)}
        </fieldset>))}

      <ScopesEditor scopes={scopes} setScopes={setScopes} schools={schools} values={values} />
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

function ScopesEditor({ scopes, setScopes, schools, values }: {
  scopes: { label: string; schoolId: string; valueKey: string }[]; setScopes: (s: { label: string; schoolId: string; valueKey: string }[]) => void;
  schools: { id: string; name: string }[]; values: { schemeId: string; valueId: string; version: number; label: string }[];
}) {
  return (
    <fieldset className="space-y-2 text-sm"><legend className="font-medium">Aplicabilidade (a quem este calendário se aplica)</legend>
      <p className="text-xs text-muted-foreground">Cada recorte declara escola e/ou valor homologado (ex.: oferta Regular ou EJA). Nada é associado automaticamente; recortes de outra oferta (como AEE) só existem se você os declarar.</p>
      {values.length === 0 && <p className="text-xs text-muted-foreground">Não há valores de catálogo homologados; recortes por oferta exigem catálogo na <Link to="/administracao" className="underline">Administração</Link>.</p>}
      {scopes.map((s, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-4">
          <input aria-label="Nome do recorte" className={inputCls} value={s.label} placeholder="Nome do recorte" onChange={(e) => setScopes(scopes.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <select aria-label="Escola" className={inputCls} value={s.schoolId} onChange={(e) => setScopes(scopes.map((x, j) => j === i ? { ...x, schoolId: e.target.value } : x))}>
            <option value="">Qualquer escola</option>{schools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select aria-label="Valor homologado" className={inputCls} value={s.valueKey} onChange={(e) => setScopes(scopes.map((x, j) => j === i ? { ...x, valueKey: e.target.value } : x))}>
            <option value="">Sem condição de catálogo</option>{values.map((v) => <option key={`${v.schemeId}|${v.valueId}|${v.version}`} value={`${v.schemeId}|${v.valueId}|${v.version}`}>{v.label}</option>)}</select>
          <Button type="button" variant="ghost" size="sm" onClick={() => setScopes(scopes.filter((_, j) => j !== i))}>Remover</Button>
        </div>))}
      <Button type="button" variant="outline" size="sm" onClick={() => setScopes([...scopes, { label: "", schoolId: "", valueKey: "" }])}>Adicionar recorte</Button>
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
        <input aria-label="De" type="date" className={inputCls} value={f} onChange={(e) => setF(e.target.value)} />
        <input aria-label="Até" type="date" className={inputCls} value={t} onChange={(e) => setT(e.target.value)} />
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
