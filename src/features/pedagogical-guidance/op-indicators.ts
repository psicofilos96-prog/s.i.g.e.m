/**
 * OP por escola — LOTE 20 (indicadores e inteligência pedagógica).
 * Catálogo versionado de indicadores OP; a aritmética é SÓ do motor 14.2 (`applyRegisteredEvaluator`),
 * sobre observações por sujeito já projetadas pelos lotes OP (fonte + data de leitura). Nada é persistido.
 * Fonte não lida ⇒ indisponível; denominador zero ⇒ indeterminado; nunca zero presumido.
 * Série só compara mesma chave+versão+recorte. Alerta só com limiar homologado (versão, fonte do limiar);
 * sugestão de prioridade é explicação ordenada por fatos, sempre "decisão: orientador" — nunca ação automática.
 */
import { applyRegisteredEvaluator } from "../ciece/indicator-engine";

export interface OpIndicatorDef {
  key: string; version: number; label: string; evaluator: "percentual" | "contagem";
  numerator: string; denominator: string | null; // descrição por extenso das categorias
  source: string; limitations: string[];
}
const D = (key: string, label: string, evaluator: OpIndicatorDef["evaluator"], numerator: string, denominator: string | null, source: string, limitations: string[]): OpIndicatorDef =>
  ({ key, version: 1, label, evaluator, numerator, denominator, source, limitations });

export const OP_INDICATORS: OpIndicatorDef[] = [
  D("planejamentos-compartilhados", "Planejamentos compartilhados", "percentual", "planos com versão compartilhada", "atribuições docentes vigentes", "op-planning-flow", ["Sem regra de submissão homologada, não compartilhar não é atraso."]),
  D("acompanhamentos-registrados", "Fichas de acompanhamento abertas", "contagem", "fichas abertas no período", null, "op-teacher-followup", ["Contagem não mede qualidade do acompanhamento."]),
  D("devolutivas-respondidas", "Devolutivas respondidas", "percentual", "orientações com devolutiva do destinatário", "orientações enviadas", "op-guidance-notes", ["Ausência de resposta não é descumprimento."]),
  D("aulas-registradas", "Aulas registradas", "percentual", "aulas previstas com registro", "aulas previstas pela grade publicada", "op-lesson-execution", ["Sem registro = conferir, nunca 'não ministrada'.", "Sem grade publicada não há denominador."]),
  D("habilidades-trabalhadas", "Habilidades previstas já trabalhadas", "percentual", "habilidades previstas com registro de trabalho", "habilidades previstas", "op-curriculum-skills", ["Trabalhada ≠ avaliada ≠ demonstrada."]),
  D("intervencoes-executadas", "Intervenções com execução registrada", "percentual", "planos com ação executada", "planos com análise competente", "op-intervention-plan", ["Execução registrada não prova efetividade."]),
  D("reavaliacoes", "Intervenções reavaliadas", "percentual", "planos com reavaliação", "planos com execução", "op-recovery", ["Reavaliação sem resultado comparável não sinaliza continuidade."]),
  D("reunioes-com-ata", "Reuniões com ata encerrada", "percentual", "reuniões com ata encerrada", "reuniões realizadas", "op-meetings", ["Presença não registrada fica fora do denominador de presença."]),
  D("participacao-formacao", "Participação em formações", "percentual", "inscritos com frequência apurada ≥ mínima configurada", "inscritos confirmados", "op-training", ["Sem frequência mínima configurada, não há numerador."]),
  D("participacao-reunioes", "Presença em reuniões", "percentual", "presenças registradas", "presenças registradas ou ausências registradas", "op-meetings", ["Presença não registrada não é ausência."]),
  D("projetos-em-execucao", "Projetos em execução", "contagem", "projetos com situação em execução", null, "op-projects", ["Contagem de projetos não mede resultado."]),
];

/** Observação por sujeito: cada item do denominador com flag do numerador; vem de projeção já autorizada. */
export interface Observation { subjectId: string; inNumerator: boolean }
export interface Reading { status: "lido"; readAt: string; scope: { schoolId: string | "rede"; period: string; filters: Record<string, string> }; observations: Observation[] }
export type ReadingInput = Reading | { status: "nao-lido" | "negado"; reason: string };

export type IndicatorValue = {
  key: string; version: number; label: string; source: string; limitations: string[];
  status: "disponivel" | "indisponivel" | "indeterminado" | "suprimido"; value: number | null; numerator: number | null; denominator: number | null;
  readAt: string | null; reason: string | null; formula: string;
};

const fact = (inNum: boolean) => ({ payload: { kind: "categorico", categoryId: inNum ? "num" : "fora" }, dimensions: {} }) as never;

