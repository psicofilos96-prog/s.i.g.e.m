import { OWNER_DECISION_ACT_REF } from "@/features/calendar/calendar-central";
/**
 * B4.6.7f — Assistente de ativação: prepara ano letivo, organização e períodos oficiais (B2.4) a partir da FONTE
 * escolhida (calendário salvo no navegador ou referência declarada), com prévia editável, e grava SÓ pelos writers
 * donos da B2.4 (`register_academic_year_version` → `register_period_organization_version` →
 * `register_academic_period_version`), que exigem a capacidade própria `manter-anos-e-periodos-letivos`.
 * Nada é gravado sem o clique consciente; nada de escola, catálogo, AEE ou natureza de estudante é inferido.
 * Falha no meio: o que já foi gravado continua gravado (versões próprias) e a nova tentativa pula o que existe.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import type { NetworkCalendar } from "./calendar-types";

export const B24_CAPABILITY = "manter-anos-e-periodos-letivos";

export type StructureProposal = {
  year: { name: string; startsOn: string; endsOn: string };
  organization: { name: string };
  periods: { sourceId: string; name: string; startsOn: string; endsOn: string }[];
  problems: string[];
};

/** Proposta pura a partir da fonte. Datas do ano = limites declarados dos períodos da fonte (nunca inventados). */
export function proposeAcademicStructure(entry: NetworkCalendar): StructureProposal {
  const periods = [...(entry.periods ?? [])].sort((a, b) => a.order - b.order)
    .map((p) => ({ sourceId: p.id, name: p.name, startsOn: p.start, endsOn: p.end }));
  const problems: string[] = [];
  if (periods.length === 0) problems.push("A fonte não declara períodos; cadastre-os na Administração.");
  for (const p of periods) if (!p.startsOn || !p.endsOn || p.startsOn > p.endsOn) problems.push(`Período "${p.name}" tem datas inválidas na fonte.`);
  const sorted = [...periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.startsOn <= sorted[i - 1]!.endsOn) problems.push(`Os períodos "${sorted[i - 1]!.name}" e "${sorted[i]!.name}" se sobrepõem na fonte.`);
  return {
    year: { name: `Ano letivo ${entry.year}`, startsOn: sorted[0]?.startsOn ?? "", endsOn: sorted.map((p) => p.endsOn).sort().at(-1) ?? "" },
    organization: { name: `Períodos — ${entry.title}` },
    periods, problems,
  };
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => supabase.rpc(fn as "calendar_list_at", args as never) as never;

export type StructureProgress = { yearId: string | null; orgId: string | null; periodIds: Record<string, string> };

/** Executa em ordem, pulando o que já foi criado nesta tela. Retorna o progresso mesmo se falhar no meio. */
export async function writeAcademicStructure(p: {
  proposal: StructureProposal; existingYearId: string | null; validFrom: string; actRef: string; reason: string; progress: StructureProgress;
}, rpc: Rpc = defaultRpc): Promise<{ progress: StructureProgress; error: string | null }> {
  const prog: StructureProgress = { ...p.progress, periodIds: { ...p.progress.periodIds } };
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await rpc(fn, args);
    if (error) throw new Error(String(error.message ?? "erro"));
    if (typeof data !== "string" || !data) throw new Error(`${fn}:resposta-inesperada`);
    return data;
  };
  try {
    if (p.proposal.problems.length) throw new Error("form:proposta-com-problemas");
    if (!prog.yearId) prog.yearId = p.existingYearId ?? await call("register_academic_year_version", {
      _year: null, _base_version_id: null, _official_name: p.proposal.year.name, _starts_on: p.proposal.year.startsOn,
      _ends_on: p.proposal.year.endsOn, _is_active: true, _valid_from: p.validFrom, _reason: p.reason, _act_ref: p.actRef });
    if (!prog.orgId) prog.orgId = await call("register_period_organization_version", {
      _organization: null, _year: prog.yearId, _base_version_id: null, _official_name: p.proposal.organization.name,
      _is_active: true, _valid_from: p.validFrom, _reason: p.reason, _act_ref: p.actRef });
    for (const per of p.proposal.periods) {
      if (prog.periodIds[per.sourceId]) continue;
      prog.periodIds[per.sourceId] = await call("register_academic_period_version", {
        _period: null, _organization: prog.orgId, _base_version_id: null, _official_name: per.name, _starts_on: per.startsOn,
        _ends_on: per.endsOn, _is_active: true, _valid_from: p.validFrom, _reason: p.reason, _act_ref: p.actRef });
    }
    return { progress: prog, error: null };
  } catch (e) {
    return { progress: prog, error: e instanceof Error ? e.message : "falha" };
  }
}

const inputCls = "w-full rounded border border-input bg-background px-2 py-1 text-sm";
const ERR: Record<string, string> = {
  "form:act-required": "Informe o ato que fundamenta o cadastro.",
  "form:proposta-com-problemas": "Corrija os problemas da prévia antes de gravar.",
};
const human = (m: string) => ERR[m] ?? (m.includes("capability") || m.includes("engagement") ? "Sua atuação vigente não tem a capacidade de manter anos e períodos letivos." : `O banco recusou (${m}).`);

