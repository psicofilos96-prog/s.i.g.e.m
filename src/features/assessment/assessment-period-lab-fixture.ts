/**
 * 6D.3.3.2 (auditoria) — Laboratório DEMONSTRATIVO da matriz do período.
 * Três instrumentos fictícios adicionais na turma do laboratório de campo, para
 * observar a Avaliação do período com quatro colunas. Valores, títulos e datas
 * são dados de laboratório; nada aqui é regra do produto.
 */
import { instrumentFixtures } from "./assessment-fixtures";
import { ASSESSMENT_CHANGE_ASPECTS, assessmentLogicalEntryId, type AssessmentEntryVersion } from "./assessment-entry-versions";
import type { AssessmentInstrument, EntryValue } from "./assessment-types";

const base = instrumentFixtures.find((i) => i.id === "ins-demo-001")!;

function labInstrument(id: string, title: string, appliedOn: string): AssessmentInstrument {
  return { ...structuredClone(base), id, title, appliedOn };
}

export const PERIOD_LAB_INSTRUMENTS: readonly AssessmentInstrument[] = [
  labInstrument("ins-lab-p02", "Prova", "2026-03-24"),
  labInstrument(
    "ins-lab-p03",
    "Projeto interdisciplinar de produção textual e apresentação oral sobre o bairro",
    "2026-04-14",
  ),
  labInstrument("ins-lab-p04", "Seminário em grupo", "2026-05-05"),
];

const sid = (i: number) => `alu-lab-${String(i + 1).padStart(2, "0")}`;

type Seed = { i: number; value: EntryValue; corrected?: number };

/** Sementes por instrumento: índice do estudante (0-based) → fato oficial. */
const SEEDS: Record<string, Seed[]> = {
  "ins-lab-p02": [
    ...[0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => ({ i, value: { kind: "numerica", value: 50 + ((i * 7) % 50) } as EntryValue })),
    { i: 16, value: { kind: "nao-registrado", reason: "Não realizou o instrumento" } },
    { i: 20, value: { kind: "numerica", value: 55 }, corrected: 65 },
  ],
  "ins-lab-p03": [
    ...[0, 3, 4, 7, 14].map((i) => ({ i, value: { kind: "numerica", value: 80 } as EntryValue })),
    { i: 21, value: { kind: "nao-registrado", reason: "Afastamento registrado no período" } },
  ],
  "ins-lab-p04": [],
};

const stamp = (at: string) => ({
  professionalId: "pro-006",
  pedagogicalAssignmentId: "atp-001",
  displayName: "Profissional Fictício Fábio Ribeiro",
  at,
});

export function periodLabVersions(instrumentId: string): AssessmentEntryVersion[] {
  const seeds = SEEDS[instrumentId];
  if (!seeds) return [];
  return seeds.flatMap(({ i, value, corrected }) => {
    const studentId = sid(i);
    const v1 = {
      id: `ver-${instrumentId}-${studentId}-1`,
      logicalEntryId: assessmentLogicalEntryId(instrumentId, studentId),
      version: 1,
      instrumentId,
      studentId,
      status: "registrado",
      value,
      recordedAt: "2026-05-06T12:00:00.000Z",
      recordedByAssignmentId: "atp-001",
      recordedBy: stamp("2026-05-06T12:00:00.000Z"),
    } as unknown as AssessmentEntryVersion;
    if (corrected === undefined) return [v1];
    const v2 = {
      ...v1,
      id: `ver-${instrumentId}-${studentId}-2`,
      version: 2,
      supersedesVersionId: v1.id,
      value: { kind: "numerica", value: corrected },
      recordedAt: "2026-05-07T12:00:00.000Z",
      recordedBy: stamp("2026-05-07T12:00:00.000Z"),
      rectification: {
        actedAt: "2026-05-07T12:00:00.000Z",
        agentId: "pro-006",
        policyId: "pol-demo-correcao-laboratorio",
        policyVersion: 1,
        policyLabel: "Correção de resultado — política demonstrativa do laboratório",
        satisfiedRequirements: [],
        justification: "Soma de questões revisada (laboratório).",
        changedAspects: [ASSESSMENT_CHANGE_ASPECTS.value],
      },
    } as unknown as AssessmentEntryVersion;
    return [v1, v2];
  });
}
