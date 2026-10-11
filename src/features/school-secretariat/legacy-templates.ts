// SIGEM 2.0 — Lote complementar 09: inventário e classificação de modelos legados (núcleo puro).
// Classifica só por NOME/CAMINHO do arquivo (nunca abre conteúdo, nunca executa macro).
// Arquivo cujo nome indica registro de pessoa vira "registro-pessoal" e é EXCLUÍDO (só contado, sem nome).
// Modelo reutilizável é só CANDIDATO: vira template editável apenas por revisão humana no Studio de documentos.

export type Routine = "atestado-escolaridade" | "declaracao-transferencia" | "declaracao-frequencia-servidor" | "autorizacao" | "renovacao-matricula"
  | "ficha-matricula" | "conferencia-documental" | "oficio" | "ata" | "bolsa-familia" | "calendario" | "arquivo-morto" | "carimbo-timbrado"
  | "bilhete-aviso" | "controle-secretaria" | "nao-classificado";

const RULES: [Routine, RegExp][] = [
  ["atestado-escolaridade", /atestado\W+de\W+escolaridade|atestados escolaridade/i],
  ["declaracao-transferencia", /transfer/i],
  ["declaracao-frequencia-servidor", /frequencia de professor|frequ.ncia mensal|ponto /i],
  ["autorizacao", /autoriza/i],
  ["renovacao-matricula", /renova/i],
  ["ficha-matricula", /ficha de matr/i],
  ["conferencia-documental", /checagem de documentos|documentos necess/i],
  ["oficio", /of.cio/i],
  ["ata", /\bata\b|atas /i],
  ["bolsa-familia", /bolsa fam/i],
  ["calendario", /calend/i],
  ["arquivo-morto", /arquivo morto/i],
  ["carimbo-timbrado", /carimbo|timbrad|capa /i],
  ["bilhete-aviso", /bilhete|aviso|cartaz/i],
  ["controle-secretaria", /controle/i],
];

/** Sinais de modelo em branco: "limpo", "Nome do aluno", "modelo", "ZZ -". */
const BLANK = /limpo|nome do aluno|modelo|^zz\W/i;
/** Sinais de registro pessoal: numeração sequencial + nome, pasta por pessoa, turma, planilha de alunos. */
const PERSONAL = /^\d{2}\s-\s|alunos?\s|datas de nascimento|irm[aã]os|\(av.? guarda\)|trabalho pai|pedidos de/i;

export interface InventoryRow { path: string; ext: string; routine: Routine; kind: "modelo-candidato" | "registro-pessoal" | "referencia"; macroRisk: boolean; versionKey: string }

export function classify(path: string): InventoryRow {
  const name = path.split("/").pop() ?? path;
  const dir = path.split("/").slice(0, -1).join("/");
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const routine = RULES.find(([, re]) => re.test(path))?.[0] ?? "nao-classificado";
  const personFolder = /frequencia de professor - \d{4}\/[^/]+\//i.test(path) || /bolsa familia/i.test(dir);
  const kind = BLANK.test(name) ? "modelo-candidato" : (PERSONAL.test(name) || personFolder) ? "registro-pessoal" : "referencia";
  const versionKey = `${routine}:${name.toLowerCase().replace(/\.[^.]+$/, "").replace(/\s*(-\s*)?(c.pia|\(\d+\)|\d{4}|-?\d)\s*$/g, "").replace(/[^a-z]+/g, " ").trim()}`;
  return { path, ext, routine, kind, macroRisk: ["doc", "xls", "xlsm", "docm"].includes(ext), versionKey };
}

/** Resumo sem nomes: registros pessoais só contados; duplicatas/versões agrupadas por chave; macro nunca executada. */
export function summarize(paths: string[]) {
  const rows = paths.filter((p) => !p.endsWith("/") && /\.[a-z0-9]+$/i.test(p)).map(classify);
  const byRoutine: Record<string, { modelos: number; pessoais: number; referencias: number }> = {};
  for (const r of rows) {
    const b = (byRoutine[r.routine] ??= { modelos: 0, pessoais: 0, referencias: 0 });
    if (r.kind === "modelo-candidato") b.modelos++; else if (r.kind === "registro-pessoal") b.pessoais++; else b.referencias++;
  }
  const safe = rows.filter((r) => r.kind !== "registro-pessoal");
  const groups = new Map<string, InventoryRow[]>();
  for (const r of safe) groups.set(r.versionKey, [...(groups.get(r.versionKey) ?? []), r]);
  return { total: rows.length, byRoutine, candidates: safe.filter((r) => r.kind === "modelo-candidato"),
    versionGroups: [...groups.values()].filter((g) => g.length > 1).map((g) => g.map((r) => r.path)),
    macroRiskCount: rows.filter((r) => r.macroRisk).length };
}

/** Rastreabilidade arquivo→processo→modelo→tela. Modelo só "rascunho-nao-homologado" até revisão humana no Studio. */
export const ROUTINE_TRACE: Record<Routine, { processo: string; tela: string | null; campos: string[] }> = {
  "atestado-escolaridade": { processo: "Emissão de declaração escolar", tela: "/central-de-documentos", campos: ["estudante.nome", "matricula.escola", "alocacao.turma", "matricula.ano"] },
  "declaracao-transferencia": { processo: "Transferência (secretariat_record_exit)", tela: "/transferencias", campos: ["estudante.nome", "matricula.escola", "alocacao.turma", "saida.data", "saida.destino"] },
  "declaracao-frequencia-servidor": { processo: "DP administrativo — declaração de frequência", tela: null, campos: ["servidor.nome", "servidor.matricula_funcional", "lotacao.escola", "frequencia.mes"] },
  autorizacao: { processo: "Autorização de responsável (Família)", tela: "/autorizacoes-familia", campos: ["estudante.nome", "responsavel.nome", "autorizacao.secao", "autorizacao.vigencia"] },
  "renovacao-matricula": { processo: "Rematrícula (rito não definido pela rede)", tela: null, campos: [] },
  "ficha-matricula": { processo: "Matrícula guiada", tela: "/matriculas/nova", campos: ["estudante.*", "responsavel.*", "matricula.*"] },
  "conferencia-documental": { processo: "Checklist documental (lote 05)", tela: null, campos: ["checklist.exigencias"] },
  oficio: { processo: "Ofícios (GED, numeração por tipo/ano/unidade)", tela: null, campos: ["oficio.numero", "oficio.destinatario", "oficio.assunto"] },
  ata: { processo: "Atas (Conselho/colegiado)", tela: null, campos: ["sessao.data", "deliberacoes"] },
  "bolsa-familia": { processo: "Acompanhamento Bolsa Família (leiaute oficial pendente)", tela: null, campos: [] },
  calendario: { processo: "Calendário oficial (somente leitura)", tela: "/calendario", campos: [] },
  "arquivo-morto": { processo: "Arquivo escolar digital (taxonomia pendente)", tela: null, campos: [] },
  "carimbo-timbrado": { processo: "Identidade institucional do documento", tela: "/central-de-documentos", campos: ["escola.nome", "escola.inep"] },
  "bilhete-aviso": { processo: "Comunicação escola–família", tela: "/comunicacao-escolar", campos: [] },
  "controle-secretaria": { processo: "Controles internos (livros/numeração)", tela: "/secretaria/livro-matricula", campos: [] },
  "nao-classificado": { processo: "Revisão humana", tela: null, campos: [] },
};
