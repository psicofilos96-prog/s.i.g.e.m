/**
 * B4.6.3a — Motor central (puro) de efeitos do calendário institucional.
 *
 * Única função declarada para resolver o estado operacional de um dia e seus derivados (dias letivos,
 * aulas previstas da grade recorrente, agenda de conselhos, impacto de alteração). Entrada = linhas no
 * formato de `calendar_day_declarations` (0023) + estado de homologação + snapshot validOn/knownAt.
 *
 * NÃO é operacional enquanto a fonte pública (`calendar_at`/`calendar_day_at`) devolver só
 * `access-denied`: nenhum produtor de produção alimenta este motor ainda (ver docs/b4-6-3a).
 *
 * Invariantes:
 * - efeito vem só de `school_day_effect` da versão de tipo fixada; NULL ≠ false; nome, código, cor,
 *   símbolo e dia da semana nunca decidem efeito (sábado/domingo não são presumidos não letivos);
 * - acesso negado, ausência de fonte, versão ausente, referência B2.4 inválida, não homologado,
 *   revogado, conflito e efeito não declarado são estados próprios, nunca zero/false;
 * - aplicabilidade a escola/oferta só se declarada (D5 ainda inexistente no banco ⇒ indeterminado);
 * - conselho só por configuração explícita de IDs de tipo (nunca por rótulo);
 * - alteração de calendário só sinaliza impacto; registros já feitos nunca são apagados/regravados;
 * - nenhum efeito trabalhista/pessoal/administrativo é derivado.
 */

export type DeclarationRow = {
  day_state: string;
  version_id: string | null;
  reference_issue: string | null;
  homologation_state: string | null;
  declaration_kind: string | null;
  declaration_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  event_label: string | null;
  day_type_id: string | null;
  day_type_version_id: string | null;
  day_type_version: number | null;
  day_type_label: string | null;
  school_day_effect: boolean | null;
};

import { isKnownAt } from "@/lib/postgres-instant";

/** Data civil AAAA-MM-DD existente (sem normalização de datas impossíveis). */
export function isCivilIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type CalendarDayInput =
  | { source: "acesso-negado"; date: string; knownAt: string }
  | { source: "indisponivel"; date: string; knownAt: string; reason: string }
  | { source: "declaracoes"; calendarId: string; date: string; knownAt: string; rows: DeclarationRow[] };

export type Applicability =
  | { kind: "nao-declarada" }
  /** Só escola: oferta/alocação (D5) NÃO existem no esquema; consumidores institucionais usam "nao-declarada". */
  | { kind: "declarada"; schoolIds: readonly string[] };

export type DeclarationProvenance = {
  kind: string;
  id: string;
  dayTypeId: string;
  dayTypeVersionId: string;
  dayTypeVersion: number;
  label: string | null;
  schoolDayEffect: boolean | null;
};

export type DayState =
  | "acesso-negado"
  | "snapshot-invalido"
  | "fonte-indisponivel"
  | "fonte-malformada"
  | "sem-versao-vigente"
  | "referencia-b2-4-invalida"
  | "nao-homologado"
  | "revogado"
  | "nao-aplicavel-a-escola"
  | "aplicabilidade-nao-declarada"
  | "nao-declarado"
  | "efeito-nao-declarado"
  | "conflito-sem-regra"
  | "letivo"
  | "nao-letivo"
  // B4.6.7 Fatia 3 — estados da decisão do servidor (calendar_composed_days_at) e do agregado por alocação.
  | "efeito-nao-vinculado"
  | "composicao-indeterminada"
  | "sem-calendario-aplicavel"
  | "exclusividade-violada"
  | "norma-indisponivel"
  | "contexto-indisponivel"
  | "alocacoes-divergentes"
  | "sem-alocacao"
  | "carregando";

export type DayResolution = {
  date: string;
  knownAt: string;
  state: DayState;
  /** Determinado só em letivo/nao-letivo. */
  determined: boolean;
  calendarId: string | null;
  versionId: string | null;
  homologationState: string | null;
  declarations: DeclarationProvenance[];
  diagnostic: string | null;
  /** B4.6.7 F4 — evidência validada do servidor por alocação/dia/norma/versão (profundamente congelada). */
  evidence?: readonly ComposedEvidence[];
};

export type ComposedEvidence = Readonly<{
  allocation: string; date: string; knownAt: string; result: string;
  calendarId: string | null; versionId: string | null; normId: string | null; normVersionId: string | null;
  detail: string | null; raw: unknown;
}>;

