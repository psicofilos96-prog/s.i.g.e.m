/**
 * Rede — L21 SIGEM Família × matrículas e vagas.
 * Família vê só campanhas PUBLICADAS (L06), inscreve via L07 (protocolo idempotente), acompanha apenas
 * protocolos dos quais é titular (HMAC do requerente ou autorização vigente sobre o educando), recebe
 * avisos só dos próprios protocolos e manifesta confirmação só no prazo homologado. Negação é uniforme
 * (`indisponivel`): inexistente, de terceiro e sem autorização respondem igual. Nenhum nome, posição
 * ou dado de outro requerente sai daqui; justificativas internas nunca são projetadas.
 */
export interface PublishedCampaign { campaignId: string; title: string; kind: string; period: { from: string; to: string }; schools: readonly string[]; status: string }
export interface ProtocolRecord {
  protocol: string; campaignId: string; requesterHmac: string; studentRef: string | null;
  stage: string; publicTrail: readonly { at: string; stage: string }[]; internalNotes?: unknown;
  waiting: { position: number; total: number; updatedAt: string } | null;
  confirmation: { deadline: string | null; manifested: boolean } | null;
  notices: readonly { id: string; at: string; text: string }[];
}
export interface FamilyCaller { accountId: string | null; requesterHmac: string | null; authorizedStudentRefs: readonly string[] }

export const UNAVAILABLE = { status: "indisponivel" as const };

export const listOpenCampaigns = (all: readonly PublishedCampaign[], today: string) =>
  all.filter((c) => c.status === "publicada" && c.period.from <= today && today <= c.period.to)
    .map(({ campaignId, title, kind, period, schools }) => ({ campaignId, title, kind, period, schools }));

function owns(p: ProtocolRecord, c: FamilyCaller) {
  if (!c.accountId) return false;
  if (c.requesterHmac && c.requesterHmac === p.requesterHmac) return true;
  return p.studentRef !== null && c.authorizedStudentRefs.includes(p.studentRef);
}

/** Acompanhamento individual: só titular; sem notas internas, sem dados de terceiros. */
export function trackProtocol(store: readonly ProtocolRecord[], protocol: string, caller: FamilyCaller) {
  const p = store.find((x) => x.protocol === protocol);
  if (!p || !owns(p, caller)) return UNAVAILABLE;
  return { status: "ok" as const, protocol: p.protocol, campaignId: p.campaignId, stage: p.stage,
    trail: p.publicTrail.map((t) => ({ at: t.at, stage: t.stage })),
    waiting: p.waiting ? { position: p.waiting.position, total: p.waiting.total, updatedAt: p.waiting.updatedAt } : null,
    confirmation: p.confirmation ? { deadline: p.confirmation.deadline, manifested: p.confirmation.manifested } : null };
}

export const myProtocols = (store: readonly ProtocolRecord[], caller: FamilyCaller) =>
  store.filter((p) => owns(p, caller)).map((p) => p.protocol).sort();

export function myNotices(store: readonly ProtocolRecord[], caller: FamilyCaller) {
  return store.filter((p) => owns(p, caller)).flatMap((p) => p.notices.map((n) => ({ protocol: p.protocol, ...n }))).sort((a, b) => b.at.localeCompare(a.at));
}

/** Manifestação de confirmação (L08/L12): titular, prazo homologado declarado, uma vez (idempotente). */
export function manifestConfirmation(store: readonly ProtocolRecord[], protocol: string, caller: FamilyCaller, nowDate: string) {
  const p = store.find((x) => x.protocol === protocol);
  if (!p || !owns(p, caller)) return UNAVAILABLE;
  if (!p.confirmation) return { status: "recusado" as const, reason: "Não há vaga aguardando confirmação." };
  if (p.confirmation.manifested) return { status: "ok" as const, replay: true };
  if (!p.confirmation.deadline) return { status: "recusado" as const, reason: "Prazo de confirmação não homologado; procure a escola." };
  if (nowDate > p.confirmation.deadline) return { status: "recusado" as const, reason: "Prazo de confirmação encerrado." };
  return { status: "ok" as const, replay: false, event: { protocol, kind: "manifestacao-responsavel", byAccount: caller.accountId!, on: nowDate } };
}

/** Inscrição: só em campanha publicada aberta; delega a L07 (que gera protocolo e nunca cria matrícula). */
export function canSubmit(all: readonly PublishedCampaign[], campaignId: string, schoolId: string, today: string, caller: FamilyCaller) {
  if (!caller.accountId) return { ok: false as const, reason: "Entre com sua conta para se inscrever." };
  const c = listOpenCampaigns(all, today).find((x) => x.campaignId === campaignId);
  if (!c) return { ok: false as const, reason: "Campanha não está aberta." };
  if (!c.schools.includes(schoolId)) return { ok: false as const, reason: "Escola não participa desta campanha." };
  return { ok: true as const, next: "pre-registration (L07)" };
}
