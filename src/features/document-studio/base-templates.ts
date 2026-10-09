/**
 * Modelos-base editáveis. Todos nascem "rascunho" e trazem o aviso
 * "Rascunho institucional — não homologado": nenhum finge texto oficial.
 * Quando há referência no acervo, a estrutura segue o arquivo (fonte citada).
 */
import { DEFAULT_PAGE, type PageSetup, type StudioBlock } from "./studio-engine";

export const DRAFT_LABEL = "Rascunho institucional — não homologado";
export type BaseTemplate = { id: string; sector: string; title: string; source: string | null; blocks: StudioBlock[]; page: PageSetup };

const header: StudioBlock = { type: "header", logoAsset: null, lines: ["Prefeitura Municipal de Itaperuna", "Secretaria Municipal de Educação", "{{escola.nome}}"] };
const tail: StudioBlock[] = [
  { type: "date-place", place: "Itaperuna" },
  { type: "signature", label: "Secretário(a) escolar" },
  { type: "signature", label: "Direção" },
  { type: "qr", label: "Verifique a autenticidade pelo código" },
];
const page = (footer: string): PageSetup => ({ ...DEFAULT_PAGE, footerText: footer, watermark: null });
const decl = (id: string, title: string, body: string): BaseTemplate => ({
  id, sector: "secretaria", title, source: null, page: page("Documento emitido pelo SIGEM — {{escola.nome}}"),
  blocks: [header, { type: "document-number" }, { type: "title", text: title.toUpperCase() },
    { type: "rich", style: { align: "justify" }, runs: [{ text: body }] }, ...tail],
});

