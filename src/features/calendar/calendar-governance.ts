/**
 * Governança do calendário da rede (regra normativa da Supervisão):
 *
 * Supervisão cria → configura → sistema valida → envia para revisão →
 * homologa → publicado para a rede → IMUTÁVEL. Não existe "voltar para
 * rascunho" a partir de HOMOLOGADO; retificação futura exigirá mecanismo
 * próprio de versionamento normativo com auditoria (não implementado).
 *
 * Toda mutação passa por `mutateCalendar`, único ponto de escrita. As
 * capacidades são modeladas aqui; a autorização real dependerá do
 * backend/RBAC (ponto marcado com `RBAC:`).
 */
import { DAY_TYPES } from "./calendar-catalog";
import {
  classesStart,
  daysIn,
  isWeekend,
  parse,
  iso,
  resolveCalendar,
  validateCalendar,
  weekday,
  brDate,
} from "./calendar-engine";
import type {
  CalendarActor,
  CalendarEventEntry,
  CalendarPeriod,
  CalendarRange,
  CalendarStatus,
  DayTypeCode,
  MovableHoliday,
  NetworkCalendar,
  ReviewItem,
} from "./calendar-types";

export type CalendarCapabilities = {
  view: boolean;
  edit: boolean;
  submitForReview: boolean;
  returnToDraft: boolean;
  homologate: boolean;
  archive: boolean;
  duplicate: boolean;
};

const FROZEN: CalendarStatus[] = ["homologado", "arquivado"];
export const isImmutable = (cal: NetworkCalendar) => FROZEN.includes(cal.status);

/** RBAC: substituir por autorização do backend quando houver autenticação real. */
export function calendarCapabilities(
  actor: CalendarActor,
  cal: NetworkCalendar | null,
): CalendarCapabilities {
  const sup = actor.role === "supervisao";
  const status = cal?.status;
  return {
    // Escolas e professores consultam apenas o calendário publicado.
    view: sup || status === "homologado" || status === "arquivado",
    edit: sup && status === "rascunho",
    submitForReview: sup && status === "rascunho",
    returnToDraft: sup && status === "em-revisao",
    homologate: sup && status === "em-revisao",
    archive: sup && status === "homologado",
    duplicate:
      sup &&
      (status === "homologado" ||
        status === "arquivado" ||
        status === "rascunho" ||
        status === "em-revisao"),
  };
}

export type CalendarMutation =
  | { kind: "definir-dia"; date: string; type: DayTypeCode | null }
  | { kind: "aplicar-faixa"; type: DayTypeCode; start: string; end: string }
  | { kind: "remover-faixa"; id: string }
  | { kind: "adicionar-evento"; event: Omit<CalendarEventEntry, "id"> }
  | { kind: "remover-evento"; id: string }
  | { kind: "salvar-periodo"; period: CalendarPeriod }
  | { kind: "remover-periodo"; id: string };

export type MutationResult =
  { ok: true; calendar: NetworkCalendar } | { ok: false; reason: string };

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as object)) deepFreeze(v);
  }
  return obj;
}

const now = () => new Date().toISOString();
const audit = (
  cal: NetworkCalendar,
  actor: CalendarActor,
  action: NetworkCalendar["audit"][number]["action"],
  detail: string,
) => [...cal.audit, { at: now(), actorId: actor.id, actorName: actor.name, action, detail }];

function describe(m: CalendarMutation): string {
  switch (m.kind) {
    case "definir-dia":
      return m.type
        ? `Dia ${brDate(m.date)} definido como ${DAY_TYPES[m.type].label}.`
        : `Dia ${brDate(m.date)} voltou ao cálculo automático.`;
    case "aplicar-faixa":
      return `Faixa ${DAY_TYPES[m.type].label} de ${brDate(m.start)} a ${brDate(m.end)}.`;
    case "remover-faixa":
      return `Faixa ${m.id} removida.`;
    case "adicionar-evento":
      return `${DAY_TYPES[m.event.type].label} em ${brDate(m.event.date)}${m.event.name ? ` — ${m.event.name}` : ""}.`;
    case "remover-evento":
      return `Evento ${m.id} removido.`;
    case "salvar-periodo":
      return `Período "${m.period.name}" (${brDate(m.period.start)} a ${brDate(m.period.end)}).`;
    case "remover-periodo":
      return `Período ${m.id} removido.`;
  }
}

