/**
 * SIGEM Desenvolvimento L22 — integrações (registro declarado; banco = 0453 para parceiros).
 * Toda integração lê a fonte canônica do módulo dono (nunca copia) e nenhuma produz efeito funcional:
 * certificado/conclusão nunca geram progressão, promoção ou remuneração.
 */
export type Integration = Readonly<{
  module: string;
  canonicalSources: readonly string[];
  direction: "leitura" | "referencia-documental";
  feeds: string;
}>;

export const DEV_INTEGRATIONS: readonly Integration[] = [
  { module: "Gestão de Pessoas", canonicalSources: ["institutional_persons", "institutional_engagements"], direction: "leitura", feeds: "pessoa, vínculo de época e atuação vigente (inscrição, trilhas por função)" },
  { module: "Orientação Pedagógica", canonicalSources: ["dev_need_submissions"], direction: "leitura", feeds: "necessidade formativa por origem com evidência (L04)" },
  { module: "Supervisão Escolar", canonicalSources: ["dev_need_submissions"], direction: "leitura", feeds: "necessidade formativa por origem com evidência (L04)" },
  { module: "Acompanhamento e Avaliação", canonicalSources: ["dev_need_submissions", "dev_impact_observations"], direction: "leitura", feeds: "evidência agregada com limiar e indicadores antes/depois (L04/L20)" },
  { module: "SIGEM Documentos", canonicalSources: ["docserv_document_versions"], direction: "referencia-documental", feeds: "PDF de certificado, atos de plano/mandato e convênio de parceiro" },
  { module: "Parceiros", canonicalSources: ["dev_partner_versions", "dev_partner_approvals", "dev_partner_course_links"], direction: "leitura", feeds: "instituição parceira aprovada vinculada a versão de curso" },
];

/** Efeitos funcionais permitidos a partir de certificado/conclusão: nenhum. */
export const FUNCTIONAL_EFFECTS_OF_CERTIFICATE: readonly string[] = [];
export const FORBIDDEN_EFFECT_TERMS = /(progress[aã]o|promo[cç][aã]o|remunera|sal[aá]ri|gratifica|adicional|enquadramento)/i;

export function certificateEffects(_cert: { status: string }) {
  return { functionalEffects: FUNCTIONAL_EFFECTS_OF_CERTIFICATE, note: "Certificado registra formação; reconhecimento funcional depende de ato próprio do DP." } as const;
}

export function partnerProblems(i: { approverPerson: string; authorPerson: string; validFrom: string; validUntil: string | null; reason: string }) {
  const p: string[] = [];
  if (i.approverPerson === i.authorPerson) p.push("Aprovação por pessoa diferente do autor.");
  if (i.validUntil != null && i.validUntil < i.validFrom) p.push("Vigência final antes da inicial.");
  if (i.reason.trim().length < 10) p.push("Motivo da aprovação com ao menos 10 caracteres.");
  return p;
}