export const BASE_TEMPLATES: readonly BaseTemplate[] = [
  decl("declaracao-de-matricula", "Declaração de Matrícula",
    "Declaramos, para os devidos fins, que {{aluno.nome}} está matriculado(a) nesta unidade escolar no ano letivo de {{ano_letivo.nome}}, sob a matrícula nº {{matricula.numero}}, na turma {{turma.rotulo}}."),
  decl("declaracao-escolar", "Declaração Escolar",
    "Declaramos, para os devidos fins, que {{aluno.nome}} possui vínculo com esta unidade escolar desde {{matricula.abertura}}."),
  decl("atestado-de-escolaridade", "Atestado de Escolaridade",
    "Atestamos que {{aluno.nome}} frequenta esta unidade escolar no ano letivo de {{ano_letivo.nome}}, turma {{turma.rotulo}}."),
  decl("renovacao-de-matricula", "Renovação de Matrícula",
    "Fica registrada a renovação da matrícula de {{aluno.nome}} para o ano letivo de {{ano_letivo.nome}}."),
  { id: "transferencia", sector: "secretaria", title: "Declaração / Guia de Transferência", source: null, page: page("Documento emitido pelo SIGEM"),
    blocks: [header, { type: "document-number" }, { type: "title", text: "DECLARAÇÃO DE TRANSFERÊNCIA" },
      { type: "rich", style: { align: "justify" }, runs: [{ text: "Declaramos que {{aluno.nome}}, matrícula nº {{matricula.numero}}, solicitou transferência desta unidade escolar para {{transferencia.destino}}." }] },
      ...tail] },
  { id: "ficha-de-matricula", sector: "secretaria", title: "Ficha de Matrícula", source: "FICHA_DE_MATRICULA_-2026_-_2026.pdf (modelo de uma escola)", page: page("Ficha de Matrícula — {{ano_letivo.nome}}"),
    blocks: [header, { type: "title", text: "FICHA DE MATRÍCULA" },
      { type: "box", title: "Identificação do aluno", children: [
        { type: "field", label: "Nome", fact: "aluno.nome" }, { type: "field", label: "Identificador", fact: "aluno.identificador" },
        { type: "field", label: "Matrícula", fact: "matricula.numero" }, { type: "field", label: "Turma", fact: "turma.rotulo" }] },
      { type: "box", title: "Responsável", children: [{ type: "field", label: "Nome", fact: "responsavel.nome" }] },
      { type: "signature", label: "Responsável" }, { type: "signature", label: "Secretário(a) escolar" }] },
  { id: "livro-de-matricula", sector: "secretaria", title: "Livro de Matrícula", source: null, page: { ...page("Livro de Matrícula — {{escola.nome}} — {{ano_letivo.nome}}"), orientation: "paisagem" },
    blocks: [header, { type: "title", text: "LIVRO DE MATRÍCULA" },
      { type: "rich", runs: [{ text: "A ordem das linhas não constitui numeração oficial.", italic: true }] },
      { type: "table", rowsFact: "livro.linhas", columns: [{ label: "Aluno", fact: "aluno" }, { label: "Matrícula", fact: "matricula" }, { label: "Turma", fact: "turma" }, { label: "Data", fact: "data" }] },
      { type: "signature", label: "Secretário(a) escolar" }] },
  { id: "termo-uso-imagem", sector: "secretaria", title: "Termo de Autorização de Uso de Imagem", source: "Termo_Autorizacao_Uso_Imagem.docx", page: page(""),
    blocks: [header, { type: "title", text: "TERMO DE AUTORIZAÇÃO PARA USO DE IMAGEM DE ESTUDANTE" },
      { type: "rich", style: { align: "justify" }, runs: [{ text: "Eu, {{responsavel.nome}}, responsável legal pelo(a) estudante {{aluno.nome}}, da turma {{turma.rotulo}}, AUTORIZO o uso de imagem conforme finalidades descritas pela unidade escolar." }] },
      { type: "date-place", place: "Itaperuna" }, { type: "signature", label: "Responsável legal" }] },
  { id: "termo-ciencia-faltas", sector: "direcao", title: "Termo de Ciência de Faltas", source: "TERMO_DE_CIÊNCIA_DE_FALTAS_3º_PL.docx", page: page(""),
    blocks: [header, { type: "title", text: "TERMO DE CIÊNCIA DE FALTAS" },
      { type: "rich", runs: [{ text: "Declaro ciência das faltas de {{aluno.nome}}, turma {{turma.rotulo}}, conforme apuração de frequência homologada." }] },
      { type: "date-place", place: "Itaperuna" }, { type: "signature", label: "Responsável" }, { type: "signature", label: "Direção" }] },
  { id: "oficio", sector: "direcao", title: "Ofício", source: "Ofícios 11–22/2026 (estrutura)", page: page(""),
    blocks: [header, { type: "document-number" }, { type: "date-place", place: "Itaperuna" },
      { type: "rich", runs: [{ text: "Da: {{escola.nome}}", bold: true }] }, { type: "rich", runs: [{ text: "Assunto: " , bold: true }, { text: "(preencher)" }] },
      { type: "rich", runs: [{ text: "(corpo do ofício)" }] }, { type: "signature", label: "Direção" }] },
  { id: "ata-de-reuniao", sector: "direcao", title: "Ata de Reunião", source: "Ata_de_Reunião.docx / Modelo_de_ata_para_escolas.docx", page: page(""),
    blocks: [header, { type: "title", text: "ATA DE REUNIÃO" }, { type: "rich", runs: [{ text: "Pauta:", bold: true }] },
      { type: "list", ordered: true, items: ["(item)"] }, { type: "date-place", place: "Itaperuna" }, { type: "signature", label: "Participantes" }] },
  { id: "termo-de-visita", sector: "avaliacao", title: "Termo de Visita", source: "TERMO_DE_VISITA.docx", page: page(""),
    blocks: [header, { type: "title", text: "TERMO DE VISITA — ACOMPANHAMENTO E AVALIAÇÃO" }, { type: "field", label: "Escola", fact: "escola.nome" },
      { type: "box", title: "Observações", children: [{ type: "rich", runs: [{ text: " " }] }] }, { type: "signature", label: "Coordenador(a)" }, { type: "signature", label: "Direção" }] },
  { id: "nao-conformidade-alimentacao", sector: "alimentacao", title: "Formulário de Não Conformidade", source: "ANEXO_8_-_FORMULARIO_DE_NÃO_CONFORMIDADE.docx", page: page(""),
    blocks: [header, { type: "title", text: "FORMULÁRIO DE NÃO CONFORMIDADE" }, { type: "field", label: "Escola", fact: "escola.nome" },
      { type: "box", title: "Descrição", children: [{ type: "rich", runs: [{ text: " " }] }] }, { type: "signature", label: "Responsável pela unidade" }] },
  { id: "lista-documentos-matricula", sector: "secretaria", title: "Documentos necessários para matrícula", source: "MATRÍCULA_2026_-_documentos_necessários_2.docx", page: page(""),
    blocks: [header, { type: "title", text: "DOCUMENTOS NECESSÁRIOS PARA MATRÍCULA" },
      { type: "list", ordered: false, items: ["Cópia da certidão de nascimento", "1 foto 3x4 atualizada", "Cópia do comprovante de residência", "Cópia da identidade e CPF do aluno", "Cópia da identidade e CPF do responsável"] }] },
];

/** Setores que já emitem documentos pelo próprio módulo (incorporados por referência). */
export const SECTOR_DOCUMENTS: readonly { sector: string; document: string; route: string }[] = [
  { sector: "Mapa Estatístico", document: "Mapa mensal (PDF)", route: "/mapa-estatistico" },
  { sector: "Diário", document: "Documentos do diário", route: "/diario/documentos" },
  { sector: "Calendário", document: "Calendário externo / documento", route: "/calendario-escolar" },
  { sector: "Horários", document: "Documentos da turma", route: "/horarios" },
  { sector: "Relatórios", document: "Gerador de relatórios (CSV/XLSX/PDF)", route: "/relatorios" },
  { sector: "Secretaria", document: "Documentos escolares do aluno (emissão real)", route: "/documentos-escolares" },
];
