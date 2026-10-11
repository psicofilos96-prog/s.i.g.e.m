/**
 * TABELAS SEMED (04, 06, 09, 10, 11) — estrutura extraída do guia enviado pelo usuário
 * (TABELAS_SEMED_-_Guia_de_Estrutura.md). Esta é a FONTE do catálogo gravado no banco
 * (`semed_table_catalog`, versão por ano); o banco valida cada valor contra as chaves daqui.
 * Mudança de estrutura = nova versão do catálogo, nunca edição da versão gravada.
 * Campos `central` não são digitados: vêm do cadastro central na leitura.
 */
export type FieldType = "int" | "text" | "enum";
export type CentralRef = "escola" | "inep" | "distrito" | "zona" | "telefone" | "email" | "matricula-ativa" | "diretor" | "nei-mediacao" | "matricula-etapa";
export type Field = { key: string; label: string; type: FieldType; options?: readonly string[]; central?: CentralRef; min?: number; max?: number };
export type GridCol = { key: string; label: string; type: FieldType; options?: readonly string[] };
export type Section =
  | { id: string; title: string; kind: "fields"; fields: readonly Field[] }
  | { id: string; title: string; kind: "grid"; rows: readonly { key: string; label: string; group?: string }[]; cols: readonly GridCol[]; rowTotal?: boolean; colTotal?: boolean };
export type TableCode = "04" | "06" | "09" | "10" | "11";
export type TableDef = { code: TableCode; title: string; landscape: boolean; sections: readonly Section[] };

const SN = ["Sim", "Não"] as const;
const int = (key: string, label: string, max?: number, min?: number): Field => ({ key, label, type: "int", ...(max !== undefined ? { max } : {}), ...(min !== undefined ? { min } : {}) });
const txt = (key: string, label: string): Field => ({ key, label, type: "text" });
const yn = (key: string, label: string): Field => ({ key, label, type: "enum", options: SN });
const central = (key: string, label: string, c: CentralRef): Field => ({ key, label, type: "text", central: c });

const HEADER: Section = { id: "id", title: "Identificação", kind: "fields", fields: [central("escola", "Escola", "escola"), central("inep", "Código INEP", "inep")] };
const FOOTER: Section = { id: "rodape", title: "Responsáveis", kind: "fields", fields: [txt("estabelecimento", "Responsável pelo estabelecimento"), txt("preenchimento", "Responsável pelo preenchimento"), txt("data", "Data (dd/mm/aaaa)")] };

const EF = Array.from({ length: 9 }, (_, i) => ({ key: `ef${i + 1}`, label: `${i + 1}º Ano` }));
const EI = [{ key: "creche", label: "Creche" }, { key: "pre1", label: "Pré I" }, { key: "pre2", label: "Pré II" }];
const AGES = [{ key: "a0-1", label: "0 a 1 ano" }, ...Array.from({ length: 18 }, (_, i) => ({ key: `a${i + 2}`, label: `${i + 2} anos` })),
  ...["20-24", "25-29", "30-34", "35-39", "40-49", "50-59"].map((r) => ({ key: `a${r}`, label: `${r.replace("-", " a ")} anos` })), { key: "a60", label: "60+ anos" }];

