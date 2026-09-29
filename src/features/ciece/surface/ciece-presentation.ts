/**
 * 14.4 — Apresentação das respostas da fronteira 14.3.
 *
 * Só traduz estados e formata números JÁ calculados. Nenhuma taxa, percentual,
 * contagem, comparação ou regra de divulgação nasce aqui.
 */
import type { AnalyticResponse, DisclosedGroup } from "../analytic-boundary";

export type SurfaceStateId =
  | "calculado"
  | "zero-observado"
  | "populacao-vazia"
  | "sem-fatos-disponiveis"
  | "cobertura-incompleta"
  | "indeterminado"
  | "suprimido-por-politica"
  | "nao-divulgavel"
  | "calculo-recusado"
  | "nao-autorizado"
  | "divulgacao-indisponivel";

export type StatePresentation = {
  label: string;
  sentence: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
  /** Marca textual: o estado nunca depende só de cor. */
  marker: string;
  showsValue: boolean;
};

export const STATE_PRESENTATION: Record<SurfaceStateId, StatePresentation> = {
  calculado: { label: "Calculado", sentence: "Valor calculado sobre os registros oficiais do recorte.", tone: "success", marker: "●", showsValue: true },
  "zero-observado": { label: "Zero observado", sentence: "Havia população e registros; o valor observado é zero.", tone: "neutral", marker: "0", showsValue: true },
  "populacao-vazia": { label: "Sem população no recorte", sentence: "Nenhum sujeito pertence a esta população no recorte escolhido. Não é zero: não há sobre quem calcular.", tone: "neutral", marker: "∅", showsValue: false },
  "sem-fatos-disponiveis": { label: "Nenhum registro disponível", sentence: "Existe população, mas nenhum registro oficial foi encontrado para ela. Nada foi presumido.", tone: "warning", marker: "?", showsValue: false },
  "cobertura-incompleta": { label: "Cobertura incompleta", sentence: "Parte da população não tem registro oficial. O valor considera apenas quem foi observado.", tone: "warning", marker: "◐", showsValue: true },
  indeterminado: { label: "Indeterminado", sentence: "Os registros existentes não permitem concluir um valor.", tone: "warning", marker: "≈", showsValue: false },
  "suprimido-por-politica": { label: "Suprimido", sentence: "Omitido pela política de divulgação para proteger pessoas identificáveis.", tone: "info", marker: "▨", showsValue: false },
  "nao-divulgavel": { label: "Não divulgável", sentence: "A política de divulgação não admite este nível de detalhe.", tone: "info", marker: "⊘", showsValue: false },
  "calculo-recusado": { label: "Cálculo recusado", sentence: "O motor recusou o cálculo com esta combinação de recorte e dimensões.", tone: "danger", marker: "✕", showsValue: false },
  "nao-autorizado": { label: "Sem autorização", sentence: "Sua atuação vigente não inclui autorização para esta consulta neste escopo.", tone: "neutral", marker: "🔒", showsValue: false },
  "divulgacao-indisponivel": { label: "Divulgação sem regra homologada", sentence: "A rede ainda não homologou a regra de divulgação; nenhum número pode ser exibido.", tone: "info", marker: "§", showsValue: false },
};

export function groupStateId(g: DisclosedGroup): SurfaceStateId {
  if (g.state === "calculado" && g.value === 0) return "zero-observado";
  return g.state;
}

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Formata valor pronto; `null` nunca vira 0 nem traço. */
export function formatValue(value: number | null, unit: string): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return unit === "%" ? `${fmt.format(value)}%` : fmt.format(value);
}

export function formatUnit(unit: string): string | null {
  return unit === "%" ? null : unit;
}

export type ResponseView =
  | { kind: "estado"; stateId: SurfaceStateId; technical: string }
  | { kind: "respondido"; total: DisclosedGroup | null; response: Extract<AnalyticResponse, { state: "respondido" }> };

export function viewResponse(r: AnalyticResponse): ResponseView {
  switch (r.state) {
    case "nao-autorizado":
    case "divulgacao-indisponivel":
    case "nao-divulgavel":
      return { kind: "estado", stateId: r.state, technical: r.reason };
    case "calculo-recusado":
      return { kind: "estado", stateId: "calculo-recusado", technical: `${r.code}: ${r.detail}` };
    case "respondido":
      return { kind: "respondido", total: r.groupBy === null ? (r.groups[0] ?? null) : null, response: r };
  }
}

export const DIMENSION_LABELS: Readonly<Record<string, string>> = {
  situacaoAcademicaId: "Situação acadêmica",
  schoolId: "Escola",
  classId: "Turma",
  componentId: "Componente curricular",
  periodId: "Período",
  cycleId: "Ciclo",
  schoolDistrict: "Distrito",
  schoolLocationKind: "Localização (urbana/rural)",
};

export function dimensionLabel(id: string): string {
  return DIMENSION_LABELS[id] ?? "Dimensão declarada pela fonte";
}

export const TEMPORAL_LABELS = {
  fotografia: "Data de referência",
  intervalo: "Intervalo",
  periodo: "Período letivo",
  ciclo: "Ciclo",
} as const;
