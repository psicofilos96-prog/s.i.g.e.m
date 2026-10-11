/**
 * Painéis operacionais por setor: só DECLARAÇÕES sobre o catálogo fechado do gerador personalizado.
 * Cada indicador/alerta é uma consulta `report_custom_query` executada com a sessão (RLS de quem vê);
 * nenhuma regra, conta ou dado novo. Ações são links às telas donas, filtradas por `pathAllowed`.
 * Setor cujo dado só é lido por função DEFINER própria (Alimentação, Mediador/AEE) declara a lacuna
 * e encaminha à tela dona, porque abrir essa fonte à consulta livre ampliaria o acesso.
 */
import { emptySpec, type Catalog, type Condition, type CustomSpec, type Aggregate } from "../custom/custom-report";

export type SectorIndicator = { id: string; title: string; spec: CustomSpec; /** coluna de detalhe (drill) quando há grupo */ detail?: string[] };
/** Alerta = contagem de registros que já violam um invariante existente (ex.: dado ausente). 0 = sem alerta. */
export type SectorAlert = { id: string; title: string; meaning: string; spec: CustomSpec; detail: string[] };
export type SectorAction = { label: string; path: string };
export type SectorBoard = { id: string; sector: string; owner: string; actions: SectorAction[]; indicators: SectorIndicator[]; alerts: SectorAlert[]; gaps: string[] };

const q = (source: string, joins: string[], groupBy: string[], agg: Aggregate = "count", field?: string, where: Condition[] = []): CustomSpec =>
  ({ ...emptySpec(source), joins, groupBy, measures: [field ? { agg, field } : { agg }], filter: { op: "and", items: where } });
const rows = (source: string, joins: string[], columns: string[], where: Condition[]): CustomSpec =>
  ({ ...emptySpec(source), joins, columns, filter: { op: "and", items: where } });
const isNull = (field: string): Condition => ({ field, operator: "is_null" });
const open: Condition = { field: "vinculos.encerrado", operator: "eq", value: false };

const semInicio: SectorAlert = {
  id: "matricula-sem-inicio", title: "Matrículas sem data de início registrada",
  meaning: "A carga 2026 não trouxe a data; a Secretaria declara pela consulta de matrícula. Não é inferida.",
  spec: q("matriculas", ["matricula_escola"], ["escolas.nome"], "count", undefined, [isNull("matriculas.aberta_em")]),
  detail: ["escolas.nome", "matriculas.oferta"],
};
const turmaSemEtapa: SectorAlert = {
  id: "turma-sem-etapa", title: "Turmas sem etapa registrada",
  meaning: "Etapa ausente na fonte; não é deduzida do nome da turma.",
  spec: q("turmas", ["turma_escola"], ["escolas.nome"], "count", undefined, [isNull("turmas.etapa")]),
  detail: ["escolas.nome", "turmas.turma", "turmas.codigo"],
};
const vinculoSemTurma: SectorAlert = {
  id: "vinculo-sem-turma", title: "Vínculos abertos sem turma",
  meaning: "Vínculo corrente sem turma identificada na fonte.",
  spec: q("vinculos", ["vinculo_escola"], ["escolas.nome"], "count", undefined, [open, isNull("vinculos.class_id")]),
  detail: ["escolas.nome", "vinculos.turma_rotulo", "vinculos.desde"],
};

