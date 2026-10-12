/**
 * L43 — catálogo versionado de áreas institucionais × perfis × verbos × escopo.
 * Só DESCREVE e confere: nenhuma capacidade nasce aqui. Autorização efetiva continua sendo
 * atuação vigente × política homologada (effective_capabilities + RLS + writers).
 * Cargo, matrícula funcional ou planilha importada nunca entram no cálculo.
 */
export const PROFILE_CATALOG_VERSION = "2026-10-12.1";

export type Verb = "visualizar" | "criar" | "editar" | "aprovar" | "exportar" | "importar" | "administrar";
export type Scope = "rede" | "escola" | "turma" | "estudante" | "caso";

/** Classifica um id de capability pelo verbo inicial; desconhecido ⇒ null (nunca presumido). */
const VERB_PREFIX: ReadonlyArray<[RegExp, Verb]> = [
  [/^(consultar|localizar|ler|ver|acompanhar)-/, "visualizar"],
  [/^(registrar|cadastrar|abrir|solicitar|inscrever|propor|programar|emitir|entregar|realizar|preparar|incorporar|lancar)-/, "criar"],
  [/^(manter|corrigir|retificar|executar|reprocessar|devolver|reabrir|encerrar|atender|gerir|curar|restringir|tratar|testar|receber|conferir|revisar)-/, "editar"],
  [/^(homologar|aprovar|oficializar|autorizar|validar|confirmar|deferir|encerrar-inventarios)-/, "aprovar"],
  [/^(exportar|publicar)-/, "exportar"],
  [/^importar-/, "importar"],
  [/^(administrar|configurar|construir)-/, "administrar"],
];
export function verbOf(capability: string): Verb | null {
  for (const [re, v] of VERB_PREFIX) if (re.test(capability)) return v;
  return null;
}

/** Padrões que um perfil NUNCA pode receber (segregação/LGPD). */
export const SENSITIVE = {
  notas: /resultado-avaliativo|pauta|situacao-academica|parecer-descritivo|frequencia/,
  saude: /prontuario|nei|aee|saude|laudo|cid/,
  rh: /registro-funcional|lotacao|atribuicao-docente|servidor|quadro-profissional/,
  identidadeEstudante: /identidade-cadastral-do-estudante/,
  politica: /politica-de-capacidades|atuacoes-institucionais|contas-institucionais/,
} as const;

export type Area = {
  id: string;
  label: string;
  /** Tipos de atuação HOMOLOGADOS que hoje servem a área; vazio ⇒ área sem titular possível. */
  kinds: readonly string[];
  scopes: readonly Scope[];
  forbidden: readonly (keyof typeof SENSITIVE)[];
  /** Por que está bloqueada, quando não há tipo homologado. */
  blocker?: string;
};

const SEM_TIPO = "Sem tipo de atuação na política homologada vigente; exige nova versão da política homologada por quem tem competência.";

