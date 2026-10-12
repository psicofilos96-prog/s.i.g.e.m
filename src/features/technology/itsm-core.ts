// Tecnologia L02 — núcleo ITSM (migration 0477). Chamado = ops_requests('tecnologia'); natureza, problema e mudança
// são entidades distintas com código único (CHM/PRB/MUD-ano-seq) e estado projetado de eventos append-only.
export type Nature = "incidente" | "requisicao";
export interface TicketRecord { seq: number; ticket_code: string; nature: Nature; reason: string | null }
export const currentNature = (rs: readonly TicketRecord[]) => [...rs].sort((a, b) => b.seq - a.seq)[0]?.nature ?? null;

export type ProblemAction = "investigar" | "causa-identificada" | "contorno" | "vincular-chamado" | "resolver" | "encerrar" | "reabrir";
export function problemState(ev: readonly { seq: number; action: ProblemAction }[]) {
  const s = [...ev].sort((a, b) => a.seq - b.seq);
  if (!s.length) return "registrado";
  const last = s.filter((e) => e.action !== "vincular-chamado").at(-1)?.action;
  return ({ investigar: "em-investigacao", "causa-identificada": "causa-conhecida", contorno: "com-contorno", resolver: "resolvido", encerrar: "encerrado", reabrir: "reaberto" } as const)[last as Exclude<ProblemAction, "vincular-chamado">] ?? "registrado";
}
export const linkedTickets = (ev: readonly { action: ProblemAction; request_id?: string | null }[]) =>
  [...new Set(ev.filter((e) => e.action === "vincular-chamado" && e.request_id).map((e) => e.request_id!))];

export type ChangeAction = "avaliar" | "aprovar" | "rejeitar" | "executar" | "reverter" | "revisar" | "encerrar";
const NEXT: Record<string, readonly ChangeAction[]> = {
  "": ["avaliar"], avaliar: ["aprovar", "rejeitar"], aprovar: ["executar"], executar: ["reverter", "revisar"], reverter: ["revisar"], revisar: ["encerrar"], rejeitar: [], encerrar: [],
};
export const changeNextAllowed = (last: ChangeAction | null) => NEXT[last ?? ""] ?? [];

export function checkChangeEvent(i: { last: ChangeAction | null; action: ChangeAction; actor: string; proposer: string; priorActors: readonly string[]; risk: "baixo" | "medio" | "alto"; act: string | null }) {
  if (!changeNextAllowed(i.last).includes(i.action)) return "transicao-invalida";
  if (i.action === "aprovar" || i.action === "rejeitar") {
    if (i.actor === i.proposer || i.priorActors.includes(i.actor)) return "aprovador-igual-autor";
    if (i.action === "aprovar" && i.risk === "alto" && !i.act) return "sem-ato";
  }
  return null;
}
export const CODE_PATTERN = /^(CHM|PRB|MUD)-\d{4}-\d{6}$/;
