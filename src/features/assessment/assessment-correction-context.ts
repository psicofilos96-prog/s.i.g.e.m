/**
 * 6D.3.4.3b — Fonte única do contexto pós-fechamento da correção de resultado.
 *
 * Pauta, Avaliação do período e revisão em lote montam o contexto do
 * AssessmentCorrectionResolver por aqui: mesmo resultado + agente + capacidades
 * + política + fechamento vigente ⇒ mesma projeção, qualquer que seja a tela.
 * O fechamento altera o CONTEXTO; a consequência é da política.
 */
import type { AssessmentCorrectionInput, AssessmentPeriodClosingFact } from "./assessment-correction";
import { sameCurriculum } from "./assessment-rules";
import type { AssessmentInstrument } from "./assessment-types";
import { closingScopeKey, currentClosing } from "./period-closing";
import { closingFactForCorrection } from "./period-closing-divergence";
import type { PeriodClosingRecord } from "./period-closing-types";

/**
 * Fechamento oficial vigente do contexto acadêmico exato do instrumento:
 * mesma turma, mesmo período e mesmo componente (chaves canônicas do escopo).
 * Nenhuma heurística por título, data textual, cargo ou página.
 */
export function currentClosingForInstrument(
  records: readonly PeriodClosingRecord[],
  instrument: Pick<AssessmentInstrument, "classId" | "periodId" | "curriculumRef">,
): PeriodClosingRecord | undefined {
  const keys = new Set(
    records
      .filter(
        (r) =>
          r.scope.classId === instrument.classId &&
          r.scope.periodId === instrument.periodId &&
          sameCurriculum(r.scope.curriculumRef, instrument.curriculumRef),
      )
      .map((r) => closingScopeKey(r.scope)),
  );
  const current = [...keys].sort().map((key) => currentClosing(records, key)).filter(Boolean);
  return current[0];
}

export type AssessmentCorrectionContext = Omit<AssessmentCorrectionInput, "baseVersionId" | "versions">;

/** Monta o contexto do resolvedor. Sem fechamento vigente, nada é acrescentado. */
export function buildAssessmentCorrectionContext(args: {
  agent: AssessmentCorrectionInput["agent"];
  instrument: Pick<AssessmentInstrument, "id" | "instrumentTypeId" | "status" | "classId" | "periodId" | "curriculumRef">;
  configuration: AssessmentCorrectionInput["configuration"];
  policies: AssessmentCorrectionInput["policies"];
  closingRecords: readonly PeriodClosingRecord[];
  periodLabel: string;
}): AssessmentCorrectionContext {
  const fact = closingFactForCorrection(
    currentClosingForInstrument(args.closingRecords, args.instrument),
    args.periodLabel,
  );
  return {
    agent: args.agent,
    instrument: args.instrument,
    configuration: args.configuration,
    policies: args.policies,
    ...(fact ? { periodClosing: fact } : {}),
  };
}

/** Identidade do fechamento consultado — base da revalidação antes do registro. */
export function closingContextKey(fact: AssessmentPeriodClosingFact | undefined): string {
  return fact ? `${fact.closingId}#${fact.closingVersion}` : "sem-fechamento";
}
