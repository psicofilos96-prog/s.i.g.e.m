/**
 * Frente AD — catálogo versionado de indicadores da rede. Projeção pura: nenhum indicador grava fato.
 * Fórmula é avaliador de lista FECHADA (implementação auditada no motor 14.2); texto livre JS/SQL é recusado.
 * Indicador cuja frente não fechou com fonte canônica fica `unavailable` com o motivo, nunca zero.
 */

export const EVALUATORS = ["contagem-fatos", "contagem-distinta", "proporcao-entre-selecoes", "saldo-entre-selecoes", "projecao-oficial"] as const;
export type EvaluatorId = (typeof EVALUATORS)[number];
export type Nature = "observado-importado" | "operacional" | "oficial" | "derivado";
export type DependencyState = { front: string; ready: boolean; reason: string };

export type IndicatorDefinition = Readonly<{
  key: string; version: number; name: string; definition: string;
  evaluator: EvaluatorId; factTypes: readonly string[]; unit: "escolas" | "matriculas" | "movimentacoes" | "turmas" | "blocos" | "registros" | "proporcao";
  window: "fotografia" | "intervalo"; dimensions: readonly string[]; nature: Nature;
  dependsOn: readonly string[]; status: "rascunho" | "publicado"; provenance: string;
}>;

/** Estado das frentes S–AC segundo os fechamentos relatados; `ready` só quando há fonte canônica com dados ou leitura real. */
/** Fixture de teste/metadado apenas — nunca fonte de runtime (AD.1: use resolveDependencies). */
export const FRONT_STATE_FIXTURE: Readonly<Record<string, DependencyState>> = {
  cadastro: { front: "Cadastro das escolas", ready: true, reason: "55 escolas no writer canônico." },
  infraestrutura: { front: "B (infraestrutura)", ready: true, reason: "Fatos importados com proveniência." },
  matricula: { front: "F (matrículas)", ready: true, reason: "Matrículas importadas; inscrições 2027 inexistentes." },
  movimentacao: { front: "F (movimentações)", ready: false, reason: "Sem início efetivo, movimentações não foram constituídas." },
  mapa: { front: "T (Mapa Estatístico)", ready: false, reason: "Nenhum mapa oficial: 2027 sem estado operacional e sem regra humana homologada." },
  curriculo: { front: "U (matriz/organização)", ready: false, reason: "Sem posições, correspondências ou matrizes homologadas por ato humano." },
  oferta: { front: "V (oferta/grade)", ready: false, reason: "Ledger de oferta 2027 vazio; fechamento de V pendente." },
  docente: { front: "X (necessidade docente)", ready: false, reason: "CONTRACTUAL_BALANCE — BLOCKED_BY_FUNCTIONAL_SOURCE; sem atribuições 2027." },
  diario: { front: "W (Diário)", ready: false, reason: "Sem aulas registradas; ano 2027 não operacional." },
  frequencia: { front: "W (frequência)", ready: false, reason: "Sem chamadas registradas." },
  avaliacao: { front: "AA (avaliação)", ready: false, reason: "RULE CALCULATION — BLOCKED_BY_HOMOLOGATED_RULES; sem resultados." },
  acompanhamento: { front: "AB (acompanhamento)", ready: false, reason: "Sem categorias homologadas; ficha longitudinal não concluída." },
};

const d = (x: Omit<IndicatorDefinition, "version" | "status" | "provenance"> & Partial<IndicatorDefinition>): IndicatorDefinition =>
  ({ version: 1, status: "publicado", provenance: "Frente AD v1 — definição auditada", ...x });

