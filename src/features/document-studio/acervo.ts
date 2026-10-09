/**
 * DOCS.PRO.1 — Inventário do acervo documental (arquivos enviados ao projeto).
 * Curado a partir da leitura dos arquivos; NÃO guarda conteúdo pessoal (nomes,
 * CPF, RG) que alguns arquivos trazem preenchidos — só nome, setor, finalidade,
 * campos e classificação. "referencia-escolar" = modelo usado por UMA escola,
 * não homologado para a rede; nada aqui é modelo oficial homologado.
 */
export type AcervoClass = "referencia-escolar" | "referencia-setorial" | "documento-preenchido" | "rascunho";
export type AcervoItem = {
  file: string; name: string; sector: string; purpose: string;
  fields: string[]; signatures: string[]; emissionRule: string | null; klass: AcervoClass;
  /** Modelo do Studio que o incorpora (base editável), se houver. */
  studioTemplate: string | null;
};

export const ACERVO: readonly AcervoItem[] = [
  { file: "FICHA_DE_MATRICULA_-2026_-_2026.pdf", name: "Ficha de Matrícula 2026", sector: "secretaria",
    purpose: "Requerimento de matrícula com dados do aluno, filiação, endereço e saúde", fields: ["aluno.nome", "escola.nome", "ano_letivo.nome", "turma.rotulo", "filiação", "endereço", "documentos"],
    signatures: ["Responsável", "Secretário(a) escolar"], emissionRule: "Na matrícula", klass: "referencia-escolar", studioTemplate: "ficha-de-matricula" },
  { file: "ANEXO_1_-_FICHA_DE_MATRÍCULA.pdf", name: "Anexo da Ficha — Caracterização na Educação Especial", sector: "secretaria/inclusao",
    purpose: "Caracterização do aluno na educação especial", fields: ["aluno.nome", "deficiência (dado sensível)"], signatures: ["Responsável"],
    emissionRule: "Quando houver atendimento especializado", klass: "referencia-escolar", studioTemplate: null },
  { file: "MATRÍCULA_2026_-_documentos_necessários_2.docx", name: "Documentos necessários para pré-matrícula", sector: "secretaria",
    purpose: "Lista informativa ao responsável", fields: [], signatures: [], emissionRule: null, klass: "referencia-escolar", studioTemplate: "lista-documentos-matricula" },
  { file: "Termo_Autorizacao_Uso_Imagem.docx", name: "Termo de Autorização de Uso de Imagem", sector: "secretaria",
    purpose: "Autorização do responsável para uso de imagem do estudante", fields: ["responsável", "aluno.nome", "turma.rotulo", "turno"],
    signatures: ["Responsável legal"], emissionRule: "Mala direta por turma", klass: "referencia-escolar", studioTemplate: "termo-uso-imagem" },
  { file: "TERMO_DE_CIÊNCIA_DE_FALTAS_3º_PL.docx", name: "Termo de Ciência de Faltas", sector: "direcao/op",
    purpose: "Ciência do responsável sobre faltas no período", fields: ["aluno.nome", "turma.rotulo", "período", "faltas (depende de fechamento)"],
    signatures: ["Responsável", "Direção"], emissionRule: "Após apuração de frequência homologada", klass: "referencia-escolar", studioTemplate: "termo-ciencia-faltas" },
  { file: "TERMO_DE_SUSPENSÃO.pdf", name: "Termo de Suspensão", sector: "direcao", purpose: "Registro de medida disciplinar",
    fields: ["aluno.nome", "turma.rotulo", "motivo", "período"], signatures: ["Responsável", "Direção"], emissionRule: "Decisão da Direção registrada", klass: "referencia-escolar", studioTemplate: null },
  { file: "TERMO_DE_VISITA.docx", name: "Termo de Visita — Acompanhamento e Avaliação", sector: "avaliacao/supervisao",
    purpose: "Registro de visita técnica à escola", fields: ["escola.nome", "data", "coordenador(a)", "observações"], signatures: ["Coordenador(a)", "Direção"],
    emissionRule: "Por visita registrada", klass: "referencia-setorial", studioTemplate: "termo-de-visita" },
  { file: "Ata_de_Reunião.docx", name: "Ata de reunião (servidores)", sector: "direcao", purpose: "Ata de ciência e opção", fields: ["escola.nome", "data", "pauta"],
    signatures: ["Participantes"], emissionRule: null, klass: "documento-preenchido", studioTemplate: "ata-de-reuniao" },
  { file: "Modelo_de_ata_para_escolas.docx", name: "Modelo de ata — CNCA/Saber Ler", sector: "avaliacao", purpose: "Ata de formação de professores",
    fields: ["escola.nome", "data", "público", "pauta"], signatures: ["Participantes"], emissionRule: null, klass: "referencia-setorial", studioTemplate: "ata-de-reuniao" },
  ...["11", "17", "18", "19", "20", "22"].map((n) => ({
    file: `${n}-2026_-_OFICIO_…docx`, name: `Ofício nº ${n}/2026`, sector: "direcao", purpose: "Ofício da escola à SEMED",
    fields: ["número do documento", "data/local", "destinatário", "assunto"], signatures: ["Direção"], emissionRule: "Numeração anual da escola",
    klass: "documento-preenchido" as const, studioTemplate: "oficio" })),
  ...["ANEXO_1_-_TERMO_DE_COMPROMISSO_-_INSPETOR", "ANEXO_3_-_CRONOGRAMA_DOS_CARDÁPIOS", "ANEXO_4_-_CIRCULAR_AO_PROFISSIONAL_DE_SAÚDE", "ANEXO_6_-_CARTAZ_ANAE",
    "ANEXO_8_-_FORMULARIO_DE_NÃO_CONFORMIDADE", "ANEXO_9_-_LISTA_DE_ESPECIFICAÇÕES", "Anexo_10_-_Etiqueta_produtos_manipulados", "ANEXO_11_-_Etiquetas_produtos_estocáveis",
    "ANEXO_12_-_ETIQUETA_REFIL_DE_FILTRO", "ANEXO_13_-_ETIQUETAS_DE_COLETA_DE_AMOSTRAS", "Cópia_de_Cópia_de_CONTROLE_DE_SAÍDA"].map((f) => ({
    file: `${f}.docx`, name: f.replace(/_/g, " ").replace(/^ANEXO \d+ - /i, ""), sector: "alimentacao", purpose: "Anexo da Cartilha da Alimentação Escolar 2026",
    fields: ["escola.nome", "data"], signatures: f.includes("TERMO") ? ["Inspetor(a)", "Direção"] : [], emissionRule: null,
    klass: "referencia-setorial" as const, studioTemplate: f.includes("NÃO_CONFORMIDADE") ? "nao-conformidade-alimentacao" : null })),
  { file: "Calendário_2026_assinado.pdf", name: "Calendário Escolar 2026 (assinado)", sector: "supervisao", purpose: "Calendário oficial publicado",
    fields: [], signatures: ["Supervisão"], emissionRule: "Já emitido pelo módulo Calendário", klass: "referencia-setorial", studioTemplate: null },
  { file: "Relatórios_de_Fechamento_-_*.pdf", name: "Recibos de fechamento do Censo", sector: "ciece", purpose: "Recibo oficial INEP",
    fields: [], signatures: [], emissionRule: "Emitido pelo INEP — não reproduzível pelo SIGEM", klass: "referencia-setorial", studioTemplate: null },
];

/** Documentos pedidos sem modelo no acervo ⇒ modelo-base rascunho, nunca texto "oficial". */
export const SECRETARIAT_WITHOUT_OFFICIAL_MODEL = [
  "declaracao-de-matricula", "declaracao-escolar", "transferencia", "atestado-de-escolaridade", "renovacao-de-matricula",
] as const;
