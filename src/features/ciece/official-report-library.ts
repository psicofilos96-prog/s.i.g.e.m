/**
 * CIECE Lote 13 — Biblioteca de relatórios oficiais. Reaproveita o motor comum
 * (`reports/report-engine.ts`: runReport, toCsv, toXlsx, toPdfFile A4, toPrintableHtml) e as
 * definições existentes (Aulas Ofertadas/da Rede, Necessidade de Professor, Ficha longitudinal).
 * Os demais relatórios são definições novas cujas linhas vêm SÓ das projeções CIECE já testadas
 * (L02–L12); nenhuma fórmula nova. Cada relatório carrega metodologia reproduzível e as exportações
 * repetem metodologia + parâmetros + impressão digital no cabeçalho.
 */
import type { CellValue, ColumnDef, ReportDefinition, ReportResult } from "@/features/reports/report-engine";
import { runReport } from "@/features/reports/report-engine";
import { NECESSIDADE_PROFESSOR, TOTAL_AULAS_OFERTADAS, TOTAL_AULAS_REDE } from "@/features/staffing/teacher-need-reports";
import { FICHA_LONGITUDINAL } from "@/features/school-followup/student-trajectory-source";
import type { SituationResult } from "./student-situation-conference";
import type { CorrectionCase } from "./correction-desk";
import { stateOf, declared } from "./correction-desk";
import type { Snapshot } from "./historical-snapshots";
import type { ChecklistItem } from "./census-cycles";
import { readiness } from "./census-cycles";

const P = { asOf: { id: "asOf", label: "Data de referência", type: "date", required: true }, knownAt: { id: "knownAt", label: "Conhecido até", type: "datetime", required: true }, year: { id: "year", label: "Ano", type: "integer", required: true, min: 2000, max: 2100 } } as const;
const col = (id: string, label: string, kind: ColumnDef["kind"] = "text", sensitive = false): ColumnDef => ({ id, label, kind, ...(sensitive ? { sensitive } : {}) });
const def = (id: string, title: string, source: string, params: ReportDefinition["params"], columns: ColumnDef[], dependency: string | null = null): ReportDefinition =>
  ({ id: `ciece-${id}`, version: 1, title, description: title, source, params, columns, formats: ["pdf", "xlsx", "csv"], reproducible: true, syncRowLimit: 5000, dependency });

const BASE = [col("escola", "Escola"), col("recorte", "Recorte"), col("grandeza", "Grandeza"), col("valor", "Valor", "number"), col("estado", "Estado"), col("fonte", "Fonte")];

export const CIECE_PANORAMA = def("panorama-rede", "Panorama da Rede", "ciece/observatory.panorama", [P.asOf, P.knownAt], BASE);
export const CIECE_MATRICULAS = def("matriculas", "Matrículas por Escola/Etapa/Modalidade/Turno", "ciece/temporal-chain.countAt", [P.asOf, P.knownAt], BASE);
export const CIECE_TURMAS = def("turmas", "Turmas", "ciece/classes-staff-panel.classPanel", [P.asOf, P.knownAt], BASE);
export const CIECE_QUADRO = def("quadro-professores", "Quadro de Professores", "ciece/classes-staff-panel.staffAt", [P.asOf, P.knownAt], BASE);
export const CIECE_MOVIMENTACAO = def("movimentacao", "Movimentação", "ciece/historical-snapshots.compareSnapshots", [P.asOf, P.knownAt],
  [col("fato", "Fato"), col("motivo", "Motivo"), col("detalhe", "Detalhe"), col("de", "Fotografia de"), col("para", "Fotografia para")]);
export const CIECE_RESULTADOS = def("resultados", "Resultados (Situação do Aluno)", "ciece/student-situation-conference.conferSituation", [P.year, P.knownAt],
  [col("matricula", "Matrícula", "text", true), col("estado", "Estado"), col("categoria", "Categoria"), col("regra", "Regra"), col("motivos", "Motivos"), col("evidencia", "Evidência")]);
export const CIECE_HISTORICO = def("historico", "Histórico de fotografias", "ciece/historical-snapshots", [P.year],
  [col("ano", "Ano"), col("etapa", "Etapa"), col("dataRef", "Data de referência"), col("versao", "Versão", "number"), col("substitui", "Substitui", "number"), col("regra", "Regra"), col("oficial", "Oficial"), col("pessoas", "Pessoas", "number"), col("matriculas", "Matrículas", "number"), col("excluidos", "Excluídos", "number"), col("digest", "Impressão digital"), col("conhecidoAte", "Conhecido até")]);
export const CIECE_PENDENCIAS = def("pendencias", "Pendências e correções", "ciece/correction-desk", [P.knownAt],
  [col("protocolo", "Protocolo"), col("regra", "Regra"), col("grau", "Grau"), col("dono", "Setor dono"), col("estado", "Estado"), col("prioridade", "Prioridade"), col("prazo", "Prazo"), col("correcao", "Correção na origem")]);
export const CIECE_SITUACAO_CENSITARIA = def("situacao-censitaria", "Situação Censitária por escola", "ciece/census-cycles.schoolChecklist", [P.year],
  [col("escola", "Escola"), col("etapa", "Etapa"), col("item", "Item"), col("estado", "Estado"), col("evidencia", "Evidência"), col("prontidao", "Prontidão")]);