export const NETWORK_INDICATORS: readonly IndicatorDefinition[] = [
  d({ key: "escolas-ativas", name: "Escolas ativas", definition: "Escolas com versão cadastral vigente ativa na data.", evaluator: "contagem-distinta", factTypes: ["versao-cadastral-escola"], unit: "escolas", window: "fotografia", dimensions: ["dependencia", "localizacao"], nature: "observado-importado", dependsOn: ["cadastro"] }),
  d({ key: "infraestrutura-declarada", name: "Itens de infraestrutura declarados", definition: "Fatos de infraestrutura vigentes por escola.", evaluator: "contagem-fatos", factTypes: ["fato-infraestrutura"], unit: "registros", window: "fotografia", dimensions: ["escola"], nature: "observado-importado", dependsOn: ["infraestrutura"] }),
  d({ key: "matriculas-vigentes", name: "Matrículas vigentes", definition: "Matrículas abertas e não encerradas na data.", evaluator: "contagem-fatos", factTypes: ["matricula"], unit: "matriculas", window: "fotografia", dimensions: ["escola", "sexo-administrativo"], nature: "observado-importado", dependsOn: ["matricula"] }),
  d({ key: "saldo-movimentacao", name: "Saldo de movimentação", definition: "Entradas menos saídas por polo institucional no intervalo.", evaluator: "saldo-entre-selecoes", factTypes: ["movimentacao"], unit: "movimentacoes", window: "intervalo", dimensions: ["escola"], nature: "derivado", dependsOn: ["movimentacao"] }),
  d({ key: "mapa-oficial", name: "Mapa Estatístico oficial", definition: "Células da versão oficializada do Mapa.", evaluator: "projecao-oficial", factTypes: ["mapa-oficial"], unit: "matriculas", window: "fotografia", dimensions: ["escola", "competencia"], nature: "oficial", dependsOn: ["mapa"] }),
  d({ key: "posicoes-com-matriz", name: "Posições com matriz única", definition: "Alocações com posição registrada e exatamente uma matriz aplicável.", evaluator: "proporcao-entre-selecoes", factTypes: ["posicao-curricular"], unit: "proporcao", window: "fotografia", dimensions: ["escola", "posicao"], nature: "derivado", dependsOn: ["curriculo"] }),
  d({ key: "blocos-ofertados", name: "Blocos ofertados", definition: "Blocos utilizáveis da grade vigente.", evaluator: "contagem-fatos", factTypes: ["bloco-grade"], unit: "blocos", window: "fotografia", dimensions: ["escola", "elemento"], nature: "operacional", dependsOn: ["oferta"] }),
  d({ key: "cobertura-docente", name: "Cobertura docente", definition: "Blocos com atribuição ou substituição válida sobre blocos ofertados.", evaluator: "proporcao-entre-selecoes", factTypes: ["bloco-grade", "atribuicao"], unit: "proporcao", window: "fotografia", dimensions: ["escola", "elemento"], nature: "derivado", dependsOn: ["oferta", "docente"] }),
  d({ key: "aulas-registradas", name: "Aulas registradas", definition: "Aulas ministradas registradas no Diário.", evaluator: "contagem-fatos", factTypes: ["aula"], unit: "registros", window: "intervalo", dimensions: ["escola", "elemento"], nature: "operacional", dependsOn: ["diario"] }),
  d({ key: "frequencia-registrada", name: "Presença sobre chamadas", definition: "Presenças sobre marcações registradas; sem marcação fora do denominador.", evaluator: "proporcao-entre-selecoes", factTypes: ["marcacao-frequencia"], unit: "proporcao", window: "intervalo", dimensions: ["escola"], nature: "derivado", dependsOn: ["frequencia"] }),
  d({ key: "avaliacoes-aplicadas", name: "Avaliações aplicadas", definition: "Instrumentos com aplicação registrada.", evaluator: "contagem-fatos", factTypes: ["aplicacao-instrumento"], unit: "registros", window: "intervalo", dimensions: ["escola", "elemento"], nature: "operacional", dependsOn: ["avaliacao"] }),
  d({ key: "acompanhamentos-registrados", name: "Acompanhamentos registrados", definition: "Registros humanos de acompanhamento vigentes.", evaluator: "contagem-fatos", factTypes: ["acompanhamento"], unit: "registros", window: "intervalo", dimensions: ["escola"], nature: "operacional", dependsOn: ["acompanhamento"] }),
];

/** Recusa definição sem fonte, com avaliador fora da lista fechada, com fórmula livre ou chave/versão duplicada. */
export function validateCatalog(list: readonly (IndicatorDefinition & { formula?: unknown })[]): string[] {
  const issues: string[] = []; const seen = new Set<string>();
  for (const i of list) {
    const k = `${i.key}@${i.version}`;
    if (seen.has(k)) issues.push(`${k}: duplicado`); seen.add(k);
    if (!(EVALUATORS as readonly string[]).includes(i.evaluator)) issues.push(`${k}: avaliador não registrado`);
    if ("formula" in i && i.formula !== undefined) issues.push(`${k}: fórmula livre não é aceita`);
    if (i.factTypes.length === 0) issues.push(`${k}: sem fonte`);
    if (i.dependsOn.length === 0) issues.push(`${k}: sem dependência declarada`);
  }
  return issues;
}

export type Availability = { key: string; status: "available" | "unavailable"; reasons: string[] };
export function resolveAvailability(ind: IndicatorDefinition, fronts: Readonly<Record<string, DependencyState>>): Availability {
  if (ind.status !== "publicado") return { key: ind.key, status: "unavailable", reasons: ["Definição não publicada."] };
  const reasons = ind.dependsOn.map((f) => fronts[f]).flatMap((s, n) => (!s ? [`Frente ${ind.dependsOn[n]} desconhecida.`] : s.ready ? [] : [`${s.front}: ${s.reason}`]));
  return { key: ind.key, status: reasons.length ? "unavailable" : "available", reasons };
}

/** Valor apresentado: desconhecido nunca vira zero; dinâmico nunca é rotulado oficial; grupo pequeno é suprimido por limiar declarado. */
export type Presented = { kind: "valor"; value: number; label: string } | { kind: "zero"; label: string } | { kind: "desconhecido"; reason: string } | { kind: "suprimido"; reason: string };
export function present(ind: IndicatorDefinition, value: number | null, opts: { groupSize?: number | null; minGroup?: number | null } = {}): Presented {
  if (value == null) return { kind: "desconhecido", reason: "Fonte sem valor para o recorte." };
  if (opts.minGroup != null && opts.groupSize != null && opts.groupSize < opts.minGroup) return { kind: "suprimido", reason: `Grupo abaixo do limiar declarado (${opts.minGroup}).` };
  const label = ind.nature === "oficial" ? "Oficial" : ind.nature === "operacional" ? "Dinâmico (operacional)" : ind.nature === "derivado" ? "Derivado" : "Observado/importado";
  return value === 0 ? { kind: "zero", label } : { kind: "valor", value, label };
}
