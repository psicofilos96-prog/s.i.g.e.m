/**
 * Lote 03 (Expansão) — SIGEM Intelligence: núcleo puro sobre o assistente existente.
 * Pergunta → domínio da camada semântica (lista fechada) → leitura só pelo reader da sessão.
 * Domínio sem reader liberado ⇒ "não disponível", nunca número presumido.
 */

export type Domain = "matriculas" | "frequencia" | "rendimento" | "professores" | "vagas" | "avaliacoes" | "alimentacao" | "relatorios";

const DOMAIN_TERMS: Record<Domain, RegExp> = {
  matriculas: /matr[ií]cul|alunos? matriculad|enturma/i,
  frequencia: /frequ[eê]nc|falta|infrequ|presen[cç]a/i,
  rendimento: /rendimento|aprova[cç]|reprova|situa[cç][aã]o final/i,
  professores: /professor|docente|regente|lota[cç]/i,
  vagas: /\bvagas?\b|capacidade/i,
  avaliacoes: /avalia[cç]|saeb|ideb|simulad|saber ler|profici/i,
  alimentacao: /aliment|merenda|card[aá]pio|refei[cç]/i,
  relatorios: /relat[oó]rio|planilha|exporta/i,
};

export function routeDomains(question: string): Domain[] {
  return (Object.keys(DOMAIN_TERMS) as Domain[]).filter((d) => DOMAIN_TERMS[d].test(question));
}

/** Medida da resposta: sempre com fonte, período, denominador, fórmula e limites. */
export type Measure = Readonly<{
  label: string; value: number | null; denominator: number | null; formula: string;
  source: string; periodFrom: string; periodTo: string; limits: readonly string[];
}>;

export type MeasureCheck = { ok: true } | { ok: false; reason: string };
export function checkMeasure(m: Measure): MeasureCheck {
  if (!m.source.trim()) return { ok: false, reason: "sem-fonte" };
  if (!m.formula.trim()) return { ok: false, reason: "sem-formula" };
  if (!m.periodFrom || !m.periodTo || m.periodTo < m.periodFrom) return { ok: false, reason: "periodo-invalido" };
  if (m.value != null && m.denominator === 0) return { ok: false, reason: "denominador-zero" };
  return { ok: true };
}

/** Texto da medida: ausência é dita por extenso, nunca vira zero. */
export function describeMeasure(m: Measure): string {
  const v = m.value == null ? "não apurado" : String(m.value);
  const d = m.denominator == null ? "denominador não disponível" : `de ${m.denominator}`;
  const lim = m.limits.length ? ` Limites: ${m.limits.join("; ")}.` : "";
  return `${m.label}: ${v} (${d}). Fórmula: ${m.formula}. Fonte: ${m.source}. Período: ${m.periodFrom} a ${m.periodTo}.${lim}`;
}

/** Rate limit por janela deslizante, puro (o chamador guarda os instantes). */
export function rateLimit(history: readonly number[], now: number, max = 20, windowMs = 60_000) {
  const recent = history.filter((t) => now - t < windowMs);
  return recent.length >= max ? { allowed: false as const, recent } : { allowed: true as const, recent: [...recent, now] };
}

/** Registro de uso sem PII: nunca guarda a pergunta, só domínios, contagens e desfecho. */
export function usageLog(question: string, domains: readonly Domain[], outcome: "respondida" | "sem-fonte" | "recusada" | "limitada") {
  return { domains: [...domains].sort(), length: question.length, outcome };
}