export const SEMED_TABLES_2026: readonly TableDef[] = [
  { code: "04", title: "TABELA DISTORÇÃO SÉRIE x IDADE", landscape: true, sections: [HEADER, {
    id: "m", title: "Alunos por etapa/ano e idade", kind: "grid", rowTotal: true, colTotal: true,
    cols: AGES.map((a) => ({ ...a, type: "int" as const })),
    rows: [...EI.map((r) => ({ ...r, group: "Educação Infantil" })), ...EF.map((r) => ({ ...r, group: "Ensino Fundamental — Regular" })),
      ...[3, 4, 5].map((n) => ({ key: `tec1-${n}`, label: `TEC I — ${n}º Ano`, group: "TEC I" })),
      ...[6, 7, 8, 9].map((n) => ({ key: `tec2-${n}`, label: `TEC II — ${n}º Ano`, group: "TEC II" })),
      { key: "eja1", label: "EJA I a V", group: "EJA" }, { key: "eja2", label: "EJA VI a IX", group: "EJA" }],
  }, FOOTER] },
  { code: "06", title: "MATRÍCULA POR ANO DE ESCOLARIDADE, SEGUNDO O MOVIMENTO ESCOLAR", landscape: true, sections: [HEADER, {
    id: "m", title: "Movimento e rendimento por ano", kind: "grid", colTotal: true, rows: [...EI, ...EF],
    cols: [["inicial", "Matrícula inicial"], ["recebidos", "Recebidos"], ["transferencia", "Transferência"], ["cancelamento", "Cancelamento"], ["evasao", "Evasão"], ["aprovados", "Aprovados"], ["reprovados", "Reprovados"]]
      .map(([key, label]) => ({ key: key!, label: label!, type: "int" as const })),
  }, FOOTER] },
  { code: "09", title: "LEVANTAMENTO DE INFRAESTRUTURA FÍSICA E EQUIPAMENTOS DA UNIDADE ESCOLAR", landscape: false, sections: [
    { id: "id", title: "Identificação", kind: "fields", fields: [central("escola", "Escola", "escola"), central("inep", "Código INEP", "inep"), central("distrito", "Distrito", "distrito"), central("zona", "Zona", "zona"), int("turnos", "Nº de turnos", 4), int("turmas", "Nº de turmas", 200)] },
    { id: "gestao", title: "Contato e gestão", kind: "fields", fields: [central("diretor", "Diretor(a) geral", "diretor"), txt("adjunto", "Diretor(a) adjunto(a)"), txt("mat_diretor", "Matrícula funcional do(a) diretor(a)"), central("telefone", "Telefone", "telefone"), central("email", "E-mail", "email")] },
    { id: "predial", title: "Situação predial", kind: "fields", fields: [txt("regime", "Regime do imóvel"), int("ano_construcao", "Ano de construção", 2100, 1800), yn("compartilha", "Compartilha prédio com outra unidade"), { key: "situacao", label: "Situação do prédio", type: "enum", options: ["Próprio", "Cedido", "Alugado"] }, { key: "estado", label: "Estado de uso", type: "enum", options: ["S/Condições", "Precário", "Adequado", "Excelente"] }] },
    { id: "acessibilidade", title: "Acessibilidade", kind: "fields", fields: [yn("rampas", "Possui rampas de acessibilidade"), yn("banheiro_pcd", "Banheiro adaptado PCD"), yn("laudo_acess", "Possui laudo de acessibilidade")] },
    { id: "transporte", title: "Transporte escolar", kind: "fields", fields: [int("alunos", "Alunos que dependem de transporte", 5000), { key: "tipo", label: "Tipo", type: "enum", options: ["Próprio", "Terceirizado"] }, int("rotas", "Nº de rotas", 100)] },
    { id: "aee", title: "Inclusão / AEE (somente contagens)", kind: "fields", fields: [int("com_laudo", "Alunos com laudo", 5000), int("com_mediador", "Alunos com mediador", 5000), central("nei_mediacao", "Estudantes com mediação vigente registrada no NEI (referência)", "nei-mediacao"), yn("srm", "Possui sala de recursos multifuncional")] },
    { id: "espacos", title: "Biblioteca e espaços", kind: "fields", fields: [yn("biblioteca", "Biblioteca/sala de leitura"), yn("quadra", "Quadra esportiva"), yn("quadra_coberta", "Quadra coberta")] },
    { id: "seguranca", title: "Segurança", kind: "fields", fields: [yn("cameras", "Possui câmeras"), int("qtd_cameras", "Quantidade de câmeras", 500), yn("portao", "Portão eletrônico"), txt("vigilancia", "Tipo de vigilância")] },
    { id: "matricula", title: "Matrícula por etapa (cadastro central)", kind: "fields", fields: [central("ativa", "Matrícula ativa no cadastro central", "matricula-ativa"), ...["Creche", "Pré-Escola", "1º Ano", "2º ao 5º Ano", "6º ao 9º Ano", "EJA F I-V", "EJA F VI-IX"].map((l, i) => central(`e${i + 1}`, l, "matricula-etapa"))] },
    { id: "salas", title: "Salas", kind: "fields", fields: [int("uso", "Em uso", 200), int("ociosas", "Ociosas", 200)] },
    { id: "sanitarios", title: "Sanitários (vasos)", kind: "fields", fields: [int("masc", "Masculino", 200), int("fem", "Feminino", 200), int("prof", "Professor", 200)] },
    { id: "equip", title: "Equipamentos em condição de uso", kind: "fields", fields: [...["Computador administrativo", "Computador para alunos", "Notebook", "Tablet", "Impressora", "Projetor", "TV", "Aparelho de som", "Ar-condicionado", "Ventilador", "Bebedouro", "Bomba d'água"].map((l, i) => int(`q${i + 1}`, l, 2000)), yn("internet", "Possui internet")] },
    { id: "cozinha", title: "Cozinha e alimentação", kind: "fields", fields: [...["Fogão industrial", "Fogão doméstico", "Freezer", "Geladeira", "Liquidificador", "Micro-ondas", "Forno", "Balança", "Filtro"].map((l, i) => int(`q${i + 1}`, l, 200)), { key: "alimentacao", label: "Alimentação", type: "enum", options: ["Própria", "Terceirizada"] }, txt("fornecedor", "Fornecedor")] },
    { id: "instalacoes", title: "Instalações físicas", kind: "fields", fields: ["Diretoria", "Secretaria", "Sala de professores", "Biblioteca", "Sala de AEE", "Laboratório de informática", "Laboratório de ciências", "Sala de TV/vídeo", "Quadra", "Quadra coberta", "Pátio coberto", "Refeitório", "Cozinha", "Depósito de alimentos", "Sanitário adequado à pré-escola"].map((l, i) => yn(`d${i + 1}`, l)) },
    { id: "manutencao", title: "Manutenção", kind: "fields", fields: [txt("ultimo_servico", "Data do último serviço (pintura/telhado/estrutura)"), txt("necessidades", "Serviços de manutenção necessários")] },
    { id: "outras", title: "Observações", kind: "fields", fields: [txt("texto", "Outras informações importantes")] },
    FOOTER,
  ] },
  { code: "10", title: "ESCOLARIZAÇÃO DO SERVIDOR", landscape: true, sections: [HEADER, {
    id: "s", title: "Servidores (até 30)", kind: "grid",
    rows: Array.from({ length: 30 }, (_, i) => ({ key: `n${i + 1}`, label: String(i + 1) })),
    cols: [{ key: "nome", label: "Nome do servidor", type: "text" }, { key: "cargo", label: "Cargo", type: "text" }, { key: "funcao", label: "Função", type: "text" },
      { key: "fund", label: "Fundamental", type: "enum", options: ["Fund. Completo", "Fund. Incompleto"] },
      { key: "medio", label: "Médio", type: "enum", options: ["Formação Geral", "Normal/Magistério", "Curso Técnico"] },
      { key: "sup", label: "Superior", type: "enum", options: ["Bacharelado em", "Licenciatura em", "Tecnológico em"] }, { key: "sup_curso", label: "Curso superior", type: "text" },
      { key: "pos", label: "Pós-graduação", type: "enum", options: ["Especialização em", "Mestrado em", "Doutorado em"] }, { key: "pos_curso", label: "Área da pós", type: "text" }],
  }, FOOTER] },
  { code: "11", title: "MATRÍCULA INICIAL POR ANO DE ESCOLARIDADE SEGUNDO O GÊNERO", landscape: false, sections: [
    { id: "id", title: "Identificação", kind: "fields", fields: [central("escola", "Escola", "escola"), central("inep", "Código INEP", "inep"), central("zona", "Zona", "zona")] }, {
    id: "m", title: "Matrícula inicial por gênero", kind: "grid", colTotal: true,
    rows: [...EI, ...EF, { key: "tec1", label: "TEC 1" }, { key: "tec2", label: "TEC 2" }, { key: "eja", label: "EJA" }],
    cols: [{ key: "masc", label: "Masculino", type: "int" }, { key: "fem", label: "Feminino", type: "int" }],
  }, FOOTER] },
];

