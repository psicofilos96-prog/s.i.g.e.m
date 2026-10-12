/**
 * SIGEM Desenvolvimento L21 — trilhas por função (projeção pura; banco = 0452).
 * Alvo = tipo de atuação canônica (engagement_kind_id), nunca cargo textual; indicação só por atuação
 * vigente na data; indicação não é obrigatoriedade (mandato L06); conteúdo clínico é recusado.
 */
export const AUDIENCE_GROUPS = ["docentes", "gestores", "mediadores", "apoio", "secretaria", "alimentacao", "transporte", "outros"] as const;
export type AudienceGroup = (typeof AUDIENCE_GROUPS)[number];

export type RoleTarget = Readonly<{ id: string; trackVersionId: string; engagementKindId: string; audienceGroup: AudienceGroup; withdrawn: boolean }>;
export type Engagement = Readonly<{ id: string; engagementKindId: string; validFrom: string; validUntil: string | null; endedOn: string | null; positionLabelSnapshot?: string | null }>;

const CLINICAL = /(diagn[oó]stic|cl[ií]nic|terap|laudo|\bcid\b|patolog|transtorno|prescri|medica[cç]|psicoterap)/i;
/** Espelha `dev_clinical_text`: trilha por função não atribui competência clínica. */
export const isClinicalText = (t: string | null | undefined) => CLINICAL.test(t ?? "");

export function targetProblems(i: { trackApproved: boolean; engagementKindKnown: boolean; group: string; rationale: string; title: string; objectives: string }): string[] {
  const p: string[] = [];
  if (!i.trackApproved) p.push("A versão da trilha precisa estar aprovada.");
  if (!i.engagementKindKnown) p.push("Tipo de atuação inexistente nas atuações canônicas.");
  if (!(AUDIENCE_GROUPS as readonly string[]).includes(i.group)) p.push("Grupo de público inválido.");
  if (i.rationale.trim().length < 20) p.push("Justificativa com ao menos 20 caracteres.");
  if ([i.title, i.objectives, i.rationale].some(isClinicalText)) p.push("Conteúdo clínico não pode compor trilha por função.");
  return p;
}

const activeOn = (e: Engagement, on: string) => e.validFrom <= on && (e.validUntil == null || on <= e.validUntil) && (e.endedOn == null || on < e.endedOn);

/** Trilhas indicadas pela atuação vigente; cargo textual nunca é critério. */
export function tracksForPerson(targets: readonly RoleTarget[], engagements: readonly Engagement[], on: string) {
  const kinds = new Map<string, string[]>();
  for (const e of engagements) if (activeOn(e, on)) kinds.set(e.engagementKindId, [...(kinds.get(e.engagementKindId) ?? []), e.id]);
  return targets.filter((t) => !t.withdrawn && kinds.has(t.engagementKindId))
    .map((t) => ({ ...t, viaEngagements: kinds.get(t.engagementKindId)!, mandatory: false as const }));
}
