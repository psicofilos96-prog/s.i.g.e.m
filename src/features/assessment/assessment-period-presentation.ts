/**
 * 6D.3.3.2 — Resolvedores puros de apresentação da Mesa Avaliativa do Período.
 * Só traduzem estados da `AssessmentPeriodProjection` em linguagem humana:
 * nenhum cálculo, nenhuma inferência e nenhum "0" para ausência.
 */
import type {
  PeriodCellProjection,
  PeriodInstrumentProjection,
  PeriodStudentComposition,
} from "./assessment-period-projection";

export type CellPresentation = {
  label: string;
  /** Tom visual discreto; nunca juízo de valor. */
  tone: "fact" | "absent" | "fact-missing" | "muted" | "protected";
  /** Conteúdo longo disponível sob demanda (parecer descritivo, motivo). */
  detail?: string;
  /**
   * Frase textual quando a versão vigente substituiu uma anterior. Derivada da
   * cadeia projetada; não depende de cor, ícone, hover ou comparação de valores.
   */
  correctionNote?: string;
  /** Leitura técnica da versão vigente, apenas para disclosure. */
  versionNote?: string;
};

export const CORRECTED_RESULT_NOTE = "Resultado corrigido";

/** Nome acessível inequívoco para ações de célula (estudante + instrumento). */
export function cellActionAccessibleName(
  actionLabel: string,
  studentName: string,
  instrumentTitle: string,
): string {
  return `${actionLabel} resultado de ${studentName} em ${instrumentTitle}`;
}

export function presentPeriodCell(cell: PeriodCellProjection): CellPresentation {
  switch (cell.state) {
    case "recorded": {
      if (cell.valueDisclosure === "suppressed") return { label: "Valor protegido", tone: "protected" };
      if (cell.currentValue?.kind === "descritiva")
        return { label: "Registro disponível", tone: "fact", detail: cell.currentValue.text };
      return { label: cell.currentDisplayLabel ?? "Registrado", tone: "fact" };
    }
    case "explicitly-unrecorded":
      return {
        label: "Não registrado",
        tone: "fact-missing",
        ...(cell.unrecordedReason ? { detail: cell.unrecordedReason } : {}),
      };
    case "unrecorded":
      return { label: "Sem resultado", tone: "absent" };
    case "not-applicable":
      return { label: "Não se aplica", tone: "muted" };
    case "instrument-unavailable":
      return { label: "Lançamento indisponível", tone: "muted" };
  }
}

export function presentInstrumentCounts(i: PeriodInstrumentProjection): string {
  const c = i.counts;
  const parts = [`${c.recorded} ${c.recorded === 1 ? "registrado" : "registrados"}`];
  if (c.explicitlyUnrecorded > 0) parts.push(`${c.explicitlyUnrecorded} não registrado${c.explicitlyUnrecorded === 1 ? "" : "s"}`);
  parts.push(`${c.unrecorded} sem resultado`);
  if (c.notApplicable > 0) parts.push(`${c.notApplicable} não se aplica${c.notApplicable === 1 ? "" : "m"}`);
  return parts.join(" · ");
}

export const INPUT_KIND_LABELS: Record<string, string> = {
  numerica: "Resultado numérico",
  conceitual: "Conceito",
  descritiva: "Registro descritivo",
};

export type CompositionPresentation = {
  label: string;
  explainable: boolean;
  reasons: readonly string[];
};

export function presentComposition(c: PeriodStudentComposition): CompositionPresentation {
  if (c.kind === "suppressed") return { label: "Valor protegido", explainable: false, reasons: [] };
  if (c.kind === "blocked")
    return { label: "Ainda não é possível calcular", explainable: false, reasons: c.reasons };
  if (!c.stage) return { label: "Ainda não é possível calcular", explainable: true, reasons: [] };
  const value = String(c.stage.value).replace(".", ",");
  return {
    label: c.complete ? value : `${value} (parcial)`,
    explainable: true,
    reasons: c.complete ? [] : ["Ainda faltam registros exigidos pela composição; o valor é acumulado parcial."],
  };
}
