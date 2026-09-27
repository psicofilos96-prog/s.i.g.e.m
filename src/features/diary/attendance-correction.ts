/**
 * Etapa 6D.1.1 — Attendance Correction Resolver.
 *
 * Mini-motor declarativo da correção de chamada. Responde, a partir dos fatos
 * já existentes (chamada registrada, atuação, fechamento oficial de 12H.1 e
 * capacidades do agente), o que é admissível e qual rito a regra canônica
 * exige. A interface apenas PROJETA este resultado.
 *
 * Invariantes:
 * - Não inventa marcação: as admissíveis são exatamente as do domínio
 *   (`Presente`, `Ausente`); "Sem marcação" não é alvo de correção porque o
 *   domínio não demonstra essa operação.
 * - Não inventa competência, motivo obrigatório, documento nem prazo: cada
 *   exigência decorre de uma regra citada em `provenance`.
 * - Chamada em elaboração NÃO é retificada: ela é editada, e a reversão
 *   pertence ao próprio rascunho (Desfazer).
 * - Chamada concluída é imutável: a correção produz versão seguinte encadeada.
 * - Falha fechada: sem regra que autorize, nada é admitido.
 */
import {
  attendanceScopeKey,
  canAttendance,
  currentAttendanceClosing,
  missingAttendanceCapabilityReason,
} from "./attendance-closing";
import {
  ATTENDANCE_CAPABILITY_LABEL,
  type AttendanceClosingActor,
  type AttendanceClosingCapability,
  type PeriodAttendanceClosingRecord,
} from "./attendance-closing-types";
import type { AttendanceMark, AttendanceRecord } from "./attendance";
import type { LessonEntry } from "./lesson-records";

/** Marcações que o domínio da frequência efetivamente admite (12H.1). */
export const ATTENDANCE_CORRECTION_MARKS: readonly AttendanceMark[] = ["Presente", "Ausente"];

export type AttendanceCorrectionImpedimentCode =
  | "sem-chamada-registrada"
  | "chamada-em-elaboracao"
  | "atuacao-de-outro-profissional"
  | "capacidade-ausente";

export type AttendanceCorrectionImpediment = {
  code: AttendanceCorrectionImpedimentCode;
  message: string;
  /** Regra ou fato que sustenta o impedimento (Níveis 2/3 da revelação). */
  provenance: string;
};

export type AttendanceCorrectionRequirement = {
  code: "justificativa" | "documento" | "validacao-posterior";
  label: string;
  provenance: string;
};

export type AttendanceCorrectionEffect = {
  /** Descrição institucional do que a correção produz. */
  description: string;
  nextVersion: number;
  /** Fechamento oficial vigente atingido pela correção, quando houver. */
  affectedClosing?: {
    closingId: string;
    closingVersion: number;
    scopeKey: string;
    periodLabel: string;
  };
};

export type AttendanceCorrectionResolution =
  | { admissible: false; impediments: readonly AttendanceCorrectionImpediment[] }
  | {
      admissible: true;
      admissibleMarks: readonly AttendanceMark[];
      /** Capacidade exigida, quando a regra canônica exigir alguma. */
      requiredCapability?: AttendanceClosingCapability;
      requirements: readonly AttendanceCorrectionRequirement[];
      effect: AttendanceCorrectionEffect;
    };

export type AttendanceCorrectionInput = {
  entry: LessonEntry;
  record: AttendanceRecord | undefined;
  actor: AttendanceClosingActor;
  /** Profissional que opera a chamada nesta sessão demonstrativa. */
  operatingProfessionalId: string;
  closings?: readonly PeriodAttendanceClosingRecord[];
};

function coveringClosing(
  entryId: string,
  closings: readonly PeriodAttendanceClosingRecord[],
): PeriodAttendanceClosingRecord | undefined {
  const scopeKeys = new Set(closings.map((item) => attendanceScopeKey(item.scope)));
  for (const scopeKey of scopeKeys) {
    const current = currentAttendanceClosing(closings, scopeKey);
    if (current?.lessonEntryIds.includes(entryId)) return current;
  }
  return undefined;
}