/** Único ponto de escrita do conteúdo. Recusa perfil sem capacidade e estado imutável. */
export function mutateCalendar(
  cal: NetworkCalendar,
  actor: CalendarActor,
  m: CalendarMutation,
): MutationResult {
  if (isImmutable(cal))
    return { ok: false, reason: `Calendário ${cal.status}: o conteúdo é imutável.` };
  if (!calendarCapabilities(actor, cal).edit)
    return {
      ok: false,
      reason:
        actor.role === "supervisao"
          ? "Somente calendários em rascunho podem ser alterados."
          : "Apenas a Supervisão de Ensino altera o calendário da rede.",
    };
  let next: NetworkCalendar = { ...cal };
  const seq = cal.audit.length + 1;
  switch (m.kind) {
    case "definir-dia":
      next.overrides = cal.overrides.filter((o) => o.date !== m.date);
      if (m.type)
        next.overrides = [...next.overrides, { date: m.date, type: m.type }].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
      break;
    case "aplicar-faixa":
      if (m.end < m.start) return { ok: false, reason: "O término da faixa é anterior ao início." };
      next.ranges = [
        ...cal.ranges,
        { id: `${cal.id}-fx-${seq}`, type: m.type, start: m.start, end: m.end },
      ];
      break;
    case "remover-faixa":
      next.ranges = cal.ranges.filter((r) => r.id !== m.id);
      break;
    case "adicionar-evento":
      if (cal.events.some((e) => e.date === m.event.date))
        return {
          ok: false,
          reason: `Já existe um evento em ${brDate(m.event.date)}. Remova-o antes.`,
        };
      next.events = [...cal.events, { ...m.event, id: `${cal.id}-ev-${seq}` }].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      break;
    case "remover-evento":
      next.events = cal.events.filter((e) => e.id !== m.id);
      break;
    case "salvar-periodo":
      if (m.period.end < m.period.start)
        return { ok: false, reason: "O período termina antes de começar." };
      next.periods = [...cal.periods.filter((p) => p.id !== m.period.id), m.period].sort(
        (a, b) => a.order - b.order,
      );
      break;
    case "remover-periodo":
      next.periods = cal.periods.filter((p) => p.id !== m.id);
      break;
  }
  next = { ...next, audit: audit(cal, actor, "alterado", describe(m)) };
  return { ok: true, calendar: next };
}

export type Transition = "enviar-revisao" | "devolver-rascunho" | "homologar" | "arquivar";

export function transitionCalendar(
  cal: NetworkCalendar,
  actor: CalendarActor,
  t: Transition,
  opts: { confirmCritical?: boolean; at?: string } = {},
): MutationResult {
  const caps = calendarCapabilities(actor, cal);
  const at = opts.at ?? now();
  if (t === "enviar-revisao") {
    if (!caps.submitForReview)
      return { ok: false, reason: "Envio para revisão indisponível neste estado ou perfil." };
    return {
      ok: true,
      calendar: {
        ...cal,
        status: "em-revisao",
        audit: audit(cal, actor, "enviado-revisao", "Enviado para revisão."),
      },
    };
  }
  if (t === "devolver-rascunho") {
    // Somente EM_REVISÃO volta a rascunho. HOMOLOGADO nunca volta.
    if (!caps.returnToDraft)
      return {
        ok: false,
        reason:
          cal.status === "homologado"
            ? "Calendário homologado não retorna a rascunho."
            : "Devolução indisponível neste estado ou perfil.",
      };
    return {
      ok: true,
      calendar: {
        ...cal,
        status: "rascunho",
        audit: audit(
          cal,
          actor,
          "devolvido-rascunho",
          "Devolvido para rascunho durante a revisão.",
        ),
      },
    };
  }
  if (t === "homologar") {
    if (!caps.homologate)
      return {
        ok: false,
        reason: "Homologação exige calendário em revisão e perfil da Supervisão.",
      };
    const issues = validateCalendar(cal);
    if (issues.some((i) => i.severity === "erro"))
      return { ok: false, reason: "Há erros estruturais; corrija antes de homologar." };
    if (issues.some((i) => i.severity === "critico") && !opts.confirmCritical)
      return { ok: false, reason: "Há avisos críticos; confirme explicitamente para homologar." };
    const done: NetworkCalendar = {
      ...cal,
      status: "homologado",
      homologatedBy: actor.name,
      homologatedAt: at,
      audit: [
        ...cal.audit,
        {
          at,
          actorId: actor.id,
          actorName: actor.name,
          action: "homologado",
          detail: "Homologado e publicado para a rede.",
        },
      ],
    };
    return { ok: true, calendar: deepFreeze(done) };
  }
  if (!caps.archive)
    return { ok: false, reason: "Somente calendário homologado pode ser arquivado." };
  const archived: NetworkCalendar = {
    ...cal,
    status: "arquivado",
    audit: [
      ...cal.audit,
      {
        at,
        actorId: actor.id,
        actorName: actor.name,
        action: "arquivado",
        detail: "Ano letivo encerrado; calendário arquivado.",
      },
    ],
  };
  return { ok: true, calendar: deepFreeze(archived) };
}