const base = (i: CalendarDayInput) => ({ date: i.date, knownAt: i.knownAt, calendarId: i.source === "declaracoes" ? i.calendarId : null });

function fail(i: CalendarDayInput, state: DayState, extra: Partial<DayResolution> = {}): DayResolution {
  return { ...base(i), state, determined: false, versionId: null, homologationState: null, declarations: [], diagnostic: null, ...extra };
}

/** Resolve o estado operacional de UM dia para UMA escola (ou sem escola: `schoolId = null`). */
export function resolveCalendarDay(input: CalendarDayInput, applicability: Applicability, schoolId: string | null): DayResolution {
  if (!isCivilIsoDate(input.date) || !isKnownAt(input.knownAt)) return fail(input, "snapshot-invalido");
  if (input.source === "acesso-negado") return fail(input, "acesso-negado");
  if (input.source === "indisponivel") return fail(input, "fonte-indisponivel", { diagnostic: input.reason });
  const rows = input.rows;
  if (!Array.isArray(rows) || rows.length === 0) return fail(input, "fonte-malformada", { diagnostic: "sem-linhas" });
  const states = new Set(rows.map((r) => r.day_state));
  const versions = new Set(rows.map((r) => r.version_id));
  const homs = new Set(rows.map((r) => r.homologation_state));
  if (versions.size > 1 || homs.size > 1) return fail(input, "fonte-malformada", { diagnostic: "snapshot-divergente" });
  const head = rows[0]!;
  const meta = { versionId: head.version_id, homologationState: head.homologation_state };
  if (states.has("sem-versao-vigente")) {
    if (rows.length !== 1 || head.version_id !== null) return fail(input, "fonte-malformada", { diagnostic: "sem-versao-com-conteudo" });
    return fail(input, "sem-versao-vigente");
  }
  if (head.version_id === null) return fail(input, "fonte-malformada", { diagnostic: "versao-ausente" });
  if (states.has("referencia-b2-4-invalida")) return fail(input, "referencia-b2-4-invalida", { ...meta, diagnostic: head.reference_issue });
  if (head.homologation_state === "revogada") return fail(input, "revogado", meta);
  if (head.homologation_state !== "homologada") return fail(input, "nao-homologado", meta);
  if (applicability.kind === "nao-declarada") return fail(input, "aplicabilidade-nao-declarada", meta);
  if (schoolId === null || !applicability.schoolIds.includes(schoolId)) return fail(input, "nao-aplicavel-a-escola", meta);

  const decl: DeclarationProvenance[] = [];
  for (const r of rows) {
    if (r.day_state === "nao-declarado") continue;
    if (r.day_state !== "declarado" && r.day_state !== "conflito-sem-regra")
      return fail(input, "fonte-malformada", { ...meta, diagnostic: `estado-desconhecido:${r.day_state}` });
    if (r.school_day_effect !== null && typeof r.school_day_effect !== "boolean")
      return fail(input, "fonte-malformada", { ...meta, diagnostic: "efeito-fora-do-contrato" });
    if (!r.declaration_kind || !r.declaration_id || !r.day_type_id || !r.day_type_version_id || r.day_type_version === null)
      return fail(input, "fonte-malformada", { ...meta, diagnostic: "declaracao-incompleta" });
    decl.push({
      kind: r.declaration_kind, id: r.declaration_id, dayTypeId: r.day_type_id, dayTypeVersionId: r.day_type_version_id,
      dayTypeVersion: r.day_type_version, label: r.event_label ?? r.day_type_label, schoolDayEffect: r.school_day_effect,
    });
  }
  const ok = (state: DayState): DayResolution => ({ ...base(input), ...meta, state, determined: state === "letivo" || state === "nao-letivo", declarations: decl, diagnostic: null });
  if (decl.length === 0) return ok("nao-declarado");
  const effects = new Set(decl.map((d) => d.schoolDayEffect).filter((e): e is boolean => e !== null));
  if (effects.size > 1) return ok("conflito-sem-regra");
  if (effects.size === 0) return ok("efeito-nao-declarado");
  return ok(effects.has(true) ? "letivo" : "nao-letivo");
}

/** Contagem de dias letivos: número só se TODOS os dias estiverem determinados; senão null + pendências. */
export function countSchoolDays(days: readonly DayResolution[]): { count: number | null; undetermined: DayResolution[]; duplicatedDates: string[] } {
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const d of days) (seen.has(d.date) ? dup : seen).add(d.date);
  const undetermined = days.filter((d) => !d.determined);
  const count = undetermined.length || dup.size ? null : days.filter((d) => d.state === "letivo").length;
  return { count, undetermined, duplicatedDates: [...dup] };
}