export function computeOpIndicator(def: OpIndicatorDef, r: ReadingInput, opts: { aggregateForCentral?: boolean } = {}): IndicatorValue {
  const formula = def.denominator ? `${def.evaluator}(${def.numerator} ÷ ${def.denominator})` : `contagem(${def.numerator})`;
  const base = { key: def.key, version: def.version, label: def.label, source: def.source, limitations: def.limitations, formula };
  if (r.status !== "lido") return { ...base, status: "indisponivel", value: null, numerator: null, denominator: null, readAt: null, reason: r.reason };
  const obs = r.observations.map((o) => ({ subjectId: o.subjectId, fact: fact(o.inNumerator) }));
  const sel = { kind: "categoria-em", categoryIds: ["num"] };
  const out = def.evaluator === "contagem"
    ? applyRegisteredEvaluator("contagem", obs, { select: sel })
    : applyRegisteredEvaluator("percentual", obs, { numerator: sel, denominator: "observados" });
  if (!out) return { ...base, status: "indisponivel", value: null, numerator: null, denominator: null, readAt: r.readAt, reason: "Avaliador não registrado no motor." };
  const n = def.evaluator === "contagem" ? out.value : out.numerator;
  if (opts.aggregateForCentral && n !== null && n > 0 && n < 5) return { ...base, status: "suprimido", value: null, numerator: null, denominator: null, readAt: r.readAt, reason: "Supressão 1–4." };
  if (out.value === null) return { ...base, status: "indeterminado", value: null, numerator: out.numerator, denominator: out.denominator, readAt: r.readAt, reason: out.indeterminate ?? "indeterminado" };
  return { ...base, status: "disponivel", value: Math.round(out.value * 10) / 10, numerator: out.numerator, denominator: out.denominator, readAt: r.readAt, reason: null };
}

/** Série: só pontos com mesma chave+versão+escopo+filtros; incompatível sai com motivo. */
export function buildSeries(def: OpIndicatorDef, points: { reading: Reading; defVersion: number }[]) {
  const ref = points[0]?.reading.scope;
  const series: { period: string; value: IndicatorValue }[] = []; const excluded: { period: string; reason: string }[] = [];
  for (const p of points) {
    const same = ref && p.reading.scope.schoolId === ref.schoolId && JSON.stringify(p.reading.scope.filters) === JSON.stringify(ref.filters);
    if (p.defVersion !== def.version) excluded.push({ period: p.reading.scope.period, reason: "Versão de definição diferente." });
    else if (!same) excluded.push({ period: p.reading.scope.period, reason: "Recorte ou filtro diferente." });
    else series.push({ period: p.reading.scope.period, value: computeOpIndicator(def, p.reading) });
  }
  return { series: series.sort((a, b) => a.period.localeCompare(b.period)), excluded };
}

/** Filtros: só os declarados; outros são recusados por extenso. */
export const ALLOWED_FILTERS = ["turma", "componente", "etapa", "professor"] as const;
export function validateFilters(f: Record<string, string>): string[] {
  return Object.keys(f).filter((k) => !(ALLOWED_FILTERS as readonly string[]).includes(k)).map((k) => `Filtro não previsto: ${k}.`);
}

/** Alerta: só com limiar homologado (versão + fonte); sem limiar, nenhum alerta. */
export interface Threshold { indicatorKey: string; version: number; below: number; homologated: boolean; sourceRef: string | null }
export function alertsFor(values: IndicatorValue[], thresholds: Threshold[]) {
  const out: { key: string; message: string; thresholdVersion: number; sourceRef: string }[] = []; const blocked: string[] = [];
  for (const v of values) {
    const t = thresholds.filter((x) => x.indicatorKey === v.key);
    if (t.length === 0) continue;
    const ok = t.filter((x) => x.homologated && x.sourceRef);
    if (ok.length !== 1) { blocked.push(`${v.label}: ${ok.length === 0 ? "limiar sem homologação ou fonte" : "mais de um limiar homologado"}.`); continue; }
    const th = ok[0]!;
    if (v.status === "disponivel" && v.value !== null && v.value < th.below)
      out.push({ key: v.key, message: `${v.label} (${v.value}) abaixo do limiar homologado ${th.below}.`, thresholdVersion: th.version, sourceRef: th.sourceRef! });
  }
  return { alerts: out, blocked };
}

/** Sugestão de prioridade: ordena alertas por fatos explícitos; nunca decide, encaminha nem classifica pessoa. */
export function prioritySuggestions(alerts: ReturnType<typeof alertsFor>["alerts"], values: IndicatorValue[]) {
  return alerts.map((a) => {
    const v = values.find((x) => x.key === a.key)!;
    return { key: a.key, why: `${a.message} Base: ${v.numerator}/${v.denominator}, fonte ${v.source} lida em ${v.readAt}.`, limitations: v.limitations,
      decision: "orientador" as const, automaticAction: null };
  }).sort((x, y) => (values.find((v) => v.key === x.key)!.value ?? 0) - (values.find((v) => v.key === y.key)!.value ?? 0));
}

const PERSON_LABEL = /(professor(a)? (fraco|ruim|problema)|ranking|pior|melhor professor|baixo desempenho docente)/i;
export const guardSuggestionText = (t: string) => (PERSON_LABEL.test(t) ? "Sugestão não rotula nem ranqueia pessoas." : null);
