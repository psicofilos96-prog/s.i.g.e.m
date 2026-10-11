/**
 * EDUCACENSO.1 — núcleo de controle anual (puro). O banco (`educacenso_*`, migration 0354) é a garantia;
 * aqui só há rótulos, transições espelhadas e resumo. Nada aqui declara homologação do INEP.
 */
export type SchoolState = "em-preparacao" | "pendencias-em-correcao" | "conferida-pela-escola" | "devolvida-pela-rede" | "declarada-enviada-ao-inep" | "em-retificacao";
export type CollectionAct = "configurar" | "abrir" | "encerrar" | "reabrir";
export type DocState = "documentacao-pendente" | "documentacao-inep-registrada";

export const SCHOOL_STATE_LABEL: Record<SchoolState, string> = {
  "em-preparacao": "Em preparação", "pendencias-em-correcao": "Pendências em correção", "conferida-pela-escola": "Conferida pela escola",
  "devolvida-pela-rede": "Devolvida pelo CIECE", "declarada-enviada-ao-inep": "Envio ao INEP declarado", "em-retificacao": "Em retificação",
};
export const ACT_LABEL: Record<CollectionAct, string> = { configurar: "Configurar", abrir: "Abrir coleta", encerrar: "Encerrar coleta", reabrir: "Reabrir" };
export const COLLECTION_STATE_LABEL: Record<CollectionAct, string> = { configurar: "Configurada (não aberta)", abrir: "Aberta", encerrar: "Encerrada", reabrir: "Reaberta" };

/** Sugestões de etapa — opções de interface, não limite do domínio (a chave é livre). */
export const STAGE_SUGGESTIONS = [
  { key: "matricula-inicial", label: "1ª etapa — Matrícula Inicial" },
  { key: "situacao-do-aluno", label: "2ª etapa — Situação do Aluno" },
] as const;

/** Leiaute: o sistema só afirma o que há de documento. Nunca diz "homologado". */
export function layoutStatusText(doc: DocState | null | undefined): string {
  if (doc === "documentacao-inep-registrada") return "Documento INEP registrado (hash conferível) — sem homologação declarada pelo SIGEM";
  if (doc === "documentacao-pendente") return "Documentação INEP pendente — leiaute só como referência";
  return "Nenhum leiaute registrado para o ano";
}

/** Espelho das transições do banco (`educacenso_school_act`). */
export function schoolNext(current: SchoolState | null, network: boolean): SchoolState[] {
  const out: SchoolState[] = [];
  if (current === null || current === "em-preparacao" || current === "pendencias-em-correcao" || current === "devolvida-pela-rede" || current === "em-retificacao")
    out.push("em-preparacao", "pendencias-em-correcao", "conferida-pela-escola");
  if (current === "conferida-pela-escola") { out.push("pendencias-em-correcao", "declarada-enviada-ao-inep"); if (network) out.push("devolvida-pela-rede"); }
  if (current === "declarada-enviada-ao-inep") out.push("em-retificacao");
  return [...new Set(out)].filter((s) => s !== current || s === "pendencias-em-correcao");
}
export function collectionNext(last: CollectionAct | null): CollectionAct[] {
  if (last === null) return ["configurar"];
  if (last === "configurar") return ["configurar", "abrir"];
  if (last === "abrir" || last === "reabrir") return ["encerrar"];
  return ["reabrir"];
}

export type SchoolRow = {
  school_id: string; inep: string | null;
  head: { seq: number; state: SchoolState; protocol_ref: string | null; reason: string; actor_scope: string; recorded_at: string } | null;
  receipt: { version: number; issued_at: string; closed_at: string | null } | null;
  enrollments_without_start: number | null;
};
/** Resumo: escola sem evento é "não iniciada", nunca contada como pronta; recibo importado é evidência separada. */
export function summarize(rows: readonly SchoolRow[]) {
  const by: Record<string, number> = { "nao-iniciada": 0 };
  for (const r of rows) { const k = r.head?.state ?? "nao-iniciada"; by[k] = (by[k] ?? 0) + 1; }
  return { total: rows.length, byState: by, withReceipt: rows.filter((r) => r.receipt).length, withoutInep: rows.filter((r) => !r.inep).length, withStartGaps: rows.filter((r) => (r.enrollments_without_start ?? 0) > 0).length };
}

const ERR: Record<string, string> = {
  "not-authorized": "Sua conta não tem permissão para esta ação.", "stale-base": "Outra pessoa alterou antes. Recarregue.",
  "invalid-transition": "Essa passagem não é permitida a partir do estado atual.", "reference-date-required": "Informe a data de referência dentro do ano-base.",
  "collection-not-open": "A coleta desta etapa não está aberta.", "network-only": "Só o CIECE/rede pode devolver.",
  "protocol-and-conference-required": "Para declarar o envio, a escola precisa estar conferida e o número do recibo/protocolo do INEP deve ser informado.",
  "layout-year-mismatch": "O leiaute escolhido é de outro ano.", "session-required": "Entre novamente.",
};
export const educacensoMessage = (m: string) => { const k = Object.keys(ERR).find((x) => m.includes(`educacenso:${x}`)); return k ? ERR[k]! : m.replace(/^.*educacenso:/, "Recusado: "); };
