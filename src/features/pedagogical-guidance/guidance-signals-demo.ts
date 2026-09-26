/**
 * Etapa 13H — Detecção e materialização DEMONSTRATIVAS de sinais.
 *
 * A cadeia é sempre `definição → avaliação → ocorrência`: a avaliação registra o
 * que a regra encontrou com os fatos disponíveis, e a ocorrência congela a versão
 * da definição e o retrato dos fatos. Alterar a configuração cria nova versão e
 * novas avaliações — nunca reescreve ocorrência histórica.
 */
import {
  attendanceSignalDefinitionV1,
  demonstrationGuidanceFacts,
} from "./guidance-fixtures";
import { evaluateSignal, materializeOccurrence } from "./signal-engine";
import type {
  PedagogicalSignalOccurrence,
  PedagogicalSubjectReference,
  SignalEvaluation,
} from "./guidance-types";

const subjectsOf = (studentId: string): readonly PedagogicalSubjectReference[] => [
  {
    subjectRoleDefinitionId: "estudante-avaliado",
    reference: { entityKindDefinitionId: "aluno", entityId: studentId },
  },
];

/** Avaliações demonstrativas, incluindo o caso de fato indisponível. */
export function buildDemonstrationSignalEvaluations(): readonly SignalEvaluation[] {
  return [
    evaluateSignal({
      definition: attendanceSignalDefinitionV1,
      subjects: subjectsOf("alu-001"),
      evaluationContext: { cicloId: "ciclo-demo-2027", turmaId: "tur-001" },
      facts: demonstrationGuidanceFacts["alu-001"] ?? [],
      evaluatedAt: "2027-03-01T08:00:00.000Z",
      evaluationId: "aval-sinal-demo-001",
    }),
    evaluateSignal({
      definition: attendanceSignalDefinitionV1,
      subjects: subjectsOf("alu-002"),
      evaluationContext: { cicloId: "ciclo-demo-2027" },
      facts: demonstrationGuidanceFacts["alu-002"] ?? [],
      evaluatedAt: "2027-03-01T08:00:00.000Z",
      evaluationId: "aval-sinal-demo-002",
    }),
  ];
}

/** Ocorrências históricas: só a condição satisfeita por definição homologada. */
export function buildDemonstrationSignalOccurrences(): readonly PedagogicalSignalOccurrence[] {
  const occurrences: PedagogicalSignalOccurrence[] = [];
  const evaluations = buildDemonstrationSignalEvaluations();
  let sequence = 0;
  for (const evaluation of evaluations) {
    sequence += 1;
    const occurrence = materializeOccurrence({
      evaluation,
      definition: attendanceSignalDefinitionV1,
      occurrenceId: `ocr-sinal-demo-00${sequence}`,
      materializedAt: "2027-03-01T08:30:00.000Z",
      scopeEntities: [
        { entityKindDefinitionId: "escopo-unidade-escolar", entityId: "demo-001" },
        { entityKindDefinitionId: "escopo-turma", entityId: "tur-001" },
      ],
      provenance: {
        originTypeId: "apuracao-automatica-de-condicao-configurada",
        recordedAt: "2027-03-01T08:30:00.000Z",
      },
    });
    if (occurrence) occurrences.push(occurrence);
  }
  return occurrences;
}