export type KeySpec = { type: FieldType; options?: readonly string[]; min?: number; max?: number };

/** Chaves digitáveis (exclui centrais). Grid: `sec.row.col`; campos: `sec.key`. */
export function editableKeys(def: TableDef): Record<string, KeySpec> {
  const out: Record<string, KeySpec> = {};
  for (const s of def.sections) {
    if (s.kind === "fields") { for (const f of s.fields) if (!f.central) out[`${s.id}.${f.key}`] = { type: f.type, ...(f.options ? { options: f.options } : {}), ...(f.min !== undefined ? { min: f.min } : {}), ...(f.max !== undefined ? { max: f.max } : {}) }; }
    else for (const r of s.rows) for (const c of s.cols) out[`${s.id}.${r.key}.${c.key}`] = c.options ? { type: c.type, options: c.options } : { type: c.type };
  }
  return out;
}

export type Values = Readonly<Record<string, string | number | null | undefined>>;
const n = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** Soma que respeita ausência: nenhuma parcela informada ⇒ null (nunca 0 inventado). */
export function sumPresent(xs: readonly (number | null)[]): number | null {
  const p = xs.filter((x): x is number => x !== null);
  return p.length ? p.reduce((a, b) => a + b, 0) : null;
}
export function pct(num: number | null, den: number | null): string | null {
  if (num === null || den === null || den === 0) return null;
  return `${(Math.round((num / den) * 1000) / 10).toFixed(1).replace(".", ",")}%`;
}