export const AREAS: readonly Area[] = [
  { id: "administracao-central", label: "Administração central da SEMED", kinds: ["administrador-geral-do-sigem", "cadastro-institucional-da-rede"], scopes: ["rede"], forbidden: [] },
  { id: "direcao-escolar", label: "Direção Escolar", kinds: ["direcao-escolar"], scopes: ["escola"], forbidden: ["politica"] },
  { id: "secretaria-escolar", label: "Secretaria Escolar", kinds: ["secretaria-escolar"], scopes: ["escola"], forbidden: ["politica", "saude"] }, // política v8 dá lotação/quadro DA ESCOLA à Secretaria
  { id: "supervisao-escolar", label: "Supervisão Escolar", kinds: ["gestao-pedagogica-da-rede"], scopes: ["rede", "escola"], forbidden: ["politica", "rh"] },
  { id: "orientacao-pedagogica", label: "Orientação Pedagógica", kinds: ["orientacao-pedagogica"], scopes: ["escola", "turma"], forbidden: ["politica", "rh"] },
  { id: "docente", label: "Docente", kinds: ["professor"], scopes: ["turma"], forbidden: ["politica", "rh", "identidadeEstudante"] },
  { id: "mediador", label: "Mediador Escolar", kinds: [], scopes: ["estudante"], forbidden: ["politica", "rh", "notas"], blocker: SEM_TIPO },
  { id: "nei-aee", label: "NEI / AEE", kinds: [], scopes: ["caso", "escola"], forbidden: ["politica", "rh", "notas"], blocker: SEM_TIPO },
  { id: "familia", label: "Família / responsável", kinds: [], scopes: ["estudante"], forbidden: ["politica", "rh", "saude"], blocker: "Acesso só por vínculo responsável verificado + matrícula ativa (portal próprio); nenhum vínculo verificado registrado." },
  { id: "alimentacao", label: "Alimentação Escolar", kinds: [], scopes: ["rede", "escola"], forbidden: ["politica", "rh", "notas", "saude"], blocker: SEM_TIPO },
  { id: "ciece", label: "Informações, Estatística e Censo", kinds: ["ciece-estatistica", "ciece-auditoria-coordenacao"], scopes: ["rede"], forbidden: ["politica", "rh", "saude", "identidadeEstudante"] },
  { id: "avaliacao", label: "Acompanhamento e Avaliação", kinds: [], scopes: ["rede", "escola"], forbidden: ["politica", "rh", "saude"], blocker: SEM_TIPO },
  { id: "gestao-de-pessoas", label: "Gestão de Pessoas, Lotação e Atribuição", kinds: ["rh-profissionais-da-rede"], scopes: ["rede"], forbidden: ["politica", "notas", "saude"] },
  { id: "organizacao-da-rede", label: "Organização da Rede, Matrículas e Vagas", kinds: [], scopes: ["rede"], forbidden: ["politica", "rh", "saude"], blocker: SEM_TIPO },
  { id: "documental", label: "Gestão Documental e Protocolo", kinds: [], scopes: ["rede", "escola"], forbidden: ["politica", "notas", "saude"], blocker: SEM_TIPO },
  { id: "busca-ativa", label: "Busca Ativa e Permanência", kinds: [], scopes: ["escola", "estudante"], forbidden: ["politica", "rh", "notas"], blocker: SEM_TIPO },
  { id: "operacoes", label: "Transporte, Infraestrutura e Patrimônio", kinds: [], scopes: ["rede", "escola"], forbidden: ["politica", "rh", "notas", "saude", "identidadeEstudante"], blocker: SEM_TIPO },
  { id: "formacao", label: "Formação Continuada", kinds: [], scopes: ["rede"], forbidden: ["politica", "notas", "saude"], blocker: SEM_TIPO },
  { id: "tecnologia", label: "Tecnologia Educacional e Suporte TI", kinds: [], scopes: ["rede", "escola"], forbidden: ["politica", "rh", "notas", "saude", "identidadeEstudante"], blocker: SEM_TIPO },
  { id: "importacao-tecnica", label: "Operações técnicas de importação", kinds: [], scopes: ["rede"], forbidden: ["politica", "rh", "notas", "saude", "identidadeEstudante"], blocker: "Identidade não humana: só executores técnicos estreitos sem EXECUTE para app roles; nunca recebe atuação." },
];

export type PolicyRule = readonly [kind: string, capability: string, scope: readonly string[]];

/** Capabilities de uma área segundo a política lida (união de tipos; pessoa com 2 vínculos une, nunca duplica). */
export function areaCapabilities(area: Area, rules: readonly PolicyRule[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [k, c, s] of rules) if (area.kinds.includes(k)) {
    const set = out.get(c) ?? new Set<string>(); for (const x of s) set.add(x); out.set(c, set);
  }
  return out;
}

/** Violações de segregação: capability da política que cai num padrão proibido para a área. */
export function segregationViolations(rules: readonly PolicyRule[]) {
  const v: { area: string; capability: string; rule: string }[] = [];
  for (const a of AREAS) for (const c of areaCapabilities(a, rules).keys())
    for (const f of a.forbidden) if (SENSITIVE[f].test(c)) v.push({ area: a.id, capability: c, rule: f });
  return v;
}

/** Matriz área × verbo (contagem), só leitura; verbo não classificado aparece como "?" */
export function verbMatrix(rules: readonly PolicyRule[]) {
  return AREAS.map((a) => {
    const caps = [...areaCapabilities(a, rules).keys()];
    const byVerb: Record<string, number> = {};
    for (const c of caps) { const k = verbOf(c) ?? "?"; byVerb[k] = (byVerb[k] ?? 0) + 1; }
    return { area: a.id, total: caps.length, byVerb, blocked: !a.kinds.length };
  });
}

/**
 * L44 — tipos de atuação PROPOSTOS para as áreas sem perfil. Proposta não é política:
 * nada aqui entra em `kinds` nem em effective_capabilities até homologação competente.
 */
export const PROPOSED_AREA_KINDS: Readonly<Record<string, string>> = {
  mediador: "proposta:mediador-escolar",
  "nei-aee": "proposta:nei-aee",
  alimentacao: "proposta:alimentacao-escolar",
  avaliacao: "proposta:acompanhamento-e-avaliacao",
  "organizacao-da-rede": "proposta:organizacao-da-rede-e-vagas",
  documental: "proposta:gestao-documental-e-protocolo",
  "busca-ativa": "proposta:busca-ativa-e-permanencia",
  operacoes: "proposta:transporte-infra-patrimonio",
  formacao: "proposta:formacao-continuada",
  tecnologia: "proposta:tecnologia-e-suporte",
};
