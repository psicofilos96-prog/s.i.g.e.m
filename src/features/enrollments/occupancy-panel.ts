/**
 * Rede/Matrículas/Vagas L15 — Ocupação e alertas.
 * Projeção pura por célula escola×turno×etapa sobre leituras canônicas (L03 capacidade autorizada,
 * B3 enturmação, L10 reservas, L11 fila). Nada é gravado. Parcela não lida ⇒ null (nunca zero);
 * taxa só com denominador conhecido > 0. Alerta de limite só com limiar homologado; demais alertas
 * derivam de fatos lidos, com evidência. Reprodutível: metodologia versionada + impressão digital da entrada.
 */
export const METHODOLOGY = { id: "ocupacao-celula", version: 1, formula: "disponivel = autorizadas − ocupantes distintos − reservas ativas de não ocupantes; taxa = ocupantes / autorizadas" } as const;

export interface CellInput {
  schoolId: string; shiftId: string; stageId: string;
  authorized: number | null;                  // L03 vigente na data
  sumClassCapacities: number | null;          // capacidade das turmas da célula (para divergência)
  occupants: readonly string[] | null;        // participationIds enturmados na data
  activeReservations: readonly { id: string; studentRef: string }[] | null;
  occupantStudentRefs?: readonly string[];    // para não contar reserva de quem já ocupa
  waitingCount: number | null;                // L11 versão vigente
  pendingRequests: number | null;             // L08 sem conclusão
}
export interface Threshold { version: number; ratio: number; homologatedBy: string; actRef: string }

export type Alert = { kind: "limite" | "excesso" | "divergencia" | "demanda-reprimida" | "pendencia" | "fonte-nao-lida"; message: string; evidence: string[] };
export interface CellRow { key: string; authorized: number | null; occupants: number | null; reservations: number | null; available: number | null; rate: number | null; waiting: number | null; alerts: Alert[] }

export function projectCell(c: CellInput, th: Threshold | null): CellRow {
  const key = `${c.schoolId}|${c.shiftId}|${c.stageId}`;
  const occ = c.occupants ? new Set(c.occupants).size : null;
  const occRefs = new Set(c.occupantStudentRefs ?? []);
  const res = c.activeReservations ? c.activeReservations.filter((r) => !occRefs.has(r.studentRef)).length : null;
  const available = c.authorized !== null && occ !== null && res !== null ? c.authorized - occ - res : null;
  const rate = c.authorized !== null && c.authorized > 0 && occ !== null ? occ / c.authorized : null;
  const alerts: Alert[] = [];
  const unread = (["authorized", "occupants", "activeReservations", "waitingCount"] as const).filter((f) => c[f] === null);
  if (unread.length) alerts.push({ kind: "fonte-nao-lida", message: `Não lido: ${unread.join(", ")}.`, evidence: [key] });
  if (available !== null && available < 0) alerts.push({ kind: "excesso", message: `Ocupação+reservas excedem as autorizadas em ${-available}.`, evidence: [key, ...(c.occupants ?? [])] });
  if (rate !== null && th && rate >= th.ratio) alerts.push({ kind: "limite", message: `Taxa ${(rate * 100).toFixed(1)}% ≥ limiar v${th.version}.`, evidence: [key, th.actRef] });
  if (c.authorized !== null && c.sumClassCapacities !== null && c.authorized !== c.sumClassCapacities)
    alerts.push({ kind: "divergencia", message: `Autorizadas (${c.authorized}) ≠ soma das capacidades das turmas (${c.sumClassCapacities}).`, evidence: [key] });
  if (c.waitingCount !== null && c.waitingCount > 0 && available !== null && available <= 0)
    alerts.push({ kind: "demanda-reprimida", message: `${c.waitingCount} em espera sem vaga disponível.`, evidence: [key] });
  if (c.pendingRequests !== null && c.pendingRequests > 0) alerts.push({ kind: "pendencia", message: `${c.pendingRequests} solicitação(ões) sem conclusão.`, evidence: [key] });
  return { key, authorized: c.authorized, occupants: occ, reservations: res, available, rate, waiting: c.waitingCount, alerts };
}

/** Total só quando todas as células têm o dado; senão null com contagem de lacunas. */
function sumOrNull(rows: readonly CellRow[], f: "authorized" | "occupants" | "reservations" | "available" | "waiting") {
  return rows.some((r) => r[f] === null) ? null : rows.reduce((a, r) => a + (r[f] as number), 0);
}

const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const canon = (v: unknown): string => Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);

export function buildPanel(cells: readonly CellInput[], ctx: { asOf: string; knownAt: string; threshold: Threshold | null }) {
  const rows = [...cells].sort((a, b) => `${a.schoolId}|${a.shiftId}|${a.stageId}`.localeCompare(`${b.schoolId}|${b.shiftId}|${b.stageId}`)).map((c) => projectCell(c, ctx.threshold));
  const totals = { authorized: sumOrNull(rows, "authorized"), occupants: sumOrNull(rows, "occupants"), reservations: sumOrNull(rows, "reservations"), available: sumOrNull(rows, "available"), gaps: rows.filter((r) => r.alerts.some((a) => a.kind === "fonte-nao-lida")).length };
  const fingerprint = fnv(canon({ m: METHODOLOGY, asOf: ctx.asOf, knownAt: ctx.knownAt, th: ctx.threshold, cells: [...cells].map((c) => ({ ...c, occupants: c.occupants ? [...c.occupants].sort() : null })).sort((a, b) => canon(a).localeCompare(canon(b))) }));
  return { methodology: METHODOLOGY, asOf: ctx.asOf, knownAt: ctx.knownAt, thresholdVersion: ctx.threshold?.version ?? null, rows, totals, fingerprint, nature: "projecao-operacional" as const };
}
