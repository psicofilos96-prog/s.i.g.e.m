// Matrículas L22 — apoio de inclusão/acessibilidade no ingresso (migration 0475).
// Apoio é tipo de catálogo fechado (sem CID, laudo ou texto livre) e nunca critério de classificação, distribuição ou indeferimento.
// Encaminhamento leva só o mínimo ao destino compatível; texto clínico é recusado antes de sair da tela.
export const SUPPORT_KINDS = ["acessibilidade-fisica", "transporte-adaptado", "apoio-pedagogico-especializado", "comunicacao-acessivel", "mobiliario-adaptado"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];
export type Destination = "nei" | "transporte" | "infraestrutura";

const ROUTES: Record<Destination, readonly SupportKind[]> = {
  nei: ["apoio-pedagogico-especializado", "comunicacao-acessivel"],
  transporte: ["transporte-adaptado"],
  infraestrutura: ["acessibilidade-fisica", "mobiliario-adaptado"],
};
export const destinationAllowed = (k: SupportKind, d: Destination) => ROUTES[d].includes(k);
export const destinationsFor = (k: SupportKind) => (Object.keys(ROUTES) as Destination[]).filter((d) => destinationAllowed(k, d));

/** Campos que o destino recebe — allowlist; nada pessoal. */
export const REFERRAL_FIELDS = ["application_code", "school_key", "need_kind", "created_at"] as const;
export function minimalReferral(src: Record<string, unknown>) {
  return Object.fromEntries(REFERRAL_FIELDS.filter((f) => f in src).map((f) => [f, src[f]]));
}

const CLINICAL = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|tea|tdah|defici[eê]nci)/i;
export const looksClinical = (t: string) => CLINICAL.test(t);

/** Fatores que podem pesar numa decisão de vaga; apoio e pendência documental nunca entram. */
export const FORBIDDEN_DECISION_FACTORS = ["need_kind", "support", "deficiencia", "documento-pendente"] as const;
export function decisionFactorsAllowed(factors: readonly string[]) {
  return factors.every((f) => !FORBIDDEN_DECISION_FACTORS.some((x) => f.toLowerCase().includes(x)));
}
