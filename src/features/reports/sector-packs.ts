/**
 * REPORT.PRO.2 — Pacotes de relatórios por setor sobre o gerador universal.
 * Um pacote é só uma ESCOLHA pré-montada (assunto + colunas + organização + gráfico + layout):
 * os dados são sempre relidos com a sessão de quem gera, e o usuário pode alterar tudo e salvar
 * como modelo pessoal. Pacote cujo assunto não tem leitura governada fica indisponível com o
 * motivo — nunca com número inventado ou gráfico vazio apresentado como zero.
 */
import type { BuilderChoice, BuilderSource } from "./report-builder";
import { DEFAULT_LAYOUT, chartIssues, layoutIssues, organize, validateOrganization, type ChartSpec, type Organization, type ReportLayout } from "./report-analytics";

export type PackSector = "ciece" | "secretaria" | "direcao" | "op" | "docente" | "avaliacao" | "alimentacao" | "inclusao" | "admin";
export const PACK_SECTOR_LABEL: Record<PackSector, string> = {
  ciece: "CIECE", secretaria: "Secretaria", direcao: "Direção", op: "Orientação Pedagógica", docente: "Docente",
  avaliacao: "Avaliação", alimentacao: "Alimentação", inclusao: "Inclusão / NEI / Mediador", admin: "Administração",
};

export type SectorPack = Readonly<{
  id: string; sector: PackSector; title: string; sourceId: string;
  choice?: BuilderChoice; organization?: Organization; chart?: ChartSpec | null; layout?: ReportLayout;
  /** Motivo quando o assunto não tem leitura governada. */
  blockedBy?: string;
}>;

const cnt = { id: "n", label: "Quantidade", agg: "count" as const, column: null };
const org = (groupBy: string[], extra: Organization["measures"] = []): Organization =>
  ({ groupBy, measures: [cnt, ...extra], derived: [], sort: [{ key: "n", dir: "desc" }], subtotals: groupBy.length > 1, grandTotal: true });
const lay = (title: string, landscape = false): ReportLayout => ({ ...DEFAULT_LAYOUT, title, orientation: landscape ? "paisagem" : "retrato", headerLines: ["Prefeitura Municipal de Itaperuna", "Secretaria Municipal de Educação"] });
const choice = (sourceId: string, columns: string[]): BuilderChoice => ({ sourceId, from: null, to: null, columns, filters: [], sort: [] });
const ready = (id: string, sector: PackSector, title: string, sourceId: string, columns: string[], o: Organization, chart: ChartSpec | null, landscape = false): SectorPack =>
  ({ id, sector, title, sourceId, choice: choice(sourceId, columns), organization: o, chart, layout: lay(title, landscape) });
const blocked = (id: string, sector: PackSector, title: string, sourceId: string, reason: string): SectorPack => ({ id, sector, title, sourceId, blockedBy: reason });

const R = {
  enroll: "Depende de enturmação 2026 em episódios (ENROLLMENT_EPISODES_2026_PENDING) e de leitor de matrículas no gerador.",
  map: "O Mapa exporta pelas próprias células oficializadas; sem leitor transversal no gerador.",
  census: "Censo × base operacional sai pela aba Relatórios do Censo Escolar (fotografia oficializada).",
  quality: "Qualidade dos dados é projeção calculada na própria central; sem adaptador no gerador.",
  diary: "Frequência/aulas só com fechamento homologado; sem leitor transversal do Diário.",
  assess: "Resultados saem pela tela de Desempenho, com a política de supressão dela.",
  incl: "Dado sensível: sem leitor com política de supressão aprovada (CID/laudo nunca entram).",
  audit: "Exige capability exportar-auditoria (não atribuída).",
  docs: "Emissões de documento têm leitor por aluno, não transversal.",
  decisions: "Decisões/providências sem leitor transversal no gerador.",
  op: "Acompanhamentos/SIPE/Conselho sem leitor transversal no gerador.",
  temporal: "Série temporal exige mais de um ano reconciliado; 2027 ainda não tem fatos.",
};