export type LibraryEntry = { def: ReportDefinition; methodology: string[]; reused: boolean; printAuthorizedBy: string };
const M = (...s: string[]) => s;
/** PDF A4 pelo mesmo motor; a Ficha longitudinal mantém só CSV (dado nominal de criança). */
const withPdf = (d: ReportDefinition): ReportDefinition => ({ ...d, formats: [...new Set([...d.formats, "pdf" as const])] });
export const CIECE_LIBRARY: readonly LibraryEntry[] = [
  { def: CIECE_PANORAMA, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Indicadores do observatório (L02) lidos com a sessão.", "Zero só quando lido; não lido ou sem permissão = não disponível.") },
  { def: CIECE_MATRICULAS, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Pessoa ≠ matrícula ≠ alocação (L03); só cabeça da cadeia vigente na data.", "Vigência sem início fica fora do total e é listada.", "Etapa/modalidade/turno só da oferta registrada (L04).") },
  { def: CIECE_TURMAS, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Oferta/turno lidos; ausente = não declarado.", "Ocupação só com capacidade registrada.") },
  { def: CIECE_QUADRO, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Profissionais únicos ≠ vínculos ≠ lotados ≠ em exercício ≠ com atribuição (L04).", "Sem fonte de lotação/atribuição = não disponível.") },
  { def: withPdf(TOTAL_AULAS_OFERTADAS), reused: true, printAuthorizedBy: "consultar-ciece", methodology: M("Definição existente do Quadro docente (staffing/teacher-need).") },
  { def: withPdf(TOTAL_AULAS_REDE), reused: true, printAuthorizedBy: "consultar-ciece", methodology: M("Definição existente do Quadro docente.") },
  { def: withPdf(NECESSIDADE_PROFESSOR), reused: true, printAuthorizedBy: "consultar-ciece", methodology: M("Definição existente do Quadro docente; cenário simulado recusado.") },
  { def: CIECE_MOVIMENTACAO, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Diferença entre duas fotografias explicada por fato (L11): entrada, saída, transferência, troca de turma, correção tardia.") },
  { def: CIECE_RESULTADOS, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Só registro oficial 12I e movimentação homologada com data (L10).", "Totais somam só conferidas; registro docente só aponta lacuna.") },
  { def: CIECE_HISTORICO, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Cadeia de fotografias versionadas (L11); oficial anterior nunca reescrita.") },
  { def: FICHA_LONGITUDINAL, reused: true, printAuthorizedBy: "consultar-ciece", methodology: M("Ficha longitudinal existente (Acompanhamento da escola).") },
  { def: CIECE_PENDENCIAS, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Casos da central (L07); estado projetado dos eventos; prazo/prioridade só se declarados.") },
  { def: CIECE_SITUACAO_CENSITARIA, reused: false, printAuthorizedBy: "consultar-ciece", methodology: M("Checklist por escola/etapa (L08); fonte não lida = inconclusiva, nunca pronta.") },
];

/** Linhas — só projeções; ausência permanece null. */
export const resultadosRows = (rs: SituationResult[]): Record<string, CellValue>[] =>
  rs.map((r) => ({ matricula: r.enrollmentId, estado: r.status, categoria: r.category, regra: r.ruleRef, motivos: r.reasons.join("; ") || null, evidencia: r.evidence.join("; ") || null }));
export const historicoRows = (ss: Snapshot[]): Record<string, CellValue>[] =>
  ss.map((s) => ({ ano: s.year, etapa: s.stageKey, dataRef: s.referenceDate, versao: s.version, substitui: s.supersedes, regra: s.ruleRef, oficial: s.official ? "sim" : "não", pessoas: s.counts.pessoas, matriculas: s.counts.matriculas, excluidos: s.excluded.length, digest: s.digest, conhecidoAte: s.knownAt }));
export const pendenciasRows = (cs: CorrectionCase[]): Record<string, CellValue>[] =>
  cs.map((c) => { const d = declared(c); return { protocolo: c.protocol, regra: `${c.finding.ruleId}@${c.finding.version}`, grau: c.finding.grade, dono: c.owner, estado: stateOf(c), prioridade: d.priority, prazo: d.dueOn, correcao: c.events.filter((e) => e.correctionActRef).at(-1)?.correctionActRef ?? null }; });
export const situacaoRows = (school: string, stage: string, items: ChecklistItem[]): Record<string, CellValue>[] => {
  const r = readiness(items); return items.map((i) => ({ escola: school, etapa: stage, item: i.label, estado: i.status, evidencia: i.evidence, prontidao: r }));
};

/** Execução autorizada: sem capacidade de leitura ⇒ recusa; metadados reproduzíveis no cabeçalho. */
export function runLibraryReport(id: string, params: Record<string, unknown>, rows: Record<string, CellValue>[], capabilities: ReadonlySet<string>, now = new Date()): { result: ReportResult; meta: string[] } {
  const e = CIECE_LIBRARY.find((x) => x.def.id === id);
  if (!e) throw new Error("ciece-library:relatorio-desconhecido");
  if (!capabilities.has(e.printAuthorizedBy)) throw new Error("ciece-library:sem-capacidade");
  const result = runReport(e.def, { params }, rows, now);
  const meta = [`Relatório ${e.def.id}@${e.def.version} — fonte ${e.def.source}`, ...Object.entries(result.params).map(([k, v]) => `${k}: ${v ?? "não disponível"}`), ...e.methodology.map((m) => `Metodologia: ${m}`)];
  return { result, meta };
}