export function AcademicStructureAssistant({ entry, canWrite, years, onCreated }: {
  entry: NetworkCalendar; canWrite: boolean; years: { id: string; name: string }[];
  onCreated: (r: { yearId: string; orgId: string; periodIds: string[] }) => void;
}) {
  const [proposal, setProposal] = useState(() => proposeAcademicStructure(entry));
  const [existingYear, setExistingYear] = useState("");
  const [act, setAct] = useState(OWNER_DECISION_ACT_REF); const [reason, setReason] = useState("");
  const [validFrom, setValidFrom] = useState(proposal.year.startsOn);
  const [progress, setProgress] = useState<StructureProgress>({ yearId: null, orgId: null, periodIds: {} });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const setPeriod = (i: number, k: "name" | "startsOn" | "endsOn", v: string) => {
    const periods = proposal.periods.map((p, j) => (j === i ? { ...p, [k]: v } : p));
    const re = proposeAcademicStructure({ ...entry, periods: periods.map((p, n) => ({ id: p.sourceId, order: n, name: p.name, start: p.startsOn, end: p.endsOn })) });
    setProposal({ ...proposal, periods, problems: re.problems });
  };
  const run = async () => {
    setBusy(true); setMsg(null); setErr(null);
    const r = await writeAcademicStructure({ proposal, existingYearId: existingYear || null, validFrom, actRef: act, reason, progress });
    setProgress(r.progress); setBusy(false);
    if (r.error) { setErr(`${human(r.error)} O que já foi gravado foi mantido; uma nova tentativa continua de onde parou.`); return; }
    setMsg("Ano letivo, organização e períodos gravados como versões próprias. Eles já estão selecionados abaixo.");
    onCreated({ yearId: r.progress.yearId!, orgId: r.progress.orgId!, periodIds: proposal.periods.map((p) => r.progress.periodIds[p.sourceId]!) });
  };
  return (
    <details className="rounded border border-border p-2 text-sm" data-testid="academic-structure-assistant">
      <summary className="font-medium">Preparar ano letivo e períodos a partir desta fonte</summary>
      <p className="text-xs text-muted-foreground">Prévia extraída da fonte; revise os nomes e as datas. Nada é gravado sem o botão abaixo.</p>
      {!canWrite && <p role="note" className="text-xs">Gravar exige a capacidade de manter anos e períodos letivos na sua atuação; sem ela, use a prévia para conferir o cadastro na Administração.</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1"><span className="text-xs">Ano letivo</span>
          <select className={inputCls} value={existingYear} onChange={(e) => setExistingYear(e.target.value)}>
            <option value="">Criar: {proposal.year.name}</option>{years.map((y) => <option key={y.id} value={y.id}>Usar existente: {y.name}</option>)}</select></label>
        {!existingYear && <>
          <label className="space-y-1"><span className="text-xs">Nome do ano</span><input className={inputCls} value={proposal.year.name} onChange={(e) => setProposal({ ...proposal, year: { ...proposal.year, name: e.target.value } })} /></label>
          <span className="text-xs self-end">De {proposal.year.startsOn || "—"} a {proposal.year.endsOn || "—"} (limites dos períodos)</span></>}
        <label className="space-y-1 sm:col-span-2"><span className="text-xs">Nome da organização de períodos</span>
          <input className={inputCls} value={proposal.organization.name} onChange={(e) => setProposal({ ...proposal, organization: { name: e.target.value } })} /></label>
        <label className="space-y-1"><span className="text-xs">Vigência do cadastro a partir de</span><DateInput className={inputCls} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></label>
      </div>
      <table className="mt-2 w-full text-xs"><thead><tr className="text-left"><th>Período</th><th>Início</th><th>Término</th><th></th></tr></thead>
        <tbody>{proposal.periods.map((p, i) => <tr key={p.sourceId} className="border-t border-border">
          <td><input aria-label={`Nome do período ${i + 1}`} className={inputCls} value={p.name} onChange={(e) => setPeriod(i, "name", e.target.value)} /></td>
          <td><DateInput aria-label={`Início do período ${i + 1}`} className={inputCls} value={p.startsOn} onChange={(e) => setPeriod(i, "startsOn", e.target.value)} /></td>
          <td><DateInput aria-label={`Término do período ${i + 1}`} className={inputCls} value={p.endsOn} onChange={(e) => setPeriod(i, "endsOn", e.target.value)} /></td>
          <td>{progress.periodIds[p.sourceId] ? "gravado" : ""}</td></tr>)}</tbody></table>
      {proposal.problems.length > 0 && <ul role="alert" className="list-disc pl-5 text-xs text-destructive">{proposal.problems.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1"><span className="text-xs">Referência documental/fonte (opcional)</span><input className={inputCls} value={act} onChange={(e) => setAct(e.target.value)} placeholder="Ex.: Resolução nº …" /></label>
        <label className="space-y-1"><span className="text-xs">Motivo (opcional)</span><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      <Button type="button" size="sm" className="mt-2" disabled={!canWrite || busy || proposal.problems.length > 0} onClick={() => void run()}>Gravar ano letivo, organização e períodos</Button>
      {busy && <p role="status" className="text-xs">Gravando…</p>}
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </details>
  );
}
