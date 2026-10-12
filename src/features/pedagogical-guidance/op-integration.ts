/**
 * OP por escola — LOTE 21 (UX, segurança e integração) — núcleo puro.
 * 1) Contratos de integração: o que a OP LÊ de cada setor e o que NUNCA escreve (dono canônico).
 * 2) Separação OP × fiscalização administrativa (Supervisão): finalidade de inspeção é recusada na OP.
 * 3) Isolamento entre escolas: toda leitura/ato exige escola contida no alcance lido do servidor.
 * 4) Auditoria de leitura/exportação: evento por allowlist, sem nome nem texto livre (LGPD de menores).
 * 5) Filtros da UI: só chaves declaradas; estado de tela derivado (carregando/erro/negado/vazio/disponível).
 */
export const SECTORS = ["docente", "direcao", "aa", "nei", "mediador", "secretaria", "ciece", "supervisao"] as const;
export type Sector = (typeof SECTORS)[number];

export const INTEGRATION_CONTRACTS: Record<Sector, { reads: string[]; opWrites: string[]; neverWrites: string[]; note: string }> = {
  docente: { reads: ["teaching_plans_overview_at", "lessonSituation", "skill-links"], opWrites: ["devolutiva de planejamento (ledger próprio)"], neverWrites: ["plano", "aula", "nota", "frequência"], note: "Autoria docente preservada." },
  direcao: { reads: ["school_pedagogical_records_at (visibilidade compartilhada)"], opWrites: ["encaminhamento pelo procedimento existente"], neverWrites: ["decisão institucional", "ato da Direção"], note: "Direção decide; OP subsidia." },
  aa: { reads: ["aa_intervention_versions", "resultados oficiais", "aa_infrequency_at"], opWrites: ["análise competente da versão (aa_record_intervention_event)"], neverWrites: ["resultado de avaliação", "regra de cálculo"], note: "Mesmo plano de intervenção." },
  nei: { reads: ["itens marcados para partilha (allowlist)"], opWrites: ["solicitação via protocolo-nei"], neverWrites: ["PEI", "PAEE", "AEE", "laudo", "diagnóstico"], note: "Clínico fica no NEI." },
  mediador: { reads: ["estratégias confirmadas para partilha"], opWrites: ["pauta de reunião"], neverWrites: ["registro diário do mediador"], note: "Mediador mantém autoria." },
  secretaria: { reads: ["enturmação (rosterStudents)", "calendário oficial"], opWrites: [], neverWrites: ["matrícula", "movimentação", "documento escolar"], note: "Cadastro é da Secretaria." },
  ciece: { reads: ["motor 14.2 (avaliadores registrados)"], opWrites: [], neverWrites: ["fato canônico", "indicador oficial"], note: "Indicadores OP não são estatística oficial." },
  supervisao: { reads: ["calendário homologado"], opWrites: [], neverWrites: ["inspeção", "auto de fiscalização", "ato administrativo"], note: "Fiscalização administrativa é da Supervisão, não da OP." },
};

export function canOpWrite(sector: Sector, target: string): { ok: boolean; reason: string } {
  const c = INTEGRATION_CONTRACTS[sector];
  if (c.neverWrites.some((n) => target.toLowerCase().includes(n.toLowerCase()))) return { ok: false, reason: `${target}: pertence ao setor ${sector}. ${c.note}` };
  if (!c.opWrites.some((w) => w.toLowerCase().includes(target.toLowerCase()))) return { ok: false, reason: `${target}: sem contrato de escrita da OP com ${sector}.` };
  return { ok: true, reason: "" };
}

const INSPECTION = /(fiscaliza|inspe[çc][ãa]o|auto de infra|vistoria|apura[çc][ãa]o disciplinar|sindic[âa]ncia|ponto do servidor|controle de frequ[êe]ncia do servidor)/i;
/** OP é formativa: finalidade de fiscalização administrativa é recusada e encaminhada à Supervisão. */
export const guardPurpose = (purposeText: string) => (INSPECTION.test(purposeText) ? "Fiscalização administrativa é competência da Supervisão Escolar, não da Orientação Pedagógica." : null);

