/**
 * Lote corretivo 14 — parâmetros oficiais de Matrículas (EI, EJA, distribuição, avisos, supressão territorial).
 * Versões append-only (0501) só com ato assinado no SIGEM Documentos; vale a última versão APROVADA por pessoa ≠ autor
 * e vigente na data. Sem parâmetro: publicação de campanha que o declarou é recusada (trigger), mas inscrição,
 * atendimento assistido e registros obrigatórios seguem normais. Nada é semeado nem auto-aprovado.
 */
import type { OperationStage } from "./enrollment-operations";

export const ENROLLMENT_PARAMETER_KEYS = [
  "grupos-etarios-educacao-infantil", "idade-minima-eja", "criterio-de-distribuicao", "modelos-de-aviso", "supressao-territorial",
] as const;
export type EnrollmentParameterKey = (typeof ENROLLMENT_PARAMETER_KEYS)[number];

const META: Record<EnrollmentParameterKey, { title: string; summary: string; example: string }> = {
  "grupos-etarios-educacao-infantil": { title: "Educação Infantil — grupos etários", summary: "Data de corte e faixas em meses (creche/pré-escola) sem sobreposição.", example: '{"dataDeCorte":"03-31","faixas":[{"rotulo":"…","deMeses":0,"ateMeses":11,"segmento":"creche"}]}' },
  "idade-minima-eja": { title: "EJA — idade mínima", summary: "Idade mínima em anos e data de referência.", example: '{"fundamentalAnos":15,"dataDeReferencia":"03-31"}' },
  "criterio-de-distribuicao": { title: "Critério de distribuição", summary: "Ordem dos critérios; empate nunca é decidido pelo sistema.", example: '{"ordem":["…"],"empate":"nao-decidir"}' },
  "modelos-de-aviso": { title: "Modelos de aviso", summary: "Textos homologados enviados às famílias, por tipo.", example: '{"modelos":[{"tipo":"…","texto":"…"}]}' },
  "supressao-territorial": { title: "Supressão territorial", summary: "Mínimo por célula no mapa de demanda; abaixo dele o número é ocultado.", example: '{"minimoPorCelula":5}' },
};

export const ENROLLMENT_PARAMETER_STAGES: readonly OperationStage[] = [
  ...ENROLLMENT_PARAMETER_KEYS.map((key): OperationStage => ({
    id: key, title: META[key].title, summary: `${META[key].summary} Exige ato assinado; só vale depois de aprovado por outra pessoa.`,
    reads: [
      { label: "Versões propostas", table: "enr_parameter_versions", columns: ["id", "version", "value", "act_version_id", "valid_from", "created_at"], order: "created_at", eq: { parameter_key: key } },
      { label: "Aprovações", table: "enr_parameter_approvals", columns: ["parameter_version_id", "decision", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: `propor-${key}`, label: "Propor versão", rpc: "record_enr_parameter", keyArg: "_key", fixed: { _parameter: key }, fields: [
        { arg: "_expected", label: "Versão esperada (última lida)", kind: "int", hint: "0 quando ainda não há versão" },
        { arg: "_value", label: "Valor", kind: "json", hint: META[key].example },
        { arg: "_act", label: "Ato (versão assinada no SIGEM Documentos)", kind: "uuid" },
        { arg: "_valid_from", label: "Vigente a partir de", kind: "date" },
        { arg: "_reason", label: "Justificativa (obrigatória a partir da v2)", kind: "text", optional: true },
      ] },
      { id: `aprovar-${key}`, label: "Aprovar versão (outra pessoa)", rpc: "approve_enr_parameter", fields: [
        { arg: "_version", label: "Versão", kind: "uuid" }, { arg: "_decision", label: "Decisão", kind: "text" },
      ] },
    ],
  })),
  {
    id: "dependencias-de-campanha", title: "Dependências de campanha", summary: "A campanha (em rascunho) declara de quais parâmetros depende; publicar ou retomar é recusado enquanto faltar algum aprovado.",
    reads: [{ label: "Dependências declaradas", table: "enr_campaign_parameter_requirements", columns: ["campaign_id", "parameter_key", "created_at"], order: "created_at" }],
    actions: [{ id: "declarar-dependencia", label: "Declarar dependência", rpc: "declare_enr_campaign_parameter", fields: [
      { arg: "_c", label: "Campanha", kind: "uuid" }, { arg: "_parameter", label: "Parâmetro", kind: "select", options: ENROLLMENT_PARAMETER_KEYS },
    ] }],
  },
];

export interface ParameterVersion { id: string; key: EnrollmentParameterKey; version: number; validFrom: string; approved: boolean }

/** Espelho puro de `enr_parameter_in_force`: última versão aprovada com vigência ≤ data. */
export function parameterInForce(versions: readonly ParameterVersion[], key: EnrollmentParameterKey, on: string): ParameterVersion | null {
  return versions.filter((v) => v.key === key && v.approved && v.validFrom <= on).sort((a, b) => b.version - a.version)[0] ?? null;
}

/** Ações que o gate bloqueia: só publicar/retomar campanha. Registros obrigatórios nunca entram aqui. */
export const PARAMETER_GATED_ACTIONS = ["publicar", "retomar"] as const;

export function publicationBlockers(required: readonly EnrollmentParameterKey[], versions: readonly ParameterVersion[], on: string): EnrollmentParameterKey[] {
  return [...new Set(required)].filter((k) => parameterInForce(versions, k, on) === null).sort();
}
