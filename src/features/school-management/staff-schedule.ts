// SIGEM 2.0 — Direção, Lote 05: pessoal, necessidade docente e horários (núcleo puro).
// Reusa findConflicts (NHOR.2) e os relatórios X.1 (staffing/teacher-need-reports); nunca grava ato de RH.
import { findConflicts, type GridBlock } from "@/features/schedules/schedule-conflicts";
export { TOTAL_AULAS_OFERTADAS, TOTAL_AULAS_REDE, NECESSIDADE_PROFESSOR } from "@/features/staffing/teacher-need-reports";

export interface StaffFact {
  personId: string; schoolId: string; positionLabel: string | null; // cargo = rótulo, não autoridade
  exercise: { from: string; to: string | null } | null; // exercício temporal (DP)
  source: "funcional" | "planilha-historica"; // planilha 2026 é histórico, nunca lotação atual
  journeyHours: number | null; journeySourced: boolean; shifts: string[];
  leaves: { from: string; to: string | null; kind: string }[]; // afastamentos registrados
  communicatedAbsences: { on: string }[];
}

/** Em exercício na data só com fonte funcional e vigência; afastado aparece como tal; jornada sem fonte ⇒ null. */
export function staffPanel(rows: StaffFact[], schoolId: string, on: string) {
  return rows.filter((r) => r.schoolId === schoolId).map((r) => {
    if (r.source !== "funcional") return { personId: r.personId, status: "histórico (não é lotação atual)" as const };
    if (!r.exercise) return { personId: r.personId, status: "exercício não registrado" as const };
    const active = r.exercise.from <= on && (r.exercise.to == null || on <= r.exercise.to);
    if (!active) return { personId: r.personId, status: r.exercise.from > on ? ("futuro" as const) : ("encerrado" as const) };
    const leave = r.leaves.find((l) => l.from <= on && (l.to == null || on <= l.to));
    return { personId: r.personId, status: leave ? ("afastado" as const) : ("em exercício" as const), leaveKind: leave?.kind ?? null,
      cargo: r.positionLabel ?? "não registrado", jornada: r.journeySourced ? r.journeyHours : null, turnos: r.shifts,
      ausenciaComunicadaHoje: r.communicatedAbsences.some((a) => a.on === on) };
  });
}

/** Carga por componente: exigida da grade, atribuída da regência; descoberta só se ambas lidas. */
export function loadByComponent(required: Record<string, number | null>, assigned: Record<string, number | null>) {
  return Object.keys({ ...required, ...assigned }).map((c) => {
    const req = required[c] ?? null, asg = assigned[c] ?? null;
    return { component: c, exigida: req, atribuida: asg, descoberta: req == null || asg == null ? null : Math.max(0, req - asg) };
  });
}

/** Quadro: conflitos factuais + lacunas = bloco registrado sem pessoa (nunca bloco inferido). */
export function scheduleBoard(blocks: GridBlock[]) {
  return { conflicts: findConflicts(blocks), gaps: blocks.filter((b) => b.personIds.length === 0).map((b) => b.blockId) };
}

// ── Pedido de cobertura / demanda ao RH (protocolo; ato só no DP) ──
export interface CoverageRequest { protocol: string; schoolId: string; requestedBy: string; reason: string; blockIds: string[];
  status: "aberto" | "atendido" | "indeferido"; resolution?: { by: string; actRef: string | null; note: string } }

export function openCoverage(r: { protocol: string; schoolId: string; requestedBy: string; isNaturalPerson: boolean; reason: string; blockIds: string[] }, existing: CoverageRequest[]) {
  if (!r.isNaturalPerson) return { ok: false as const, code: "cobertura:autor-humano-obrigatorio" };
  if (!r.reason.trim() || !r.blockIds.length) return { ok: false as const, code: "cobertura:motivo-e-blocos-obrigatorios" };
  const dup = existing.find((e) => e.protocol === r.protocol);
  if (dup) return { ok: true as const, request: dup, idempotent: true };
  return { ok: true as const, request: { protocol: r.protocol, schoolId: r.schoolId, requestedBy: r.requestedBy, reason: r.reason, blockIds: r.blockIds, status: "aberto" } as CoverageRequest, idempotent: false };
}

/** Só o DP (capacidade) resolve; "atendido" exige referência ao ato funcional real; Direção nunca efetiva. */
export function resolveCoverage(r: CoverageRequest, by: string, capabilities: string[], outcome: "atendido" | "indeferido", actRef: string | null, note: string) {
  if (!capabilities.includes("manter-vida-funcional")) return { ok: false as const, code: "cobertura:setor-nao-competente" };
  if (by === r.requestedBy) return { ok: false as const, code: "cobertura:autodecisao" };
  if (r.status !== "aberto") return { ok: false as const, code: "cobertura:encerrado" };
  if (outcome === "atendido" && !actRef) return { ok: false as const, code: "cobertura:sem-ato-funcional" };
  if (outcome === "indeferido" && !note.trim()) return { ok: false as const, code: "cobertura:motivo-obrigatorio" };
  return { ok: true as const, request: { ...r, status: outcome, resolution: { by, actRef, note } } };
}