/** Isolamento: a escola pedida precisa estar no alcance lido do servidor; alcance não lido ⇒ nada. */
export function isolateSchool(requested: string | null, scope: readonly string[] | null): { ok: true; schoolId: string } | { ok: false; reason: string } {
  if (scope === null) return { ok: false, reason: "Alcance não lido: nenhuma escola é consultada." };
  if (!requested) return scope.length === 1 ? { ok: true, schoolId: scope[0]! } : { ok: false, reason: "Escolha a escola." };
  return scope.includes(requested) ? { ok: true, schoolId: requested } : { ok: false, reason: "Escola fora do seu alcance." };
}

/** Auditoria de leitura/exportação: só campos da allowlist; nomes e texto livre nunca entram. */
const AUDIT_FIELDS = ["action", "resource", "schoolId", "granularity", "purpose", "rowCount", "format", "at", "accountId", "correlationId"] as const;
export type AuditEvent = Partial<Record<(typeof AUDIT_FIELDS)[number], string | number>>;
export function auditEvent(raw: Record<string, unknown>): { ok: true; event: AuditEvent } | { ok: false; reason: string } {
  if (raw["action"] !== "leitura" && raw["action"] !== "exportacao") return { ok: false, reason: "Ação de auditoria fora do catálogo." };
  if (!raw["accountId"] || !raw["schoolId"] || !raw["purpose"]) return { ok: false, reason: "Auditoria exige conta, escola e finalidade." };
  if (raw["granularity"] === "individual" && raw["purpose"] === "formacao") return { ok: false, reason: "Formação não justifica dado individual." };
  const event: AuditEvent = {};
  for (const k of AUDIT_FIELDS) { const v = raw[k]; if (typeof v === "string" || typeof v === "number") event[k] = v; }
  return { ok: true, event };
}

/** Filtros da Central na URL: só chaves e formatos declarados; busca livre nunca vai para a URL. */
const FILTERS: Record<string, RegExp> = { escola: /^[\w-]{1,80}$/, data: /^\d{4}-\d{2}-\d{2}$/, aba: /^(central|fichas|planejamentos|intervencoes|integracao)$/, bloco: /^[a-z]{1,30}$/ };
export function parseCentralSearch(s: Record<string, unknown>) {
  const out: Record<string, string> = {}; const rejected: string[] = [];
  for (const [k, v] of Object.entries(s)) {
    if (!(k in FILTERS)) { rejected.push(k); continue; }
    if (typeof v === "string" && FILTERS[k]!.test(v)) out[k] = v; else rejected.push(k);
  }
  return { filters: out, rejected };
}

/** Estado de tela derivado: nunca spinner infinito; ausência por extenso. */
export type ScreenState = "carregando" | "erro" | "negado" | "vazio" | "disponivel";
export function screenState<T>(r: { loading: boolean; error: string | null; denied: boolean; rows: T[] | null }): ScreenState {
  if (r.error) return "erro";
  if (r.denied) return "negado";
  if (r.loading) return "carregando";
  if (r.rows === null) return "erro"; // terminou sem dados nem erro: falha declarada, nunca loading eterno
  return r.rows.length === 0 ? "vazio" : "disponivel";
}

/** Etapas do acompanhamento visual de intervenção (mesma cadeia do Lote 11). */
export const INTERVENTION_STAGES = ["diagnostico", "proposta", "analise-competente", "execucao", "evidencias", "reavaliacao", "encerramento"] as const;
export function interventionProgress(eventsKinds: string[]) {
  return INTERVENTION_STAGES.map((s) => ({ stage: s, done: eventsKinds.includes(s) }));
}
