import { formatAcademicDate } from "@/lib/academic-date";
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
import {
  dayTypesOf,
  semanticsMissing,
  typeInfo,
  typeUsage,
  validateDayType,
} from "./calendar-catalog";
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
  CalendarDocumentConfig,
  CalendarEventEntry,
  CalendarPeriod,
  CalendarPeriodGroup,
  CalendarRange,
  CalendarRule,
  CalendarStatus,
  DayTypeCode,
  DayTypeInfo,
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
  deleteDraft: boolean;
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
    // Somente rascunhos podem ser excluídos (ex.: cópia criada por engano).
    deleteDraft: sup && status === "rascunho",
  };
}

/**
 * Exclusão de rascunho: remove definitivamente o calendário em elaboração.
 * Homologado, em revisão ou arquivado nunca são excluídos — a trilha de
 * auditoria desses estados é preservada para sempre.
 */
export function deleteCalendar(
  cal: NetworkCalendar,
  actor: CalendarActor,
): { ok: true } | { ok: false; reason: string } {
  if (!calendarCapabilities(actor, cal).deleteDraft)
    return {
      ok: false,
      reason:
        actor.role === "supervisao"
          ? "Somente calendários em rascunho podem ser excluídos."
          : "Apenas a Supervisão de Ensino exclui calendários da rede.",
    };
  return { ok: true };
}

export type CalendarMutation =
  | { kind: "definir-dia"; date: string; type: DayTypeCode | null }
  /** "Dia letivo": remove sobrescrita e evento pontual da data; faixas e FDS seguem o motor. */
  | { kind: "restaurar-dia-letivo"; date: string }
  | { kind: "aplicar-faixa"; type: DayTypeCode; start: string; end: string }
  | { kind: "remover-faixa"; id: string }
  | { kind: "adicionar-evento"; event: Omit<CalendarEventEntry, "id"> }
  | { kind: "remover-evento"; id: string }
  | { kind: "salvar-periodo"; period: CalendarPeriod }
  | { kind: "remover-periodo"; id: string }
  | {
      kind: "adicionar-periodo";
      period: { name: string; start: string; end: string; groupId?: string };
    }
  | { kind: "mover-periodo"; id: string; direction: -1 | 1 }
  | { kind: "salvar-grupo"; group: { id?: string; name: string; totalLabel?: string } }
  | { kind: "remover-grupo"; id: string }
  | { kind: "mover-grupo"; id: string; direction: -1 | 1 }
  | { kind: "salvar-regra"; rule: Omit<CalendarRule, "id"> & { id?: string } }
  | { kind: "remover-regra"; id: string }
  | {
      kind: "configurar-documento";
      patch: Partial<
        Pick<NetworkCalendar, "title" | "observations" | "signatures" | "legendHidden" | "customLegend" | "symbology"> & {
          document: Partial<CalendarDocumentConfig>;
        }
      > & { symbologyPrint?: NetworkCalendar["symbologyPrint"] };
    }
  /** Cria (sem `code`) ou versiona um tipo do catálogo; a identidade nunca muda. */
  | { kind: "salvar-tipo"; type: Omit<DayTypeInfo, "code" | "version" | "native"> & { code?: DayTypeCode } }
  /** Excluir só é aceito para tipo criado pela interface e nunca usado; o resto é inativação. */
  | { kind: "remover-tipo"; code: DayTypeCode };

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

function describe(m: CalendarMutation, cal: NetworkCalendar): string {
  const DAY_TYPES = new Proxy({}, { get: (_, k: string) => typeInfo(dayTypesOf(cal), k) }) as { [k: string]: DayTypeInfo };
  switch (m.kind) {
    case "definir-dia":
      return m.type
        ? `Dia ${brDate(m.date)} definido como ${DAY_TYPES[m.type].label}.`
        : `Dia ${brDate(m.date)} voltou ao cálculo automático.`;
    case "restaurar-dia-letivo":
      return `Dia ${brDate(m.date)} restaurado como dia letivo (classificação especial removida).`;
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
    case "adicionar-periodo":
      return `Período "${m.period.name}" adicionado (${brDate(m.period.start)} a ${brDate(m.period.end)}).`;
    case "mover-periodo":
      return `Período ${m.id} ${m.direction < 0 ? "antecipado" : "adiado"} na ordem.`;
    case "salvar-grupo":
      return m.group.id
        ? `Agrupamento ${m.group.id} renomeado para "${m.group.name}".`
        : `Agrupamento "${m.group.name}" criado.`;
    case "remover-grupo":
      return `Agrupamento ${m.id} removido; seus períodos ficaram sem agrupamento.`;
    case "mover-grupo":
      return `Agrupamento ${m.id} ${m.direction < 0 ? "antecipado" : "adiado"} na ordem.`;
    case "salvar-regra":
      return m.rule.id ? `Regra ${m.rule.id} alterada.` : `Regra "${m.rule.kind}" adicionada.`;
    case "remover-regra":
      return `Regra ${m.id} removida.`;
    case "configurar-documento":
      return `Configuração do documento alterada (${Object.keys(m.patch).join(", ")}).`;
    case "salvar-tipo":
      return m.type.code
        ? `Tipo ${m.type.code} ("${m.type.label}") atualizado — nova versão.`
        : `Tipo de dia "${m.type.label}" criado.`;
    case "remover-tipo":
      return `Tipo ${m.code} excluído do catálogo (nunca utilizado).`;
  }
}