/** Tabela 06: matrícula final só com TODAS as parcelas informadas (balanço do guia §3.2). */
export function t06Final(v: Values, row: string): number | null {
  const g = (c: string) => n(v[`m.${row}.${c}`]);
  const parts = ["inicial", "recebidos", "transferencia", "cancelamento", "evasao"].map(g);
  if (parts.some((x) => x === null)) return null;
  const [i, r, t, c, e] = parts as number[];
  return i! + r! - t! - c! - e!;
}

export function rowTotal(v: Values, sec: string, row: string, cols: readonly GridCol[]): number | null {
  return sumPresent(cols.map((c) => n(v[`${sec}.${row}.${c.key}`])));
}
export function colTotal(v: Values, sec: string, col: string, rows: readonly { key: string }[]): number | null {
  return sumPresent(rows.map((r) => n(v[`${sec}.${r.key}.${col}`])));
}

/** Validação local (espelha o banco) — o banco é a garantia. */
export function validateValues(def: TableDef, v: Values): string[] {
  const keys = editableKeys(def); const errs: string[] = [];
  for (const [k, x] of Object.entries(v)) {
    if (x === null || x === undefined || x === "") continue;
    const s = keys[k];
    if (!s) { errs.push(`Campo desconhecido: ${k}`); continue; }
    if (s.type === "int" && !(typeof x === "number" && Number.isInteger(x) && x >= (s.min ?? 0) && x <= (s.max ?? 100000))) errs.push(`${k}: inteiro entre ${s.min ?? 0} e ${s.max ?? 100000}`);
    if (s.type === "text" && !(typeof x === "string" && x.length <= 500)) errs.push(`${k}: texto até 500`);
    if (s.type === "enum" && !(typeof x === "string" && s.options?.includes(x))) errs.push(`${k}: opção inválida`);
  }
  return errs;
}

/** Ciclo (espelha `semed_next_state` no banco). */
export type SemedState = "rascunho" | "em-conferencia" | "devolvido" | "conferido" | "enviado" | "recebido" | "revisao-solicitada" | "fechado";
export type SemedAct = "salvar" | "enviar-conferencia" | "devolver" | "conferir" | "enviar" | "receber" | "solicitar-revisao" | "fechar";
const NEXT: Record<SemedAct, { from: readonly SemedState[]; to: SemedState; who: "preenche" | "confere" | "rede"; reason?: true }> = {
  salvar: { from: ["rascunho", "devolvido", "revisao-solicitada"], to: "rascunho", who: "preenche" },
  "enviar-conferencia": { from: ["rascunho"], to: "em-conferencia", who: "preenche" },
  devolver: { from: ["em-conferencia"], to: "devolvido", who: "confere", reason: true },
  conferir: { from: ["em-conferencia"], to: "conferido", who: "confere" },
  enviar: { from: ["conferido"], to: "enviado", who: "confere" },
  receber: { from: ["enviado"], to: "recebido", who: "rede" },
  "solicitar-revisao": { from: ["recebido"], to: "revisao-solicitada", who: "rede", reason: true },
  fechar: { from: ["recebido"], to: "fechado", who: "rede" },
};
export function nextState(state: SemedState, act: SemedAct): SemedState | null {
  return NEXT[act].from.includes(state) ? NEXT[act].to : null;
}
export const actWho = (a: SemedAct) => NEXT[a].who;
export const actNeedsReason = (a: SemedAct) => !!NEXT[a].reason;
export const ACTS = Object.keys(NEXT) as SemedAct[];
export const STATE_LABEL: Record<SemedState, string> = {
  rascunho: "Rascunho", "em-conferencia": "Em conferência", devolvido: "Devolvido pela conferência", conferido: "Conferido",
  enviado: "Enviado à SEMED", recebido: "Recebido pela SEMED", "revisao-solicitada": "Revisão solicitada pela SEMED", fechado: "Fechado",
};
export const ACT_LABEL: Record<SemedAct, string> = {
  salvar: "Salvar rascunho", "enviar-conferencia": "Enviar para conferência", devolver: "Devolver", conferir: "Conferir",
  enviar: "Enviar à SEMED", receber: "Registrar recebimento", "solicitar-revisao": "Solicitar revisão", fechar: "Fechar",
};
