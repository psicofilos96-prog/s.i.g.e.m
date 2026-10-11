/**
 * Famílias de diário da rede (modelos enviados pelo proprietário em 2026-10-10, 90 planilhas, 7 famílias).
 * Cada família lista as folhas do modelo com o checklist do que a impressão do SIGEM reproduz:
 * campos, tabelas, cálculos, rodapés, assinaturas, paginação e periodização. É especificação de
 * leiaute (dado), não norma: pontuações e regras vêm de `network-model-rules.ts` com origem citada.
 */

export type FamilyId =
  | "educacao-infantil"
  | "fundamental-i"
  | "eja-i-v"
  | "componente-fii-eja"
  | "livro-de-notas"
  | "anexo-observacoes"
  | "frequencia-integral";

export type SheetKind =
  | "capa"
  | "frequencia"
  | "pap"
  | "notas-periodo"
  | "final-componente"
  | "fa-periodo"
  | "faltas"
  | "fa-ficha"
  | "observacoes"
  | "livro-periodo"
  | "anexo-mensal"
  | "frequencia-integral"
  // Emitidos pela Folha Final (mesma fonte e versão dos atos de conferência/homologação):
  | "folha-final"
  | "boletim"
  | "ficha-individual"
  | "ata-final";

export type SheetSpec = {
  kind: SheetKind;
  /** Nome da aba no modelo (com nº do período quando repetida). */
  source: string;
  title: string;
  orientation: "portrait" | "landscape";
  perPeriod: boolean;
  fields: readonly string[];
  tables: readonly string[];
  calculations: readonly string[];
  footer: readonly string[];
  signatures: readonly string[];
  pagination: string;
  /** "livro" = gerada nesta impressão; "folha-final" = emitida na Folha Final, com atos e hash. */
  emittedBy: "livro" | "folha-final";
};

export type FamilySpec = {
  id: FamilyId;
  label: string;
  /** Arquivos representativos do modelo (nomes como enviados). */
  models: readonly string[];
  /** Quantidade de períodos letivos do modelo; EJA = 2 por semestre. */
  periods: { count: number; unit: string };
  grade: "fundamental-ii" | "fundamental-i" | "sem-nota";
  /** Família de um único componente (Freq. nº PL + nº PL + FINAL). */
  singleComponent: boolean;
  sheets: readonly SheetSpec[];
};

const HEADER = ["Nome do estabelecimento", "Segmento – ano de escolaridade – turma", "Ano letivo"];
const PROF = ["Assinatura do professor"];
const CAPA: SheetSpec = {
  kind: "capa", source: "CAPA V", title: "Capa", orientation: "portrait", perPeriod: false,
  fields: ["Ano letivo de", "Nome do estabelecimento", "Turma", "Ano de escolaridade", "Turno", "Professor(a)"], tables: [], calculations: [], footer: ["Brasão e identificação da Secretaria"], signatures: [], pagination: "1 página", emittedBy: "livro",
};
const FREQ = (src: string, withGrades: boolean): SheetSpec => ({
  kind: "frequencia", source: src, title: "Diário de frequência do período", orientation: "landscape", perPeriod: true,
  fields: [...HEADER, withGrades ? "Áreas de conhecimento" : "Disciplina", "Meses do período", "Dia de cada aula"],
  tables: ["Nº, nome do aluno, uma coluna por aula (\".\" presente, \"F\" falta, \"—\" sem marcação)", "Total de faltas", ...(withGrades ? ["Notas do período por componente"] : []), "Lançamento do conteúdo lecionado (dia, conteúdo)"],
  calculations: ["Total de faltas = contagem de \"F\" no período", "Aulas dadas = aulas com chamada registrada", "Aulas previstas por mês e total"],
  footer: ["Obs.", "Data de encerramento"], signatures: PROF, pagination: "1 folha por período; conteúdo em continuação", emittedBy: "livro",
});
const OBS: SheetSpec = {
  kind: "observacoes", source: "Observações", title: "Observações", orientation: "portrait", perPeriod: false,
  fields: [...HEADER], tables: ["Nome, observação para a ficha individual"], calculations: [], footer: [], signatures: PROF, pagination: "1 linha por estudante", emittedBy: "livro",
};
const FF = (src: string): SheetSpec => ({
  kind: "folha-final", source: src, title: "Folha Final", orientation: "landscape", perPeriod: false,
  fields: [...HEADER, "Aulas dadas por período (AD)", "Total de aulas dadas anuais"],
  tables: ["Notas por período e componente", "Faltas dos períodos", "Total de faltas", "% frequência", "Média final", "Recuperação final", "Resultado final"],
  calculations: ["Média final = ROUND(média dos períodos)", "% frequência = ROUND((AD−faltas)/AD;2), 100% com falta = 99%", "Resultado pela regra homologada"],
  footer: ["Local e data"], signatures: PROF, pagination: "1 folha", emittedBy: "folha-final",
});
const BOL: SheetSpec = {
  kind: "boletim", source: "Boletim", title: "Boletim escolar", orientation: "portrait", perPeriod: false,
  fields: ["Secretaria Municipal de Educação", "Aluno", "Ano de escolaridade", "Turma", "Turno"], tables: ["Componentes × períodos (nota, faltas, recuperação)", "Faltas", "Frequência"], calculations: ["Mesma projeção da Folha Final"], footer: [], signatures: [], pagination: "2 boletins por página", emittedBy: "folha-final",
};
const FICHA: SheetSpec = {
  kind: "ficha-individual", source: "Ficha Individual", title: "Ficha individual", orientation: "portrait", perPeriod: false,
  fields: ["Estado do Rio de Janeiro", "Aluno", "Data de nascimento", "Filiação", "Naturalidade", "ID Censo", "Ano de escolaridade", "Turma", "Nº", "Turno", "Ano"],
  tables: ["Disciplinas × períodos (notas, faltas, aulas dadas)", "Média final", "Recuperação final", "Total de faltas anuais", "% de frequência"], calculations: ["Mesma projeção da Folha Final"], footer: ["Observações da ficha"], signatures: ["Secretário(a)", "Diretor(a)"], pagination: "1 por estudante", emittedBy: "folha-final",
};
const ATA: SheetSpec = {
  kind: "ata-final", source: "Ata Final", title: "Ata de resultados finais", orientation: "portrait", perPeriod: false,
  fields: ["Texto de abertura com data de encerramento", "Turma", "Ano/semestre"], tables: ["Relação nominal com resultado final"], calculations: ["Totais por resultado"], footer: [], signatures: ["Secretário(a)", "Diretor(a)"], pagination: "1 por turma", emittedBy: "folha-final",
};

