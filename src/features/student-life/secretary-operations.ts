/**
 * Secretaria Escolar — projeções puras sobre a cadeia B3 lida pelos readers bitemporais.
 * Nada aqui grava, nada é persistido e nenhuma taxonomia é criada: situação, trajetória e
 * disponibilidade são PROJEÇÕES dos fatos lidos. Ausência permanece ausência.
 */
import type {
  CapacityOccupancy, ClassAllocationAtRow, CycleEnrollmentAtRow, CycleParticipationRow,
} from "./cycle-enrollment-source";

export type MovementRow = {
  id: string; logical_id: string; version: number; supersedes_id: string | null; student_id: string;
  enrollment_id: string | null; movement_type_id: string; movement_type_version: number; effective_on: string;
  origin: Record<string, unknown> | null; destination: Record<string, unknown> | null;
  reason_code: string | null; reason_text: string | null; originating_act_ref: string | null;
  correction_reason: string | null; created_at: string;
};

const within = (from: string | null, until: string | null, on: string) => (!from || from <= on) && (!until || until >= on);

// ------------------------------------------------------------ disponibilidade

/**
 * Capacidade configurada, ocupação factual e disponibilidade derivada são três coisas.
 * Sem capacidade registrada a disponibilidade é DESCONHECIDA — nunca zero, nunca "livre".
 * Excesso é só o número factual; nenhum efeito (bloqueio, "turma cheia") é aplicado.
 */
export type Availability =
  | { kind: "desconhecida"; occupancy: number }
  | { kind: "derivada"; limit: number; occupancy: number; remaining: number; exceededBy: number };
export function deriveAvailability(co: CapacityOccupancy): Availability {
  if (co.capacity.status !== "registrada") return { kind: "desconhecida", occupancy: co.occupancy };
  const limit = co.capacity.referenceLimit;
  const diff = limit - co.occupancy;
  return { kind: "derivada", limit, occupancy: co.occupancy, remaining: Math.max(diff, 0), exceededBy: Math.max(-diff, 0) };
}

// ------------------------------------------------------------ trajetória

export type TrajectoryEvent = {
  date: string; recordedAt: string;
  kind: "inscricao-aberta" | "inscricao-encerrada" | "participacao-inicio" | "participacao-fim" | "alocacao-inicio" | "alocacao-fim" | "movimentacao";
  ref: string; detail: Record<string, string | number | null>;
};
export function buildTrajectory(
  studentId: string,
  src: { enrollments: readonly CycleEnrollmentAtRow[]; participations: readonly CycleParticipationRow[]; allocations: readonly ClassAllocationAtRow[]; movements: readonly MovementRow[] },
): TrajectoryEvent[] {
  const ev: TrajectoryEvent[] = [];
  for (const e of src.enrollments.filter((x) => x.student_id === studentId)) {
    // Abertura sem data registrada não ganha data inventada: fica fora da linha do tempo datada.
    if (e.opened_on) ev.push({ date: e.opened_on, recordedAt: e.created_at, kind: "inscricao-aberta", ref: e.logical_id, detail: { escola: e.school_id, ano: e.academic_year_id } });
    if (e.ended_on) ev.push({ date: e.ended_on, recordedAt: e.created_at, kind: "inscricao-encerrada", ref: e.logical_id, detail: { situacao: e.bond_status_value_id, motivo: e.ending_reason } });
  }
  for (const p of src.participations.filter((x) => x.student_id === studentId && !x.annulled)) {
    ev.push({ date: p.valid_from, recordedAt: p.created_at, kind: "participacao-inicio", ref: p.logical_id, detail: { natureza: p.nature_value_id, versao: p.version } });
    if (p.valid_until) ev.push({ date: p.valid_until, recordedAt: p.created_at, kind: "participacao-fim", ref: p.logical_id, detail: { motivo: p.change_reason } });
  }
  for (const a of src.allocations.filter((x) => x.student_id === studentId)) {
    ev.push({ date: a.valid_from, recordedAt: a.created_at, kind: "alocacao-inicio", ref: a.logical_id, detail: { turma: a.class_label_snapshot ?? a.class_id } });
    if (a.ended_on) ev.push({ date: a.ended_on, recordedAt: a.created_at, kind: "alocacao-fim", ref: a.logical_id, detail: { turma: a.class_label_snapshot ?? a.class_id, motivo: a.ending_reason } });
  }
  for (const m of src.movements.filter((x) => x.student_id === studentId)) {
    ev.push({ date: m.effective_on, recordedAt: m.created_at, kind: "movimentacao", ref: m.logical_id, detail: { tipo: m.movement_type_id, versao: m.version, origem: str(m.origin?.["schoolId"]), destino: str(m.destination?.["schoolId"]) } });
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.recordedAt.localeCompare(b.recordedAt));
}
const str = (v: unknown) => (typeof v === "string" ? v : null);

