/**
 * 6D.3.2.5-B — Fixture DEMONSTRATIVA do laboratório de campo (35 estudantes).
 * Não é dado da rede: nomes curtos e longos, dois homônimos, cinco resultados
 * oficiais preexistentes e três estudantes sem vínculo na data de aplicação.
 */
import type { InstrumentEntryRosterStudent } from "./assessment-entry-projection";
import { assessmentLogicalEntryId, type AssessmentEntryVersion } from "./assessment-entry-versions";
import type { AcademicPlacement } from "./assessment-types";

const NAMES = [
  "Ana Clara Souza", "Bia Lima", "Caio Rocha", "Ana Clara Souza",
  "Daniela Cristina de Albuquerque Vasconcelos Monteiro", "Enzo Reis", "Fernanda Alves",
  "Gabriel Henrique dos Santos Nascimento Ferreira", "Heitor Dias", "Isabela Moura",
  "João Pedro Martins", "Kauã Silva", "Larissa Gomes", "Lia Pinto",
  "Maria Eduarda Figueiredo de Carvalho Bittencourt", "Mariana Alves", "Miguel Costa",
  "Nicolas Barros", "Olívia Teixeira", "Pedro Lucas Araújo", "Rafael Nunes",
  "Sofia Mendes", "Théo Ramos", "Valentina Correia", "Vitor Hugo Cardoso",
  "Yasmin Freitas", "Zoe Castro", "Arthur Lopes", "Bernardo Pires", "Cecília Duarte",
  "Davi Lucca Moreira", "Eloá Batista", "Felipe Antunes", "Giovanna Campos", "Ícaro Melo",
] as const;

/** Índices (0-based) sem vínculo na data de aplicação. */
const NOT_APPLICABLE = new Set([6, 17, 29]);
/** Índices com resultado oficial preexistente e seu valor. */
const OFFICIAL: Record<number, number> = { 1: 70, 9: 85, 15: 70, 22: 60, 30: 90 };

export const FIELD_LAB_INSTRUMENT_ID = "ins-demo-001";

function placement(studentId: string, classId: string, from: string): AcademicPlacement {
  return {
    studentId,
    enrollmentId: `mat-lab-${studentId}`,
    unitId: "uni-001",
    academicLinkId: `vin-lab-${studentId}`,
    participationId: `par-lab-${studentId}`,
    participationNature: "regular",
    allocationId: `ent-lab-${studentId}`,
    classId,
    from,
    until: null,
  };
}

export function fieldLabStudents(classId: string): InstrumentEntryRosterStudent[] {
  return NAMES.map((displayName, i) => {
    const studentId = `alu-lab-${String(i + 1).padStart(2, "0")}`;
    return {
      studentId,
      displayName,
      rollNumber: i + 1,
      identityDiscriminator: `Código SIGEM 2026-${String(4100 + i * 7).padStart(5, "0")}`,
      placements: [placement(studentId, classId, NOT_APPLICABLE.has(i) ? "2026-04-01" : "2026-02-01")],
    };
  });
}

/** Ensaios do laboratório (6D.3.2.7): naturezas de lançamento DEMONSTRATIVAS. */
export type FieldLabMode = "numerica" | "conceitual" | "descritiva";

/** Escala conceitual DEMONSTRATIVA — fixture, não taxonomia do SIGEM. */
export const FIELD_LAB_CONCEPT_OPTIONS = [
  { id: "cdemo-a", label: "Alcançou plenamente" },
  { id: "cdemo-b", label: "Alcançou" },
  { id: "cdemo-c", label: "Em construção" },
  { id: "cdemo-d", label: "Não alcançou" },
] as const;

const DESCRIPTIVE_SEED = [
  "Participou das atividades propostas e relatou com clareza as etapas do experimento.",
  "Apresentou o trabalho em grupo; precisou de apoio para organizar a conclusão escrita.",
];

function officialValue(mode: FieldLabMode, n: number, k: number): AssessmentEntryVersion["value"] {
  if (mode === "numerica") return { kind: "numerica", value: n };
  if (mode === "conceitual")
    return { kind: "conceitual", optionId: FIELD_LAB_CONCEPT_OPTIONS[k % FIELD_LAB_CONCEPT_OPTIONS.length]!.id };
  return { kind: "descritiva", text: DESCRIPTIVE_SEED[k % DESCRIPTIVE_SEED.length]! };
}

export function fieldLabOfficialVersions(instrumentId: string, mode: FieldLabMode = "numerica"): AssessmentEntryVersion[] {
  return Object.entries(OFFICIAL).map(([i, value], k) => {
    const studentId = `alu-lab-${String(Number(i) + 1).padStart(2, "0")}`;
    return {
      id: `ver-${instrumentId}-${studentId}-1`,
      logicalEntryId: assessmentLogicalEntryId(instrumentId, studentId),
      version: 1,
      instrumentId,
      studentId,
      status: "registrado",
      value: officialValue(mode, value, k),
      recordedAt: "2026-03-11T12:00:00.000Z",
      recordedBy: {
        professionalId: "pro-006",
        pedagogicalAssignmentId: "atp-001",
        displayName: "Profissional Fictício Fábio Ribeiro",
        at: "2026-03-11T12:00:00.000Z",
      },
    } as AssessmentEntryVersion;
  });
}
