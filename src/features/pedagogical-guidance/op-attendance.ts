/**
 * OP por escola — LOTE 10 (frequência e permanência).
 * Reaproveita o núcleo da Direção (`school-management/attendance-permanence.ts`: studentRate, infrequencyAlert,
 * advance da busca ativa) sobre chamadas oficiais concluídas do Diário. A OP não lança nem corrige chamada.
 * Chamada não realizada (aula prevista na grade sem chamada) é contada à parte e NUNCA vira ausência.
 * Motivo familiar/social sensível nunca sai da escola nem aparece no painel: só categoria declarada.
 */
import { studentRate, infrequencyAlert, advance, type OfficialMark, type EnrollmentWindow, type InfrequencyParams, type Procedure } from "@/features/school-management/attendance-permanence";
import { decideOpAccess, type OpAccessRequest } from "./op-designations";

export interface ExpectedLesson { lessonId: string; classId: string; date: string }
export interface Period { id: string; from: string; to: string }
export interface AttSources { marks: boolean; schedule: boolean; enrollment: boolean; readAt: string | null }

/** Painel da turma: registradas × não realizadas × ausências, por período. Sem grade não há "não realizada". */
export function classAttendancePanel(input: { classId: string; periods: Period[]; marks: OfficialMark[]; expected: ExpectedLesson[]; sources: AttSources }) {
  const s = input.sources;
  if (!s.readAt) return { blocked: "Leitura sem data não vale como painel.", periods: [], limitations: [] };
  if (!s.marks) return { blocked: "Chamadas do Diário não lidas.", periods: [], limitations: [] };
  const lim = ["Frequência só de chamadas oficiais concluídas; sem marcação não é falta."];
  if (!s.schedule) lim.push("Grade não lida: chamadas não realizadas não podem ser apuradas.");
  const periods = input.periods.map((p) => {
    const m = input.marks.filter((x) => x.classId === input.classId && x.date >= p.from && x.date <= p.to);
    const recorded = new Set(m.map((x) => x.lessonId));
    const exp = input.expected.filter((e) => e.classId === input.classId && e.date >= p.from && e.date <= p.to);
    const present = m.filter((x) => x.mark === "presente").length;
    return {
      periodId: p.id, lessonsWithCall: recorded.size,
      callsNotRecorded: s.schedule ? exp.filter((e) => !recorded.has(e.lessonId)).length : null,
      marks: m.length, absences: m.length - present, rate: m.length ? present / m.length : null,
    };
  });
  return { blocked: null, periods, limitations: lim };
}

/** Ausências recorrentes: maior sequência de aulas consecutivas (na ordem das chamadas) com "ausente". */
export function longestAbsenceStreak(marks: OfficialMark[], studentId: string): number {
  const m = marks.filter((x) => x.studentId === studentId).sort((a, b) => (a.date + a.lessonId).localeCompare(b.date + b.lessonId));
  let best = 0, cur = 0;
  for (const x of m) { cur = x.mark === "ausente" ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

/** Painel do estudante autorizado: taxa por período (evolução), sequência, alerta só com parâmetro homologado. */
export function studentAttendancePanel(input: {
  studentId: string; window: EnrollmentWindow; periods: Period[]; marks: OfficialMark[]; params: InfrequencyParams | null;
  access: Omit<OpAccessRequest, "action" | "granularity">; sources: AttSources;
}) {
  const acc = decideOpAccess({ ...input.access, action: "consultar", granularity: "individual" });
  if (!acc.ok) return { blocked: acc.reason } as const;
  if (!input.sources.readAt || !input.sources.marks) return { blocked: "Chamadas do Diário não lidas ou sem data." } as const;
  if (!input.sources.enrollment) return { blocked: "Vigência da matrícula não lida: frequência indeterminada." } as const;
  const mine = input.marks.filter((x) => x.studentId === input.studentId);
  const evolution = input.periods.map((p) => ({ periodId: p.id, ...studentRate(mine, input.window, p) }));
  const whole = input.periods.length ? { from: input.periods[0]!.from, to: input.periods.at(-1)!.to } : null;
  return {
    blocked: null, evolution, longestStreak: longestAbsenceStreak(mine, input.studentId),
    alert: whole ? infrequencyAlert(mine, input.window, whole, input.params) : { alert: false, reason: "sem período" },
    note: "Alerta não é evasão nem reprovação; motivo e providências seguem o processo municipal registrado.",
  } as const;
}

// ── Encaminhamento integrado (reaproveita o procedimento da Direção/Secretaria) ──
export const SENSITIVE_CATEGORIES = ["saude-familiar", "violencia", "trabalho-infantil", "vulnerabilidade-social", "conflito-familiar", "outro-sensivel"] as const;
const SENSITIVE_TEXT = /\b(viol[êe]ncia|abuso|agress|drog|[áa]lcool|pris[ãa]o|preso|conselho tutelar|trabalho infantil|div[óo]rcio|separa[çc][ãa]o|doen[çc]a|interna[çc][ãa]o|gravidez|fome)/i;

export interface Referral {
  procedure: Procedure; to: "secretaria" | "direcao"; byPersonId: string; isNaturalPerson: boolean; on: string;
  reasonCategory: (typeof SENSITIVE_CATEGORIES)[number] | "frequencia" | null; publicNote: string; protocolRef: string | null;
}

/** OP encaminha pela etapa "encaminhamento" do procedimento existente; nota pública não carrega motivo sensível. */
export function referToSector(r: Referral, actorSchoolId: string) {
  if (SENSITIVE_TEXT.test(r.publicNote)) return { ok: false as const, code: "op:motivo-sensivel-no-texto", message: "Motivo familiar/social não vai no texto; selecione a categoria e registre o detalhe no registro restrito da escola." };
  const sector = r.to === "secretaria" ? "secretaria" : "orientacao";
  const res = advance(r.procedure, { step: "encaminhamento", by: r.byPersonId, isNaturalPerson: r.isNaturalPerson, on: r.on, sector, note: r.publicNote }, actorSchoolId);
  if (!res.ok) return { ok: false as const, code: res.code, message: "Encaminhamento recusado pelo processo registrado." };
  return { ok: true as const, procedure: res.procedure, protocolRef: r.protocolRef, reasonCategory: r.reasonCategory, destination: r.to };
}

/** O que outro setor/central vê do encaminhamento: categoria só se não sensível; nunca nota livre. */
export function sharedReferralView(r: { reasonCategory: Referral["reasonCategory"]; destination: string; on: string; protocolRef: string | null }) {
  const sensitive = r.reasonCategory !== null && (SENSITIVE_CATEGORIES as readonly string[]).includes(r.reasonCategory);
  return { destination: r.destination, on: r.on, protocolRef: r.protocolRef, reason: sensitive ? "motivo restrito à escola" : r.reasonCategory ?? "não declarado" };
}

/** Central: só taxa agregada por turma e contagem de chamadas não realizadas; nenhuma linha de estudante. */
export function centralAttendance(panel: ReturnType<typeof classAttendancePanel>, students: number | null) {
  if (panel.blocked) return { state: "não disponível" as const };
  if (students === null || (students > 0 && students < 5)) return { state: "suprimido" as const };
  return { state: "ok" as const, periods: panel.periods.map((p) => ({ periodId: p.periodId, rate: p.rate, callsNotRecorded: p.callsNotRecorded })) };
}