// ------------------------------------------------------------ busca operacional

/** Situação é projeção na data, não catálogo: a situação do vínculo homologada continua no fato. */
export type OperationalSituation = "vigente-com-turma" | "vigente-sem-turma" | "vigente-sem-participacao" | "encerrada" | "futura";
export type SecretaryRow = {
  enrollmentLogicalId: string; studentId: string; academicYearId: string | null;
  situation: OperationalSituation; classIds: string[]; bondStatus: string | null;
};
export function secretaryRows(
  on: string,
  src: { enrollments: readonly CycleEnrollmentAtRow[]; participations: readonly CycleParticipationRow[]; allocations: readonly ClassAllocationAtRow[] },
): SecretaryRow[] {
  return src.enrollments.map((e) => {
    const parts = src.participations.filter((p) => p.enrollment_logical_id === e.logical_id && !p.annulled && within(p.valid_from, p.valid_until, on));
    const partIds = new Set(parts.map((p) => p.logical_id));
    const allocs = src.allocations.filter((a) => a.participation_logical_id && partIds.has(a.participation_logical_id) && within(a.valid_from, a.ended_on, on));
    let situation: OperationalSituation;
    if (e.opened_on && e.opened_on > on) situation = "futura";
    else if (e.ended_on && e.ended_on < on) situation = "encerrada";
    else if (!parts.length) situation = "vigente-sem-participacao";
    else situation = allocs.length ? "vigente-com-turma" : "vigente-sem-turma";
    return {
      enrollmentLogicalId: e.logical_id, studentId: e.student_id, academicYearId: e.academic_year_id,
      situation, classIds: [...new Set(allocs.map((a) => a.class_id))], bondStatus: e.bond_status_value_id,
    };
  });
}
export type SecretaryFilter = { text?: string | undefined; classId?: string | undefined; academicYearId?: string | undefined; situation?: OperationalSituation | undefined };
export function filterSecretaryRows(rows: readonly SecretaryRow[], f: SecretaryFilter, nameOf: (id: string) => string | null = () => null) {
  const q = f.text?.trim().toLocaleLowerCase("pt-BR");
  return rows.filter((r) =>
    (!q || r.studentId.toLowerCase().includes(q) || (nameOf(r.studentId) ?? "").toLocaleLowerCase("pt-BR").includes(q)) &&
    (!f.classId || r.classIds.includes(f.classId)) &&
    (!f.academicYearId || r.academicYearId === f.academicYearId) &&
    (!f.situation || r.situation === f.situation));
}

export const SITUATION_LABEL: Record<OperationalSituation, string> = {
  "vigente-com-turma": "Vigente, com turma",
  "vigente-sem-turma": "Vigente, sem turma",
  "vigente-sem-participacao": "Vigente, sem participação declarada",
  encerrada: "Encerrada",
  futura: "Começa depois da data",
};
export const TRAJECTORY_LABEL: Record<TrajectoryEvent["kind"], string> = {
  "inscricao-aberta": "Inscrição letiva aberta",
  "inscricao-encerrada": "Inscrição letiva encerrada",
  "participacao-inicio": "Participação educacional iniciada",
  "participacao-fim": "Participação educacional encerrada",
  "alocacao-inicio": "Alocação em turma iniciada",
  "alocacao-fim": "Alocação em turma encerrada",
  movimentacao: "Movimentação registrada",
};