export const SECTOR_PACKS: readonly SectorPack[] = [
  // CIECE
  ready("ciece-turmas-escola-etapa", "ciece", "Turmas por escola e etapa", "gerador-turmas", ["school", "stage", "name", "year"], org(["school", "stage"]),
    { kind: "barras-horizontais", category: "school", measures: ["n"], title: "Turmas por escola" }, true),
  ready("ciece-escolas-dependencia", "ciece", "Escolas por dependência e localização", "gerador-escolas", ["name", "dependency", "location", "rooms"],
    org(["dependency", "location"], [{ id: "salas", label: "Salas", agg: "sum", column: "rooms" }]), { kind: "barras-empilhadas", category: "dependency", series: "location", measures: ["n"], title: "Escolas por dependência" }),
  ready("ciece-matriculas", "ciece", "Matrículas por escola", "gerador-matriculas", ["school", "year", "offer", "opened_on"], org(["school"]),
    { kind: "barras-horizontais", category: "school", measures: ["n"], title: "Matrículas por escola" }, true),
  blocked("ciece-movimentacao", "ciece", "Movimentação", "gerador-movimentacoes", R.enroll),
  blocked("ciece-mapa", "ciece", "Mapa consolidado", "gerador-mapa", R.map),
  blocked("ciece-qualidade", "ciece", "Qualidade e cobertura", "gerador-qualidade", R.quality),
  blocked("ciece-censo", "ciece", "Censo operacional × snapshot oficial", "gerador-censo", R.census),
  blocked("ciece-evolucao", "ciece", "Evolução temporal", "gerador-turmas", R.temporal),
  // Secretaria
  ready("sec-turmas", "secretaria", "Turmas da escola", "gerador-turmas", ["name", "code", "stage", "year", "valid_from"], org(["stage"]),
    { kind: "barras", category: "stage", measures: ["n"], title: "Turmas por etapa" }),
  blocked("sec-alunos", "secretaria", "Alunos ativos", "gerador-alunos", R.enroll),
  ready("sec-matriculas", "secretaria", "Matrículas por ano e oferta", "gerador-matriculas", ["school", "year", "offer", "opened_on"], org(["year", "offer"]),
    { kind: "barras", category: "year", measures: ["n"], title: "Matrículas por ano letivo" }),
  blocked("sec-vagas", "secretaria", "Vagas e capacidade", "gerador-vagas", "Vagas saem pela Secretaria (secretariat_class_vacancies_at) com capacidade declarada; sem adaptador no gerador."),
  blocked("sec-livro", "secretaria", "Livro de Matrícula", "gerador-livro", "Documento especial da Secretaria; ordem não é numeração oficial."),
  blocked("sec-transferencias", "secretaria", "Transferências e remanejamentos", "gerador-movimentacoes", R.enroll),
  blocked("sec-documentos", "secretaria", "Documentos emitidos", "gerador-documentos", R.docs),
  // Direção
  ready("dir-turmas", "direcao", "Panorama de turmas", "gerador-turmas", ["name", "stage", "valid_from", "valid_until"], org(["stage"]),
    { kind: "barras", category: "stage", measures: ["n"], title: "Turmas por etapa" }),
  ready("dir-alimentacao", "direcao", "Alimentação da escola — execução", "nae-execucoes", ["school", "date", "slot", "meals", "students"],
    org(["slot"], [{ id: "ref", label: "Refeições servidas", agg: "sum", column: "meals" }]), { kind: "barras", category: "slot", measures: ["ref"], title: "Refeições por tipo" }),
  blocked("dir-pendencias", "direcao", "Pendências", "gerador-qualidade", R.quality),
  blocked("dir-diario", "direcao", "Diário e frequência", "gerador-frequencia", R.diary),
  blocked("dir-decisoes", "direcao", "Decisões e providências", "gerador-decisoes", R.decisions),
  // OP
  ...["Acompanhamentos", "SIPE/SIA", "Diário e fiscalização", "Conselho", "Intervenções e encaminhamentos"].map((t, i) =>
    blocked(`op-${i}`, "op", t, "gerador-op", t.startsWith("Diário") ? R.diary : R.op)),
  // Docente
  ...["Frequência", "Aulas previstas × registradas", "Conteúdos", "Avaliações", "Planejamento", "Visão da turma"].map((t, i) =>
    blocked(`doc-${i}`, "docente", t, "gerador-frequencia", t === "Avaliações" ? R.assess : R.diary)),
  // Avaliação
  ...["Desempenho por escola/turma/componente", "Evolução", "Distribuição", "Cobertura", "Mapa de calor", "Comparações"].map((t, i) =>
    blocked(`aval-${i}`, "avaliacao", t, "gerador-avaliacao", R.assess)),
  // Alimentação
  ready("nae-pedidos", "alimentacao", "Solicitações: solicitado × autorizado", "nae-pedidos", ["school", "competence", "status", "requested", "authorized"], org(["status"]),
    { kind: "barras", category: "status", measures: ["n"], title: "Pedidos por situação" }),
  ready("nae-recebimentos", "alimentacao", "Recebimentos e pendências", "nae-entregas", ["school", "expected", "situation", "scheduled", "accepted", "rejected"],
    org(["situation"], [{ id: "ac", label: "Aceito", agg: "sum", column: "accepted" }, { id: "rj", label: "Rejeitado", agg: "sum", column: "rejected" }]),
    { kind: "barras", category: "situation", measures: ["ac", "rj"], title: "Aceito × rejeitado por situação" }, true),
  ready("nae-estoque", "alimentacao", "Movimentos de estoque e consumo", "nae-movimentos", ["school", "date", "class", "item", "unit", "quantity", "direction"],
    org(["class", "unit"]), { kind: "barras-empilhadas", category: "class", series: "unit", measures: ["n"], title: "Movimentos por classe" }, true),
  ready("nae-nc", "alimentacao", "Não conformidades", "nae-nao-conformidades", ["school", "updated", "status", "motive", "returned"], org(["status"]),
    { kind: "donut", category: "status", measures: ["n"], title: "Não conformidades por situação" }),
  ready("nae-cobertura", "alimentacao", "Cobertura de execução por escola", "nae-execucoes", ["school", "date", "slot", "meals"],
    org(["school"], [{ id: "dias", label: "Dias com registro", agg: "distinct", column: "date" }]), { kind: "barras-horizontais", category: "school", measures: ["dias"], title: "Dias com execução registrada" }, true),
  blocked("nae-fechamento", "alimentacao", "Fechamento de estoque", "nae-fechamentos", "Fechamentos ainda não entraram como assunto do gerador; saem pela Central do Núcleo."),
  // Inclusão
  ...["AEE", "Atendimentos", "Mediação", "Cobertura", "Vigências", "Pendências"].map((t, i) => blocked(`incl-${i}`, "inclusao", t, "gerador-inclusao", R.incl)),
  // Admin
  ready("adm-escolas", "admin", "Configuração: cadastro das escolas", "gerador-escolas", ["name", "dependency", "location", "active", "valid_from"], org(["active"]),
    { kind: "barras", category: "active", measures: ["n"], title: "Escolas ativas" }),
  blocked("adm-saude", "admin", "Saúde do sistema", "gerador-saude", "Telemetria não é dataset governado do gerador."),
  blocked("adm-acessos", "admin", "Acessos", "gerador-acessos", "Acessos saem pela Central de Acessos (admin_account_overview)."),
  blocked("adm-qualidade", "admin", "Qualidade de dados", "gerador-qualidade", R.quality),
  blocked("adm-auditoria", "admin", "Auditoria", "gerador-auditoria", R.audit),
];

/** Problemas estruturais do pacote contra o assunto real (colunas, cálculos, gráfico, layout). */
export function packIssues(p: SectorPack, sources: readonly BuilderSource[]): string[] {
  if (p.blockedBy) return [];
  const src = sources.find((s) => s.id === p.sourceId);
  if (!src || src.unavailable) return [`Assunto indisponível: ${p.sourceId}.`];
  const errs: string[] = [];
  const known = new Set(src.definition.columns.map((c) => c.id));
  for (const c of p.choice!.columns) if (!known.has(c)) errs.push(`Coluna inexistente: ${c}.`);
  for (const g of p.organization!.groupBy) if (!p.choice!.columns.includes(g)) errs.push(`Agrupamento fora das colunas: ${g}.`);
  errs.push(...validateOrganization(src.definition.columns, p.organization!));
  if (p.chart) errs.push(...chartIssues(p.chart, p.organization!, organize([], p.organization!)).filter((e) => !e.includes("fatias")));
  errs.push(...layoutIssues(p.layout!, p.choice!.columns.length));
  return errs;
}

export const packsFor = (sector: PackSector) => SECTOR_PACKS.filter((p) => p.sector === sector);