// ------------------------------------------------------------------ Duplicação

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easter(year: number) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}
export function movableDate(kind: MovableHoliday, year: number) {
  const e = easter(year);
  const { y, m, d } = parse(e);
  const off = { carnaval: -47, "sexta-santa": -2, "corpus-christi": 60 }[kind];
  const x = new Date(Date.UTC(y, m - 1, d + off));
  return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

function moveYear(date: string, year: number, review: ReviewItem[], what: string) {
  const { m, d } = parse(date);
  const day = Math.min(d, daysIn(year, m));
  if (day !== d)
    review.push({
      severity: "atencao",
      code: "DATA_INEXISTENTE",
      message: `${what}: 29/02 não existe em ${year}; movido para 28/02.`,
    });
  return iso(year, m, day);
}

/**
 * Duplica um calendário para outro ano sem alterar o original. O novo nasce
 * RASCUNHO; datas fixas mantêm dia/mês, móveis são recalculadas pela Páscoa,
 * fins de semana são recalculados pelo motor. Nada é "corrigido" para
 * silenciar avisos: tudo que muda de dia da semana vira item de revisão.
 */
export function duplicateCalendar(
  source: NetworkCalendar,
  targetYear: number,
  actor: CalendarActor,
  existing: NetworkCalendar[] = [],
): MutationResult {
  if (!calendarCapabilities(actor, source).duplicate)
    return { ok: false, reason: "Apenas a Supervisão duplica calendários." };
  if (targetYear <= source.year)
    return { ok: false, reason: "Escolha um ano posterior ao de origem." };
  const id = `cal-rede-${targetYear}-${source.modality}`;
  if (existing.some((c) => c.id === id))
    return {
      ok: false,
      reason: `Já existe calendário ${source.modality.toUpperCase()} para ${targetYear}.`,
    };
  const review: ReviewItem[] = [];
  const weekdayChange = (what: string, from: string, to: string) => {
    if (weekday(from) !== weekday(to) && !isWeekend(from) && isWeekend(to))
      review.push({
        severity: "atencao",
        code: "COLISAO_FIM_DE_SEMANA",
        message: `${what} (${brDate(to)}) passou a cair em fim de semana.`,
        date: to,
      });
  };
  const ranges: CalendarRange[] = source.ranges.map((r, i) => ({
    ...r,
    id: `${id}-fx-${i + 1}`,
    start: moveYear(r.start, targetYear, review, `Faixa ${DAY_TYPES[r.type].label}`),
    end: moveYear(r.end, targetYear, review, `Faixa ${DAY_TYPES[r.type].label}`),
  }));
  const events: CalendarEventEntry[] = source.events.map((e) => {
    const label = e.name ?? DAY_TYPES[e.type].label;
    const date = e.movable
      ? movableDate(e.movable, targetYear)
      : moveYear(e.date, targetYear, review, label);
    if (e.movable)
      review.push({
        severity: "info",
        code: "MOVEL_RECALCULADO",
        message: `${label}: data móvel recalculada para ${brDate(date)}.`,
        date,
      });
    else weekdayChange(label, e.date, date);
    return {
      ...e,
      id: `${id}-ev-${date}`,
      date,
      ...(e.displayDate ? { displayDate: moveYear(e.displayDate, targetYear, review, label) } : {}),
    };
  });
  const periods: CalendarPeriod[] = source.periods.map((p) => {
    const start = moveYear(p.start, targetYear, review, p.name);
    const end = moveYear(p.end, targetYear, review, p.name);
    const councilDate = p.councilDate
      ? moveYear(p.councilDate, targetYear, review, p.councilLabel ?? p.name)
      : undefined;
    for (const [what, d] of [
      [`Início de "${p.name}"`, start],
      [`Término de "${p.name}"`, end],
    ] as const)
      if (isWeekend(d))
        review.push({
          severity: "atencao",
          code: "LIMITE_EM_FIM_DE_SEMANA",
          message: `${what} cai em fim de semana (${brDate(d)}).`,
          date: d,
        });
    return {
      ...p,
      id: `per-${targetYear}-${source.modality}-${p.order}`,
      start,
      end,
      ...(councilDate ? { councilDate } : {}),
    };
  });
  const overrides = source.overrides.map((o) => {
    const date = moveYear(o.date, targetYear, review, `Ajuste manual ${DAY_TYPES[o.type].label}`);
    weekdayChange(`Ajuste manual ${DAY_TYPES[o.type].label}`, o.date, date);
    return { ...o, date };
  });
  const inheritedHolidays = source.inheritedHolidays.map((h) => ({
    ...h,
    date: h.movable
      ? movableDate(h.movable, targetYear)
      : moveYear(h.date, targetYear, review, h.name),
  }));
  const at = now();
  const draft: NetworkCalendar = {
    ...source,
    id,
    year: targetYear,
    academicYearId: `ano-${targetYear}`,
    status: "rascunho",
    observations: source.observations?.replaceAll(String(source.year), String(targetYear)),
    ranges,
    events,
    periods,
    overrides,
    inheritedHolidays,
    policy: structuredClone(source.policy),
    legendHidden: [...source.legendHidden],
    signatures: [...source.signatures],
    createdBy: actor.name,
    createdAt: at,
    homologatedBy: undefined,
    homologatedAt: undefined,
    duplicatedFrom: source.id,
    fixtureNote: undefined,
    audit: [
      {
        at,
        actorId: actor.id,
        actorName: actor.name,
        action: "duplicado",
        detail: `Duplicado de ${source.id} (${source.year}).`,
      },
    ],
  };
  const validation = validateCalendar(draft, resolveCalendar(draft));
  draft.duplicationReview = [...review, ...validation];
  if (!classesStart(draft))
    draft.duplicationReview.push({
      severity: "atencao",
      code: "SEM_INICIO",
      message: "Início das aulas não definido.",
    });
  return { ok: true, calendar: draft };
}
