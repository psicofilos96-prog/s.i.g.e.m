// L20 — Integrações canônicas. Cada setor troca com a Permanência só REFERÊNCIAS
// e projeções mínimas pelo reader/writer dono; nenhum setor recebe a ficha do caso
// e a Permanência nunca grava fato de outro setor.

export const SECTORS = ["docente", "secretaria", "direcao", "supervisao", "familia", "transporte", "organizacao-da-rede", "nei"] as const;
export type Sector = (typeof SECTORS)[number];

export interface Integration {
  sector: Sector;
  consumes: string[];  // fonte canônica que a Permanência LÊ do setor
  receives: string[];  // campos que o setor pode receber da Permanência (allowlist)
  writer: string | null; // writer do PRÓPRIO setor quando há ação; nunca da Permanência
}

export const INTEGRATIONS: readonly Integration[] = [
  { sector: "docente", consumes: ["attendance_record_versions"], receives: ["ha-acompanhamento-ativo"], writer: null },
  { sector: "secretaria", consumes: ["cycle_participations", "class_enrollment_episodes"], receives: ["caso-numero", "solicitacao-de-verificacao-cadastral"], writer: "register_protocol" },
  { sector: "direcao", consumes: [], receives: ["contagem-por-situacao", "caso-numero", "prazo-declarado"], writer: null },
  { sector: "supervisao", consumes: [], receives: ["contagem-por-escola-suprimida"], writer: null },
  { sector: "familia", consumes: ["guardian_authorizations"], receives: ["aviso-generico"], writer: "emit_notification_event" },
  { sector: "transporte", consumes: ["school_transport_facts"], receives: ["solicitacao-de-avaliacao-de-transporte"], writer: "register_protocol" },
  { sector: "organizacao-da-rede", consumes: [], receives: ["demanda-agregada-por-escola"], writer: null },
  { sector: "nei", consumes: [], receives: ["solicitacao-de-apoio"], writer: "register_protocol" },
];

const CASE_INTERNAL = ["barreiras", "contatos", "visitas", "plano", "encaminhamentos", "notas", "historico", "sinalizacao"];

/** Projeta para o setor só os campos da allowlist; o resto some (não vira nulo visível). */
export function projectFor(sector: Sector, data: Record<string, unknown>): Record<string, unknown> {
  const i = INTEGRATIONS.find((x) => x.sector === sector);
  if (!i) return {};
  return Object.fromEntries(Object.entries(data).filter(([k]) => i.receives.includes(k)));
}

/** Aviso à família: modelo pré-aprovado, sem termo de busca ativa, sem motivo nem ficha; só com autorização vigente. */
const FAMILY_FORBIDDEN = /(busca ativa|evas|abandon|neglig|conselho tutelar|barreira|visita domiciliar|caso\b|risco)/i;
export function familyNotice(d: { templateApproved: boolean; text: string; authorizationActive: boolean; studentId: string; key: string }) {
  if (!d.authorizationActive) return { error: "family:not-authorized" as const };
  if (!d.templateApproved) return { error: "modelo-nao-aprovado" as const };
  if (FAMILY_FORBIDDEN.test(d.text)) return { error: "conteudo-interno" as const };
  return { rpc: "emit_notification_event" as const, event_kind: "permanencia.aviso-familia", idempotency_key: d.key, payload: { student_id: d.studentId, text: d.text } };
}

export const familyNeverReceives = () => CASE_INTERNAL.filter((k) => INTEGRATIONS.find((i) => i.sector === "familia")!.receives.includes(k));