export const SECTOR_BOARDS: readonly SectorBoard[] = [
  { id: "secretaria", sector: "Secretaria Escolar", owner: "/secretaria",
    actions: [{ label: "Estação da Secretaria", path: "/secretaria" }, { label: "Vagas por turma", path: "/secretaria/vagas" }, { label: "Livro de matrícula", path: "/secretaria/livro-matricula" }],
    indicators: [
      { id: "mat", title: "Matrículas por escola", spec: q("matriculas", ["matricula_escola"], ["escolas.nome"]), detail: ["escolas.nome", "matriculas.oferta"] },
      { id: "vin", title: "Estudantes enturmados por turma", spec: q("vinculos", ["vinculo_turma"], ["turmas.turma"], "count_distinct", "vinculos.student_id", [open]), detail: ["turmas.turma", "vinculos.desde"] },
    ], alerts: [semInicio, vinculoSemTurma], gaps: [] },
  { id: "ciece", sector: "CIECE — Informação e Estatística", owner: "/ciece",
    actions: [{ label: "CIECE", path: "/ciece" }, { label: "Gerador personalizado", path: "/relatorios/personalizado" }],
    indicators: [
      { id: "esc", title: "Escolas por localização", spec: q("escolas", [], ["escolas.localizacao"]), detail: ["escolas.nome", "escolas.localizacao", "escolas.dependencia"] },
      { id: "tur", title: "Turmas por etapa", spec: q("turmas", [], ["turmas.etapa"]), detail: ["turmas.turma", "turmas.etapa"] },
      { id: "mat", title: "Matrículas por escola", spec: q("matriculas", ["matricula_escola"], ["escolas.nome"]), detail: ["escolas.nome", "matriculas.oferta"] },
    ], alerts: [turmaSemEtapa, semInicio], gaps: [] },
  { id: "direcao", sector: "Direção Escolar", owner: "/gestao-escolar",
    actions: [{ label: "Estação da Direção", path: "/gestao-escolar" }, { label: "Acompanhamento da escola", path: "/direcao" }],
    indicators: [
      { id: "mat", title: "Matrículas", spec: q("matriculas", [], []) },
      { id: "tur", title: "Turmas por etapa", spec: q("turmas", [], ["turmas.etapa"]), detail: ["turmas.turma", "turmas.etapa"] },
      { id: "atu", title: "Atuações no SIGEM por tipo", spec: q("atuacoes", [], ["atuacoes.tipo"]), detail: ["atuacoes.tipo", "atuacoes.cargo", "atuacoes.inicio"] },
    ], alerts: [vinculoSemTurma, turmaSemEtapa], gaps: [] },
  { id: "docente", sector: "Docente", owner: "/diario",
    actions: [{ label: "Diário", path: "/diario" }, { label: "Avaliações do professor", path: "/avaliacoes-do-professor" }],
    indicators: [
      { id: "est", title: "Estudantes nas minhas turmas", spec: q("vinculos", ["vinculo_turma"], ["turmas.turma"], "count_distinct", "vinculos.student_id", [open]), detail: ["turmas.turma", "vinculos.desde"] },
      { id: "cha", title: "Chamadas registradas por turma", spec: q("frequencia", ["frequencia_turma"], ["turmas.turma"]), detail: ["turmas.turma", "frequencia.componente", "frequencia.registrada_em"] },
    ], alerts: [], gaps: [] },
  { id: "mediador", sector: "Mediador / AEE", owner: "/inclusao",
    actions: [{ label: "Inclusão e AEE", path: "/inclusao" }],
    indicators: [], alerts: [],
    gaps: ["Registros de AEE e mediação são lidos só pela tela de Inclusão (função própria com controle por estudante); não entram em painel de consulta livre."] },
  { id: "diario", sector: "Diário", owner: "/diario",
    actions: [{ label: "Diário", path: "/diario" }, { label: "Livro do Diário", path: "/diario/livro" }, { label: "Folha final", path: "/diario/folha-final" }],
    indicators: [
      { id: "cha", title: "Chamadas por componente", spec: q("frequencia", [], ["frequencia.componente"]), detail: ["frequencia.componente", "frequencia.registrada_em"] },
      { id: "ava", title: "Resultados de avaliação por período", spec: q("avaliacoes", [], ["avaliacoes.periodo"]), detail: ["avaliacoes.periodo", "avaliacoes.instrumento", "avaliacoes.registrado_em"] },
    ], alerts: [], gaps: [] },
  { id: "mapa", sector: "Mapa Estatístico", owner: "/mapa-estatistico",
    actions: [{ label: "Mapa Estatístico", path: "/mapa-estatistico" }, { label: "Mapa mensal 2026", path: "/mapa-mensal-2026" }],
    indicators: [
      { id: "mat", title: "Matrículas por oferta", spec: q("matriculas", [], ["matriculas.oferta"]), detail: ["matriculas.oferta"] },
      { id: "vin", title: "Enturmações abertas por escola", spec: q("vinculos", ["vinculo_escola"], ["escolas.nome"], "count", undefined, [open]), detail: ["escolas.nome", "vinculos.turma_rotulo"] },
    ], alerts: [semInicio], gaps: ["Totais oficiais do Mapa só pela fotografia conferida/oficializada na tela do Mapa; estes números são a leitura corrente."] },
  { id: "alimentacao", sector: "Alimentação Escolar", owner: "/alimentacao-escolar",
    actions: [{ label: "Alimentação Escolar", path: "/alimentacao-escolar" }, { label: "Cozinha", path: "/alimentacao-escolar/cozinha" }],
    indicators: [], alerts: [],
    gaps: ["Pedidos, entregas e estoque são lidos só pelas funções próprias da Alimentação; não entram em painel de consulta livre."] },
  { id: "acompanhamento", sector: "Acompanhamento e Avaliação", owner: "/acompanhamento-avaliacao",
    actions: [{ label: "Acompanhamento da avaliação", path: "/acompanhamento-avaliacao" }, { label: "Acompanhamento dos diários", path: "/acompanhamento-diarios" }],
    indicators: [
      { id: "ava", title: "Resultados por instrumento", spec: q("avaliacoes", [], ["avaliacoes.instrumento"]), detail: ["avaliacoes.instrumento", "avaliacoes.periodo"] },
      { id: "med", title: "Média do resultado numérico por período", spec: q("avaliacoes", [], ["avaliacoes.periodo"], "avg", "avaliacoes.valor_numerico") },
    ], alerts: [], gaps: [] },
  { id: "supervisao", sector: "Supervisão Escolar", owner: "/supervisao-escolar",
    actions: [{ label: "Supervisão Escolar", path: "/supervisao-escolar" }],
    indicators: [
      { id: "esc", title: "Escolas por dependência", spec: q("escolas", [], ["escolas.dependencia"]), detail: ["escolas.nome", "escolas.dependencia", "escolas.localizacao"] },
      { id: "mat", title: "Matrículas por escola", spec: q("matriculas", ["matricula_escola"], ["escolas.nome"]), detail: ["escolas.nome", "matriculas.oferta"] },
    ], alerts: [semInicio, turmaSemEtapa], gaps: [] },
];