/** Ordem contígua 1..n preservando a sequência atual; IDs nunca mudam. */
function renumber(periods: CalendarPeriod[]): CalendarPeriod[] {
  return [...periods].sort((a, b) => a.order - b.order).map((p, i) => ({ ...p, order: i + 1 }));
}
function uniqueId(prefix: string, seq: number, taken: Array<{ id: string }>) {
  let n = seq;
  while (taken.some((t) => t.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}

const inYear = (cal: NetworkCalendar, d: string) => d.startsWith(`${cal.year}-`);

function checkPeriod(
  cal: NetworkCalendar,
  p: { start: string; end: string; groupId?: string | undefined; name: string },
): string | null {
  if (!p.name.trim()) return "Informe o nome do período.";
  if (p.end < p.start) return "O período termina antes de começar.";
  if (!inYear(cal, p.start) || !inYear(cal, p.end))
    return `O período deve estar dentro do ano de ${cal.year}.`;
  if (p.groupId && !cal.periodGroups.some((g) => g.id === p.groupId))
    return "Agrupamento inexistente.";
  return null;
}

function checkRule(cal: NetworkCalendar, r: Omit<CalendarRule, "id">): string | null {
  const needsValue = r.kind !== "conselho-por-periodo" && r.kind !== "feriado-local-esperado";
  if (needsValue && (r.value === undefined || !Number.isInteger(r.value) || r.value < 0))
    return "Informe um valor inteiro não negativo.";
  if (r.kind === "conselho-dia-semana" && (r.value! < 0 || r.value! > 6))
    return "Dia da semana inválido.";
  if (r.kind === "minimo-agrupamento" && !cal.periodGroups.some((g) => g.id === r.targetId))
    return "Selecione um agrupamento existente.";
  if (r.kind === "minimo-periodo" && r.targetId && !cal.periods.some((p) => p.id === r.targetId))
    return "Selecione um período existente.";
  if (
    r.kind === "feriado-local-esperado" &&
    (!/^\d{2}-\d{2}$/.test(r.monthDay ?? "") || !r.dayType)
  )
    return "Informe dia/mês (MM-DD) e o tipo esperado.";
  return null;
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
  const types = dayTypesOf(cal);
  const applied =
    m.kind === "definir-dia" ? m.type : m.kind === "aplicar-faixa" ? m.type : m.kind === "adicionar-evento" ? m.event.type : null;
  if (applied) {
    const info = types[applied];
    if (!info) return { ok: false, reason: `Tipo ${applied} não existe no catálogo deste calendário.` };
    if (info.active === false)
      return { ok: false, reason: `O tipo "${info.label}" está inativo e não pode ser usado em novos lançamentos.` };
    const missing = semanticsMissing(info);
    if (missing) return { ok: false, reason: missing };
  }
  switch (m.kind) {
    case "definir-dia":
      next.overrides = cal.overrides.filter((o) => o.date !== m.date);
      if (m.type)
        next.overrides = [...next.overrides, { date: m.date, type: m.type }].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
      break;
    case "restaurar-dia-letivo":
      if (
        !cal.overrides.some((o) => o.date === m.date) &&
        !cal.events.some((e) => e.date === m.date)
      )
        return {
          ok: false,
          reason: `${brDate(m.date)} não possui classificação especial pontual.`,
        };
      next.overrides = cal.overrides.filter((o) => o.date !== m.date);
      next.events = cal.events.filter((e) => e.date !== m.date);
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
      {
        const same = cal.events.filter((e) => e.date === m.event.date);
        const coexist = (c: DayTypeCode) => types[c]?.coexists === true;
        if (same.some((e) => e.type === m.event.type))
          return { ok: false, reason: `${brDate(m.event.date)} já tem um evento deste tipo.` };
        if (same.length && !(coexist(m.event.type) && same.every((e) => coexist(e.type))))
          return {
            ok: false,
            reason: `Já existe um evento em ${brDate(m.event.date)}. Só tipos declarados como "podem coexistir" compartilham a data; remova-o antes ou ajuste o tipo.`,
          };
      }
      next.events = [...cal.events, { ...m.event, id: `${cal.id}-ev-${seq}` }].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      break;
    case "remover-evento":
      next.events = cal.events.filter((e) => e.id !== m.id);
      break;
    case "salvar-periodo": {
      const err = checkPeriod(cal, m.period);
      if (err) return { ok: false, reason: err };
      next.periods = [...cal.periods.filter((p) => p.id !== m.period.id), m.period].sort(
        (a, b) => a.order - b.order,
      );
      break;
    }
    case "remover-periodo":
      next.periods = renumber(cal.periods.filter((p) => p.id !== m.id));
      next.rules = cal.rules.filter((r) => !(r.kind === "minimo-periodo" && r.targetId === m.id));
      break;
    case "adicionar-periodo": {
      const err = checkPeriod(cal, m.period);
      if (err) return { ok: false, reason: err };
      const order = Math.max(0, ...cal.periods.map((p) => p.order)) + 1;
      next.periods = [
        ...cal.periods,
        {
          id: uniqueId(`${cal.id}-per`, seq, cal.periods),
          order,
          name: m.period.name,
          start: m.period.start,
          end: m.period.end,
          ...(m.period.groupId ? { groupId: m.period.groupId } : {}),
        },
      ];
      break;
    }
    case "mover-periodo": {
      const list = [...cal.periods].sort((a, b) => a.order - b.order);
      const i = list.findIndex((p) => p.id === m.id);
      const j = i + m.direction;
      if (i < 0 || j < 0 || j >= list.length)
        return { ok: false, reason: "Não é possível mover o período nessa direção." };
      [list[i], list[j]] = [list[j]!, list[i]!];
      next.periods = list.map((p, k) => ({ ...p, order: k + 1 }));
      break;
    }
    case "salvar-grupo": {
      if (!m.group.name.trim()) return { ok: false, reason: "Informe o nome do agrupamento." };
      const groups = cal.periodGroups ?? [];
      const gid = m.group.id;
      next.periodGroups = gid
        ? groups.map((g): CalendarPeriodGroup =>
            g.id === gid
              ? {
                  ...g,
                  name: m.group.name,
                  ...(m.group.totalLabel ? { totalLabel: m.group.totalLabel } : {}),
                }
              : g,
          )
        : [
            ...groups,
            {
              id: uniqueId(`${cal.id}-grp`, seq, groups),
              name: m.group.name,
              order: Math.max(0, ...groups.map((g) => g.order)) + 1,
              ...(m.group.totalLabel ? { totalLabel: m.group.totalLabel } : {}),
            },
          ];
      break;
    }
    case "mover-grupo": {
      const list = [...cal.periodGroups].sort((a, b) => a.order - b.order);
      const i = list.findIndex((g) => g.id === m.id);
      const j = i + m.direction;
      if (i < 0 || j < 0 || j >= list.length)
        return { ok: false, reason: "Não é possível mover o agrupamento nessa direção." };
      [list[i], list[j]] = [list[j]!, list[i]!];
      next.periodGroups = list.map((g, k) => ({ ...g, order: k + 1 }));
      break;
    }
    case "salvar-regra": {
      const { id, ...rule } = m.rule;
      const err = checkRule(cal, rule);
      if (err) return { ok: false, reason: err };
      if (id && !cal.rules.some((r) => r.id === id))
        return { ok: false, reason: "Regra não encontrada." };
      next.rules = id
        ? cal.rules.map((r) => (r.id === id ? { ...rule, id } : r))
        : [...cal.rules, { ...rule, id: uniqueId(`${cal.id}-rg`, seq, cal.rules) }];
      break;
    }
    case "remover-regra":
      next.rules = cal.rules.filter((r) => r.id !== m.id);
      break;
    case "salvar-tipo": {
      const current = m.type.code ? types[m.type.code] : undefined;
      if (m.type.code && !current) return { ok: false, reason: `Tipo ${m.type.code} não existe.` };
      const code = current?.code ?? `tipo-${crypto.randomUUID()}`;
      const def: DayTypeInfo = {
        ...m.type,
        code,
        version: (current?.version ?? 0) + 1,
        native: current?.native,
      };
      if (current?.kind === "automatico" && def.kind !== "automatico")
        return { ok: false, reason: "A natureza dos tipos automáticos do sistema não pode ser alterada." };
      const issues = validateDayType(def, types);
      if (issues.length) return { ok: false, reason: issues.map((i) => i.message).join(" ") };
      if (current && typeUsage(cal, code) > 0 && (current.kind !== def.kind || current.countsAsSchoolDay !== def.countsAsSchoolDay) && current.kind !== null)
        return {
          ok: false,
          reason: `"${current.label}" já é usado neste calendário: mudar sua natureza ou sua contagem reescreveria datas já lançadas. Crie um novo tipo ou remova antes os lançamentos.`,
        };
      next.dayTypeCatalog = { ...(cal.dayTypeCatalog ?? {}), [code]: def };
      if (current)
        next.dayTypeHistory = [
          ...(cal.dayTypeHistory ?? []),
          { ...current, supersededAt: now(), supersededBy: actor.name },
        ];
      break;
    }
    case "remover-tipo": {
      const current = types[m.code];
      if (!current) return { ok: false, reason: `Tipo ${m.code} não existe.` };
      if (current.native)
        return { ok: false, reason: `"${current.label}" pertence ao modelo do calendário: inative-o em vez de excluir.` };
      if (typeUsage(cal, m.code) > 0)
        return { ok: false, reason: `"${current.label}" já foi utilizado neste calendário: inative-o para preservar o histórico.` };
      const own = { ...(cal.dayTypeCatalog ?? {}) };
      delete own[m.code];
      next.dayTypeCatalog = own;
      break;
    }
    case "configurar-documento": {
      const { document, ...rest } = m.patch;
      if (rest.title !== undefined && !rest.title.trim())
        return { ok: false, reason: "O título do documento não pode ficar vazio." };
      next = { ...next, ...rest, document: { ...cal.document, ...document } };
      break;
    }
    case "remover-grupo":
      next.periodGroups = (cal.periodGroups ?? []).filter((g) => g.id !== m.id);
      next.periods = cal.periods.map((p) =>
        p.groupId === m.id ? { ...p, groupId: undefined } : p,
      );
      next.rules = cal.rules.filter(
        (r) => !(r.kind === "minimo-agrupamento" && r.targetId === m.id),
      );
      break;
  }
  next = { ...next, audit: audit(cal, actor, "alterado", describe(m, next)) };
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
    start: moveYear(r.start, targetYear, review, `Faixa ${typeInfo(dayTypesOf(source), r.type).label}`),
    end: moveYear(r.end, targetYear, review, `Faixa ${typeInfo(dayTypesOf(source), r.type).label}`),
  }));
  const events: CalendarEventEntry[] = source.events.map((e) => {
    const label = e.name ?? typeInfo(dayTypesOf(source), e.type).label;
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
  const groupIdMap = new Map(
    (source.periodGroups ?? []).map((g) => [
      g.id,
      `grp-${targetYear}-${source.modality}-${g.order}`,
    ]),
  );
  const periodGroups = (source.periodGroups ?? []).map((g) => ({
    ...g,
    id: groupIdMap.get(g.id)!,
  }));
  // Estrutura copiada como PONTO DE PARTIDA: o rascunho pode adicionar,
  // remover, renomear, reagrupar e reordenar livremente.
  const periods: CalendarPeriod[] = source.periods.map((p) => {
    const start = moveYear(p.start, targetYear, review, p.name);
    const end = moveYear(p.end, targetYear, review, p.name);
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
      groupId: p.groupId ? groupIdMap.get(p.groupId) : undefined,
    };
  });
  const overrides = source.overrides.map((o) => {
    const date = moveYear(o.date, targetYear, review, `Ajuste manual ${typeInfo(dayTypesOf(source), o.type).label}`);
    weekdayChange(`Ajuste manual ${typeInfo(dayTypesOf(source), o.type).label}`, o.date, date);
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
    periodGroups,
    overrides,
    inheritedHolidays,
    rules: source.rules.map((r) => ({
      ...r,
      ...(r.targetId
        ? {
            targetId:
              groupIdMap.get(r.targetId) ??
              periods.find((p, i) => source.periods[i]?.id === r.targetId)?.id ??
              r.targetId,
          }
        : {}),
    })),
    document: structuredClone(source.document),
    legendHidden: [...source.legendHidden],
    customLegend: structuredClone(source.customLegend ?? []),
    symbology: structuredClone(source.symbology ?? {}),
    symbologyPrint: structuredClone(source.symbologyPrint ?? {}),
    dayTypeCatalog: structuredClone(source.dayTypeCatalog ?? {}),
    dayTypeHistory: [],
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
