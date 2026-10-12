/**
 * Centro de Operações — L15: requisição de materiais, mínimo, alertas e previsão (migration 0422).
 * solicitada → em análise → autorizada (por linha, ≤ solicitado, pessoa ≠ solicitante) → ciclos
 * separação (≤ autorizado acumulado) → expedição (saída real, saldo nunca negativo) → recebimento (≤ expedido,
 * comprovante, pessoa ≠ expedidor; entrada no depósito de destino quando houver) → volta a "autorizada" até o
 * encerramento; encerrar com saldo autorizado não expedido = atendimento parcial com justificativa.
 * Estoque mínimo só versão aprovada por pessoa ≠ autor. Alerta e previsão são projeções: NUNCA geram compra.
 */
export type ReqKind = "analise" | "autorizacao" | "recusa" | "separacao" | "expedicao" | "recebimento" | "encerramento" | "cancelamento";
export type ReqState = "solicitada" | "em-analise" | "autorizada" | "recusada" | "separada" | "expedida" | "encerrada" | "cancelada";
const ST: Record<ReqKind, ReqState> = { analise: "em-analise", autorizacao: "autorizada", recusa: "recusada", separacao: "separada", expedicao: "expedida", recebimento: "autorizada", encerramento: "encerrada", cancelamento: "cancelada" };
const FROM: Record<ReqKind, ReqState[]> = { analise: ["solicitada"], autorizacao: ["solicitada", "em-analise"], recusa: ["solicitada", "em-analise"], separacao: ["autorizada"],
  expedicao: ["separada"], recebimento: ["expedida"], encerramento: ["autorizada"], cancelamento: ["solicitada", "em-analise"] };
export interface ReqEvent { seq: number; kind: ReqKind; actorPerson: string; lines?: Record<string, number> }
export const reqState = (ev: readonly ReqEvent[]): ReqState => { const l = [...ev].sort((a, b) => b.seq - a.seq)[0]; return l ? ST[l.kind] : "solicitada"; };

const sumKind = (ev: readonly ReqEvent[], k: ReqKind, line: string) => ev.filter((e) => e.kind === k).reduce((s, e) => s + (e.lines?.[line] ?? 0), 0);
export function lineStatus(requested: Record<string, number>, ev: readonly ReqEvent[]) {
  return Object.entries(requested).map(([line, req]) => {
    const authorized = sumKind(ev, "autorizacao", line), shipped = sumKind(ev, "expedicao", line), received = sumKind(ev, "recebimento", line);
    return { line, requested: req, authorized, shipped, received, pendingShipment: authorized - shipped, divergence: shipped - received,
      attendance: shipped === 0 ? "nao-atendida" : shipped < authorized ? "parcial" : "integral" };
  });
}

export function canReq(r: { requesterPerson: string; requested: Record<string, number>; events: readonly ReqEvent[] }, kind: ReqKind, actor: string, d: { lines?: Record<string, number>; hasDoc?: boolean; note?: string } = {}) {
  const st = reqState(r.events);
  if (!FROM[kind].includes(st)) return { ok: false as const, reason: `Transição inválida a partir de ${st}.` };
  if (["autorizacao", "recusa", "encerramento"].includes(kind) && actor === r.requesterPerson) return { ok: false as const, reason: "Solicitante não decide a própria requisição." };
  const ls = lineStatus(r.requested, r.events);
  if (kind === "autorizacao" && Object.entries(d.lines ?? {}).some(([l, q]) => q > (r.requested[l] ?? 0))) return { ok: false as const, reason: "Autorizado acima do solicitado." };
  if (kind === "separacao" && Object.entries(d.lines ?? {}).some(([l, q]) => sumKind(r.events, "separacao", l) + q > (ls.find((x) => x.line === l)?.authorized ?? 0))) return { ok: false as const, reason: "Separação acima do autorizado." };
  if (kind === "recebimento") {
    const lastExp = [...r.events].filter((e) => e.kind === "expedicao").sort((a, b) => b.seq - a.seq)[0];
    if (lastExp?.actorPerson === actor) return { ok: false as const, reason: "Quem expediu não confirma o recebimento." };
    if (!d.hasDoc) return { ok: false as const, reason: "Recebimento exige comprovante." };
    if (Object.entries(d.lines ?? {}).some(([l, q]) => q > (lastExp?.lines?.[l] ?? 0))) return { ok: false as const, reason: "Recebido acima do expedido." };
  }
  if (kind === "encerramento" && ls.some((x) => x.pendingShipment > 0) && (d.note ?? "").trim().length < 10) return { ok: false as const, reason: "Atendimento parcial exige justificativa." };
  if ((kind === "recusa" || kind === "cancelamento") && (d.note ?? "").trim().length < 10) return { ok: false as const, reason: "Justificativa obrigatória." };
  return { ok: true as const };
}

export type StockAlert = { kind: "abaixo-do-minimo" | "sem-minimo-aprovado" | "ruptura-prevista"; itemKey: string; detail: string };
/** Previsão: consumo médio só se janela configurada e houver consumo; sem dado ⇒ "não calculável", nunca zero. */
export function forecast(balance: number, outflowsInWindow: number, windowDays: number | null) {
  if (!windowDays || outflowsInWindow <= 0) return { daily: null, coverageDays: null as number | null };
  const daily = outflowsInWindow / windowDays;
  return { daily, coverageDays: Math.floor(balance / daily) };
}
export function stockAlerts(items: readonly { itemKey: string; balance: number; approvedMin: number | null; coverageDays: number | null; leadDays: number | null }[]): StockAlert[] {
  const a: StockAlert[] = [];
  for (const i of items) {
    if (i.approvedMin === null) a.push({ kind: "sem-minimo-aprovado", itemKey: i.itemKey, detail: "mínimo não configurado/aprovado" });
    else if (i.balance < i.approvedMin) a.push({ kind: "abaixo-do-minimo", itemKey: i.itemKey, detail: `saldo ${i.balance} < mínimo ${i.approvedMin}` });
    if (i.coverageDays !== null && i.leadDays !== null && i.coverageDays <= i.leadDays) a.push({ kind: "ruptura-prevista", itemKey: i.itemKey, detail: `cobertura ${i.coverageDays} d ≤ prazo ${i.leadDays} d` });
  }
  return a;
}
/** Alerta e previsão não compram nem requisitam. */
export const FORECAST_WRITES: readonly string[] = [];
