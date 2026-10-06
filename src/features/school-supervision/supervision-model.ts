import type { Block, Pending } from "@/features/school-management/management-panel";

/** As cinco naturezas de pendência da Supervisão. Nunca viram nota, ranking ou score. */
export type PendingNature = "ausencia-de-dado" | "dado-desconhecido" | "regra-nao-homologada" | "aguardando-conferencia" | "divergencia";
export const NATURE_LABEL: Record<PendingNature, string> = {
  "ausencia-de-dado": "Ausência de dado",
  "dado-desconhecido": "Dado desconhecido",
  "regra-nao-homologada": "Regra não homologada",
  "aguardando-conferencia": "Aguardando conferência",
  divergencia: "Divergência",
};
export const NATURE_ORDER: readonly PendingNature[] = ["ausencia-de-dado", "dado-desconhecido", "regra-nao-homologada", "aguardando-conferencia", "divergencia"];

const BY_KIND: Record<Pending["kind"], PendingNature> = {
  "fato-ausente": "ausencia-de-dado",
  "fonte-indisponivel": "dado-desconhecido",
  "bloqueio-normativo": "regra-nao-homologada",
  conferencia: "aguardando-conferencia",
  ambiguidade: "divergencia",
};

export type SupervisionPending = Readonly<{ id: string; nature: PendingNature; text: string; link: string; source: string }>;

/** Reclassifica pendências e blocos da projeção da escola (AK); bloco recusado não é pendência da escola. */
export function classifyPending(blocks: readonly Block[], pending: readonly Pending[]): Record<PendingNature, SupervisionPending[]> {
  const out = Object.fromEntries(NATURE_ORDER.map((n) => [n, [] as SupervisionPending[]])) as Record<PendingNature, SupervisionPending[]>;
  const seen = new Set<string>();
  for (const p of pending) { seen.add(p.id); out[BY_KIND[p.kind]].push({ id: p.id, nature: BY_KIND[p.kind], text: p.text, link: p.link, source: p.source }); }
  for (const b of blocks) {
    if (b.state === "UNKNOWN" && !seen.has(`falha-${b.id}`)) out["dado-desconhecido"].push({ id: `bloco-${b.id}`, nature: "dado-desconhecido", text: `${b.title}: ${b.reason ?? "informação não disponível"}`, link: b.link, source: b.source });
    if (b.state === "BLOCKED") out["regra-nao-homologada"].push({ id: `bloco-${b.id}`, nature: "regra-nao-homologada", text: `${b.title}: ${b.reason ?? "bloqueado"}`, link: b.link, source: b.source });
  }
  return out;
}

export type SupervisionRecord = Readonly<{
  id: string; logical_id: string; version: number; event_kind: "registro" | "retificacao" | "anulacao"; school_id: string;
  modality_value_id: string; subject: string; occurred_on: string; referral: string | null; responsible_label: string | null;
  return_on: string | null; status_value_id: string | null; school_visible: boolean; reason: string | null; recorded_at: string; own: boolean;
}>;

/** Situação é só o valor homologado declarado; sem valor, a interface não infere nada. */
export function recordStateLine(r: SupervisionRecord, labels: ReadonlyMap<string, string>): string {
  if (r.event_kind === "anulacao") return `Anulado: ${r.reason ?? "motivo registrado"}`;
  const st = r.status_value_id ? labels.get(r.status_value_id) ?? r.status_value_id : "Situação não declarada";
  return r.event_kind === "retificacao" ? `${st} — versão ${r.version} (corrigida)` : st;
}

export const ACTIONS = (r: SupervisionRecord) => (r.own && r.event_kind !== "anulacao" ? (["retificacao", "anulacao"] as const) : ([] as const));

const ERR: Record<string, string> = {
  "access-denied": "Sua atuação não permite consultar a supervisão desta escola.",
  "capability:registrar-acompanhamento-da-supervisao": "Sua atuação não permite registrar acompanhamento nesta escola.",
  "supervision:modality-not-homologated": "Escolha uma modalidade homologada.",
  "supervision:status-not-homologated": "Escolha uma situação homologada.",
  "supervision:reason-required": "Informe o motivo da correção.",
  "supervision:return-before-occurrence": "O retorno não pode ser anterior à data do acompanhamento.",
  "supervision:occurred-on-future": "A data do acompanhamento não pode estar no futuro.",
  "supervision:only-author-rectifies": "Só quem registrou pode corrigir.",
  "supervision:base-superseded": "Este registro já foi corrigido por outra versão. Recarregue.",
  "supervision:natural-person-required": "Só uma pessoa identificada pode registrar.",
  "supervision:subject-required": "Informe o assunto.",
};
export function supervisionError(msg: string): string {
  const k = Object.keys(ERR).find((key) => msg.includes(key));
  return k ? ERR[k]! : "Não foi possível concluir. Tente novamente.";
}

/** Linhas do relatório: sem nome de pessoa (responsável é rótulo opcional e sensível). */
export function supervisionRows(records: readonly SupervisionRecord[], schoolName: string, labels: ReadonlyMap<string, string>) {
  return records.map((r) => ({
    school: schoolName, occurredOn: r.occurred_on, modality: labels.get(r.modality_value_id) ?? r.modality_value_id, subject: r.subject,
    referral: r.referral, responsible: r.responsible_label, returnOn: r.return_on, state: recordStateLine(r, labels),
    version: r.version, visibleToSchool: r.school_visible ? "sim" : "não", recordedAt: r.recorded_at,
  }));
}