export type RecurringBlock = { blockId: string; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; units: number };

export type PlannedDay =
  | { date: string; kind: "aulas-previstas"; blocks: RecurringBlock[]; calendar: DayResolution }
  | { date: string; kind: "sem-aula-por-calendario"; calendar: DayResolution }
  | { date: string; kind: "sem-bloco-na-grade"; calendar: DayResolution }
  | { date: string; kind: "indeterminado"; calendar: DayResolution };

/** ISO weekday 1..7 (seg..dom) de data civil. */
export function isoWeekday(date: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (d === 0 ? 7 : d) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/**
 * Projeta a grade recorrente nas datas. Dia não letivo declarado ⇒ nenhuma aula prevista e nenhuma
 * ausência gerada. Estado indeterminado ⇒ `indeterminado` (nunca zero). Domingo/sábado tratados como
 * qualquer dia: só valem se houver bloco cadastrado e o calendário declarar letivo.
 */
export function projectPlannedLessons(blocks: readonly RecurringBlock[], days: readonly DayResolution[]) {
  const out: PlannedDay[] = days.map((cal) => {
    if (!cal.determined) return { date: cal.date, kind: "indeterminado", calendar: cal };
    if (cal.state === "nao-letivo") return { date: cal.date, kind: "sem-aula-por-calendario", calendar: cal };
    const b = blocks.filter((x) => x.weekday === isoWeekday(cal.date));
    return b.length ? { date: cal.date, kind: "aulas-previstas", blocks: b, calendar: cal } : { date: cal.date, kind: "sem-bloco-na-grade", calendar: cal };
  });
  const blocked = out.some((d) => d.kind === "indeterminado") || new Set(days.map((d) => d.date)).size !== days.length;
  const plannedUnits = blocked ? null : out.reduce((s, d) => s + (d.kind === "aulas-previstas" ? d.blocks.reduce((a, b) => a + b.units, 0) : 0), 0);
  return { days: out, plannedUnits };
}

export type CouncilAgendaConfig = { kind: "nao-configurada" } | { kind: "configurada"; councilDayTypeIds: readonly string[] };

/** Agenda de conselhos: eventos cujo tipo foi DECLARADO como conselho por configuração. Informativa. */
export function councilAgenda(days: readonly DayResolution[], config: CouncilAgendaConfig) {
  if (config.kind === "nao-configurada") return { kind: "nao-configurada" as const };
  const pending = days.filter((d) => !(d.determined || d.state === "nao-declarado" || d.state === "efeito-nao-declarado" || d.state === "conflito-sem-regra"));
  const items = days.flatMap((d) =>
    d.declarations.filter((x) => x.kind === "evento" && config.councilDayTypeIds.includes(x.dayTypeId)).map((x) => ({ date: d.date, declaration: x, versionId: d.versionId })),
  );
  return { kind: pending.length ? ("parcial" as const) : ("completa" as const), items, pending };
}

export type CalendarImpact = {
  date: string;
  before: DayState | "ausente-na-leitura";
  after: DayState | "ausente-na-leitura";
  /** Registros existentes na data são preservados; só sinalizados para revisão humana. */
  preservedRecords: readonly string[];
};

/** Compara duas resoluções da mesma faixa; nunca altera registros, só devolve impacto. */
export function calendarImpact(before: readonly DayResolution[], after: readonly DayResolution[], recordsByDate: Readonly<Record<string, readonly string[]>>): CalendarImpact[] {
  const sig = (d: DayResolution) => JSON.stringify([d.state, d.versionId, d.homologationState,
    [...d.declarations].map((x) => [x.kind, x.id, x.dayTypeVersionId, x.schoolDayEffect, x.label]).sort()]);
  const prev = new Map(before.map((d) => [d.date, d]));
  const next = new Map(after.map((d) => [d.date, d]));
  const dates = [...new Set([...prev.keys(), ...next.keys()])].sort();
  return dates.flatMap((date) => {
    const b = prev.get(date); const a = next.get(date);
    if (b && a && sig(b) === sig(a)) return [];
    return [{ date, before: b?.state ?? "ausente-na-leitura", after: a?.state ?? "ausente-na-leitura", preservedRecords: recordsByDate[date] ?? [] }];
  });
}