export function resolveAttendanceCorrection(
  input: AttendanceCorrectionInput,
): AttendanceCorrectionResolution {
  const { entry, record, actor, operatingProfessionalId } = input;
  const closings = input.closings ?? [];
  const impediments: AttendanceCorrectionImpediment[] = [];

  if (!record)
    impediments.push({
      code: "sem-chamada-registrada",
      message: "Não há chamada registrada nesta aula para corrigir.",
      provenance: "Nenhum registro de frequência associado ao registro de aula.",
    });
  else if (!record.concluded)
    impediments.push({
      code: "chamada-em-elaboracao",
      message: "Esta chamada ainda está em elaboração: a marcação é alterada na própria edição.",
      provenance:
        "Retificação versionada só existe depois da conclusão da chamada (12H.1); antes disso a edição é ordinária.",
    });

  if (entry.professionalId !== operatingProfessionalId)
    impediments.push({
      code: "atuacao-de-outro-profissional",
      message:
        "A atuação pedagógica desta aula pertence a outro profissional; a correção é feita por quem responde pelo registro.",
      provenance: `Atuação pedagógica registrada: ${entry.assignmentId}.`,
    });

  const closing = record ? coveringClosing(entry.id, closings) : undefined;
  const requiredCapability: AttendanceClosingCapability | undefined = closing
    ? "executar-retificacao-de-frequencia"
    : undefined;

  if (requiredCapability && !canAttendance(actor, requiredCapability))
    impediments.push({
      code: "capacidade-ausente",
      message: missingAttendanceCapabilityReason(requiredCapability),
      provenance: `Capacidade exigida: ${ATTENDANCE_CAPABILITY_LABEL[requiredCapability]}. Fechamento vigente: ${closing?.id} (versão ${closing?.version}).`,
    });

  if (impediments.length || !record) return { admissible: false, impediments };

  const requirements: AttendanceCorrectionRequirement[] = closing
    ? [
        {
          code: "justificativa",
          label: "Justificativa da retificação",
          provenance: `Exigida porque a chamada integra o fechamento oficial ${closing.id} (versão ${closing.version}), cuja revisão registra justificativa e autorização.`,
        },
      ]
    : [];

  const effect: AttendanceCorrectionEffect = {
    description: closing
      ? "A correção produz a versão seguinte da chamada e uma retificação pontual encadeada ao fechamento oficial vigente, sem apagar a versão anterior."
      : "A correção produz a versão seguinte da chamada concluída, encadeada à anterior, que permanece consultável no histórico.",
    nextVersion: (record.version ?? 1) + 1,
    ...(closing
      ? {
          affectedClosing: {
            closingId: closing.id,
            closingVersion: closing.version,
            scopeKey: attendanceScopeKey(closing.scope),
            periodLabel: closing.periodLabel,
          },
        }
      : {}),
  };

  return {
    admissible: true,
    admissibleMarks: ATTENDANCE_CORRECTION_MARKS,
    ...(requiredCapability ? { requiredCapability } : {}),
    requirements,
    effect,
  };
}

/** A correção só é submetida quando cada exigência projetada está atendida. */
export function attendanceCorrectionSubmissionIssues(
  resolution: AttendanceCorrectionResolution,
  submission: { mark: AttendanceMark | null; justification?: string },
): string[] {
  if (!resolution.admissible) return resolution.impediments.map((item) => item.message);
  const issues: string[] = [];
  if (!submission.mark || !resolution.admissibleMarks.includes(submission.mark))
    issues.push("Informe a nova marcação entre as admitidas pela regra vigente.");
  for (const requirement of resolution.requirements)
    if (requirement.code === "justificativa" && !submission.justification?.trim())
      issues.push("Informe a justificativa exigida para a retificação.");
  return issues;
}
