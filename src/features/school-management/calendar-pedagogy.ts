// SIGEM 2.0 — Direção, Lote 06: calendário, pedagogia e avaliação (núcleo puro).
// Calendário oficial só lido (dias já resolvidos por institutional-calendar-*); agenda da escola é camada própria
// que nunca altera dia oficial; notas/situação só após fechamento/registro oficial; providência não substitui autoria setorial.

export type OfficialDay = { date: string; effect: "letivo" | "nao-letivo" | "indeterminado" };
export interface CalendarRef { calendarId: string | null; regime: "anual" | "semestral" | null; days: OfficialDay[] }

/** Previstos/realizados/pendentes: previsto = letivo oficial; realizado = dia com registro de aula oficial; pendente = letivo passado sem registro. */
export function schoolDaysPicture(cal: CalendarRef, lessonDates: Set<string>, today: string) {
  if (!cal.calendarId) return { state: "indeterminado" as const, reason: "calendário aplicável não resolvido" };
  const undetermined = cal.days.filter((d) => d.effect === "indeterminado").length;
  const letivos = cal.days.filter((d) => d.effect === "letivo");
  const realizados = letivos.filter((d) => lessonDates.has(d.date)).length;
  const pendentes = letivos.filter((d) => d.date < today && !lessonDates.has(d.date)).length;
  return { state: undetermined ? ("parcial" as const) : ("apurado" as const), regime: cal.regime ?? "não declarado",
    previstos: undetermined ? null : letivos.length, realizados, pendentes, undetermined };
}

/** Reposição: pedido da escola; só vira dia letivo por validação de quem tem a capacidade do calendário (Supervisão). */
export interface Makeup { id: string; schoolId: string; date: string; replaces: string; requestedBy: string; status: "solicitada" | "validada" | "recusada"; decidedBy?: string; reason?: string }
export function decideMakeup(m: Makeup, by: string, caps: string[], outcome: "validada" | "recusada", reason: string) {
  if (!caps.includes("construir-calendario-da-rede")) return { ok: false as const, code: "reposicao:nao-competente" };
  if (by === m.requestedBy) return { ok: false as const, code: "reposicao:autodecisao" };
  if (m.status !== "solicitada") return { ok: false as const, code: "reposicao:encerrada" };
  if (!reason.trim()) return { ok: false as const, code: "reposicao:motivo-obrigatorio" };
  return { ok: true as const, makeup: { ...m, status: outcome, decidedBy: by, reason } };
}

/** Agenda própria: evento local pode coincidir com qualquer dia, mas nunca muda o efeito oficial. */
export function overlayAgenda(days: OfficialDay[], events: { date: string; title: string }[]) {
  return days.map((d) => ({ ...d, schoolEvents: events.filter((e) => e.date === d.date).map((e) => e.title) }));
}

// ── Visão pedagógica ──
export interface ClassPedagogyFacts {
  classId: string; plansShared: number | null; lessonsRecorded: number | null;
  instruments: { id: string; status: string }[];
  periodClosed: boolean; results: { studentId: string; value: string }[] | null; // só com fechamento vigente
  standingRegistered: boolean; standings: { studentId: string; standing: string }[] | null;
  council: { minuteClosed: boolean } | null;
  interventionPlans: number | null; goals: { id: string; homologated: boolean }[];
  curricularRefs: string[]; // ids BNCC/SAEB do repositório canônico, quando aplicável
}

export function pedagogyView(f: ClassPedagogyFacts) {
  const nr = "não registrado";
  return {
    classId: f.classId,
    planejamentos: f.plansShared ?? nr, registros: f.lessonsRecorded ?? nr, instrumentos: f.instruments.length,
    resultados: f.periodClosed && f.results ? f.results : "aguardando fechamento do período",
    situacao: f.standingRegistered && f.standings ? f.standings : "situação oficial não registrada",
    conselho: f.council ? (f.council.minuteClosed ? "ata encerrada" : "sessão em preparação") : nr,
    intervencoes: f.interventionPlans ?? nr,
    metas: f.goals.filter((g) => g.homologated).map((g) => g.id),
    referencias: f.curricularRefs.length ? f.curricularRefs : "não aplicável ou não vinculado",
  };
}

// ── Providências ──
export const SECTOR_OWNER = { orientacao: "Orientação Pedagógica", avaliacao: "Acompanhamento e Avaliação", secretaria: "Secretaria", docente: "Professor regente" } as const;
export interface Providence { id: string; schoolId: string; sector: keyof typeof SECTOR_OWNER; assignedBy: string; subjectRef: string; due: string | null; events: { kind: "atribuida" | "concluida"; by: string; sector?: string; recordRef?: string }[] }

export function assignProvidence(p: Omit<Providence, "events">, isNaturalPerson: boolean) {
  if (!isNaturalPerson) return { ok: false as const, code: "providencia:autor-humano-obrigatorio" };
  if (!p.subjectRef) return { ok: false as const, code: "providencia:sem-objeto" };
  return { ok: true as const, providence: { ...p, events: [{ kind: "atribuida" as const, by: p.assignedBy }] } };
}
/** Conclusão só pelo setor dono, com referência ao registro feito no módulo do setor; Direção não conclui por ele. */
export function concludeProvidence(p: Providence, by: string, bySector: string, recordRef: string | null) {
  if (bySector !== p.sector) return { ok: false as const, code: "providencia:setor-diferente" };
  if (!recordRef) return { ok: false as const, code: "providencia:sem-registro-do-setor" };
  if (p.events.some((e) => e.kind === "concluida")) return { ok: false as const, code: "providencia:encerrada" };
  return { ok: true as const, providence: { ...p, events: [...p.events, { kind: "concluida" as const, by, sector: bySector, recordRef }] } };
}