export const FAMILIES: readonly FamilySpec[] = [
  {
    id: "educacao-infantil", label: "Educação Infantil", models: ["Diário - 1º Período 01.xlsx", "Diário - Maternal II 01.xlsx", "Diário - Berçário.xlsx"],
    periods: { count: 4, unit: "período letivo" }, grade: "sem-nota", singleComponent: false,
    sheets: [
      CAPA, FREQ("Diário nº PL", false),
      { kind: "fa-periodo", source: "FA - nº PL", title: "Ficha de acompanhamento do período", orientation: "landscape", perPeriod: true, fields: [...HEADER, "Campos de experiência", "Códigos dos objetivos (BNCC)"], tables: ["Estudante × objetivo registrado no parecer do período"], calculations: ["Sem nota: registra objetivos citados no parecer"], footer: [], signatures: PROF, pagination: "1 por período", emittedBy: "livro" },
      { kind: "faltas", source: "Faltas", title: "Faltas do ano", orientation: "portrait", perPeriod: false, fields: [...HEADER, "AD por período", "Total de aulas dadas anuais"], tables: ["Faltas dos períodos", "Total de faltas", "% frequência"], calculations: ["% frequência do modelo"], footer: [], signatures: PROF, pagination: "1 folha", emittedBy: "livro" },
      OBS,
      { kind: "fa-ficha", source: "FA", title: "Ficha de acompanhamento e avaliação do desenvolvimento", orientation: "portrait", perPeriod: false, fields: ["Estado do Rio de Janeiro / Prefeitura", "Aluno(a)", "Turno", "Ano", "Etapa"], tables: ["Aspectos observados por campo de experiência × 1º–4º P", "Parecer descritivo"], calculations: [], footer: ["Observações"], signatures: ["Professor(a)", "Coordenação/Orientação"], pagination: "1 por estudante", emittedBy: "livro" },
    ],
  },
  {
    id: "fundamental-i", label: "Fundamental I", models: ["Diário - 100.xlsx", "Diário - 200.xlsx", "Diário - 500.xlsx"],
    periods: { count: 4, unit: "período letivo" }, grade: "fundamental-i", singleComponent: false,
    sheets: [
      CAPA,
      { kind: "pap", source: "PAP nº PL", title: "Planilha de acompanhamento pedagógico", orientation: "landscape", perPeriod: true, fields: [...HEADER, "Período letivo", "Turma", "Professor", "Legenda AV1/AV2/IV/PA com pontuação"], tables: ["Estudante × componente (AV1, AV2, IV, PA, N)"], calculations: ["N = soma dos instrumentos lançados (PAP!G9)"], footer: ["Orientação"], signatures: PROF, pagination: "1 por período", emittedBy: "livro" },
      FREQ("Diário nº PL", true), FF("Folha Final"), BOL, OBS, FICHA,
    ],
  },
  {
    id: "eja-i-v", label: "EJA I–V (semestral)", models: ["Diário - Fase I.xlsx", "Diário - Fase II 1º sem - 1º semestre.xlsx", "Diário - Fase V 1º sem - 1º semestre.xlsx"],
    periods: { count: 2, unit: "período do semestre" }, grade: "fundamental-ii", singleComponent: false,
    sheets: [
      CAPA,
      { kind: "pap", source: "PAP nº PL", title: "Planilha de acompanhamento pedagógico", orientation: "landscape", perPeriod: true, fields: [...HEADER, "Período letivo", "Fase", "Professor"], tables: ["Estudante × componente (AV1, AV2, IV, PA, N)"], calculations: ["N do período pelo modelo da rede"], footer: [], signatures: PROF, pagination: "1 por período", emittedBy: "livro" },
      FREQ("Diário nº PL", true), FF("Folha Final"), BOL, OBS, FICHA, ATA,
    ],
  },
  {
    id: "componente-fii-eja", label: "Componente — Fundamental II / EJA VI–IX", models: ["1 - Língua Portuguesa - 600.xlsx", "3 - Matemática - Fase IX 1º sem.xlsx", "9 - Educação Física - 600.xlsx"],
    periods: { count: 4, unit: "período letivo" }, grade: "fundamental-ii", singleComponent: true,
    sheets: [
      CAPA, FREQ("Freq. nº PL", false),
      { kind: "notas-periodo", source: "nº PL", title: "Notas e frequência do período", orientation: "portrait", perPeriod: true, fields: [...HEADER, "Disciplina", "Professor", "Total de aulas previstas", "Total de aulas dadas"], tables: ["Faltas por mês", "Total de faltas", "% frequência", "AV1 (30)", "AV2 (30)", "Instrumentos variados (30)", "Participação (10)", "Total (100)", "Recuperação paralela (60)", "Nota final do PL (100)"], calculations: ["Nota do PL = MAX(AV1+AV2+IV+PA; RP+IV+PA) (nº PL!Q12)", "% frequência (nº PL!H12)"], footer: ["Observações"], signatures: PROF, pagination: "1 por período", emittedBy: "livro" },
      { kind: "final-componente", source: "FINAL", title: "Resultado final do componente", orientation: "portrait", perPeriod: false, fields: [...HEADER, "Disciplina", "Professor", "Aulas previstas e dadas por período e total"], tables: ["Notas por período", "Média final", "Recuperação final", "Faltas por período", "Total de faltas", "Resultado final"], calculations: ["Média final = ROUND(média dos PL) (FINAL!G8)", "Resultado = MAX(média; RF) ≥ 50 (FINAL!N8)", "Siglas T/E/MC/F por situação"], footer: [], signatures: PROF, pagination: "1 folha", emittedBy: "livro" },
    ],
  },
  {
    id: "livro-de-notas", label: "Livro de Notas (turma)", models: ["0 - Livro de Notas - 600.xlsx", "1 - Livro de notas e ficha individual - 600 - 2025.xlsx"],
    periods: { count: 4, unit: "período letivo" }, grade: "fundamental-ii", singleComponent: false,
    sheets: [
      { kind: "livro-periodo", source: "1º–4º", title: "Livro de notas do período", orientation: "landscape", perPeriod: true, fields: [...HEADER, "Período / ano", "AD por componente"], tables: ["Estudante × componente (nota N, faltas F)", "Faltas do período", "% frequência", "Média da turma por disciplina"], calculations: ["Nota do PL pelo modelo", "Média da turma = média das notas presentes"], footer: [], signatures: PROF, pagination: "1 por período", emittedBy: "livro" },
      FF("Folha Final"), BOL, FICHA, ATA,
      { kind: "observacoes", source: "OBS", title: "Observações por período", orientation: "portrait", perPeriod: false, fields: [...HEADER, "1º a 4º período letivo", "Folha Final"], tables: ["Observação por período"], calculations: [], footer: [], signatures: PROF, pagination: "1 folha", emittedBy: "livro" },
    ],
  },
  {
    id: "anexo-observacoes", label: "Anexo de observações (mensal)", models: ["Anexo Fundamental I.xlsx", "Anexo Educação Infantil.xlsx", "Anexo EJA Fase I.xlsx"],
    periods: { count: 4, unit: "período letivo" }, grade: "sem-nota", singleComponent: false,
    sheets: [{ kind: "anexo-mensal", source: "OBS", title: "Anexo — observações mensais", orientation: "landscape", perPeriod: true, fields: [...HEADER, "Período letivo", "AP (aulas previstas) e AD (aulas dadas) por mês"], tables: ["Mês × aulas previstas, aulas dadas e conteúdo registrado"], calculations: ["AD = aulas com registro no mês"], footer: [], signatures: PROF, pagination: "1 por período", emittedBy: "livro" }],
  },
  {
    id: "frequencia-integral", label: "Frequência integral (oficinas)", models: ["Frequência Integral - 1º PL.xlsx", "Frequência Integral - 2º PL.xlsx"],
    periods: { count: 4, unit: "período letivo" }, grade: "sem-nota", singleComponent: true,
    sheets: [{ kind: "frequencia-integral", source: "nº PL - Turma", title: "Frequência integral", orientation: "landscape", perPeriod: true, fields: ["Oficineiro", "Turma e etapa", "Período letivo", "Meses e dias"], tables: ["Nº, nome, uma coluna por aula (\".\"/\"F\")"], calculations: ["Total de faltas"], footer: [], signatures: ["Assinatura do oficineiro"], pagination: "1 folha por turma e período", emittedBy: "livro" }],
  },
];

export const familyOf = (id: FamilyId) => FAMILIES.find((f) => f.id === id)!;