/** Drill-down: mesma fonte/cruzamentos/filtros do indicador + condição da categoria clicada, em linhas (sem dado pessoal). */
export function drillSpec(base: CustomSpec, detail: readonly string[], cond: Condition | null): CustomSpec {
  const items = [...base.filter.items, ...(cond ? [cond] : [])];
  return rows(base.source, base.joins, [...detail], items as Condition[]);
}

/** Confere declarações contra o catálogo real; erro é dito por extenso (nunca some em silêncio). */
export function boardProblems(b: SectorBoard, cat: Catalog): string[] {
  const out: string[] = []; const joins = new Set(cat.joins.map((j) => j.id));
  const field = (ref: string, where: string) => { const [s, f] = ref.split("."); const d = cat.sources[s!]?.fields[f!]; if (!d) out.push(`${where}: campo "${ref}" não existe.`); else if (d.sensitive) out.push(`${where}: "${ref}" é dado pessoal.`); };
  for (const x of [...b.indicators, ...b.alerts]) {
    if (!cat.sources[x.spec.source]) { out.push(`${x.title}: fonte "${x.spec.source}" não existe.`); continue; }
    x.spec.joins.forEach((j) => { if (!joins.has(j)) out.push(`${x.title}: cruzamento "${j}" não existe.`); });
    x.spec.groupBy.forEach((g) => field(g, x.title));
    x.spec.measures.forEach((m) => m.field && field(m.field, x.title));
    (x.detail ?? []).forEach((g) => field(g, x.title));
    (x.spec.filter.items as Condition[]).forEach((c) => field(c.field, x.title));
  }
  return out;
}
