/**
 * Rede/Matrículas/Vagas L10 — Reservas concorrentes.
 * Reserva temporária = eventos append-only (criar → confirmar | cancelar | vencer). Vencimento é derivado
 * da data (`expiresOn`), nunca de job silencioso. Toda escrita passa por `ReservationStore.commit`, que é
 * compare-and-set por linha do quadro (versão esperada) — o mesmo contrato que o writer do banco terá
 * (lock por linha + versão). Chave idempotente: repetir a mesma operação devolve o mesmo resultado.
 * Teto = vagas autorizadas − ocupação (L05) relidas no ato; reserva nunca passa do teto.
 */
export interface ReservationEvent { reservationId: string; cellKey: string; kind: "criar" | "confirmar" | "cancelar"; studentRef: string; personId: string; at: string; expiresOn: string; idempotencyKey: string; reason: string }
export interface CellSnapshot { cellKey: string; version: number; events: readonly ReservationEvent[] }
export interface ReservationStore {
  read(cellKey: string): Promise<CellSnapshot>;
  /** Grava se a versão ainda for `expectedVersion`; senão devolve conflito. Deve ser atômico. */
  commit(cellKey: string, expectedVersion: number, event: ReservationEvent): Promise<{ ok: true; version: number } | { ok: false; conflict: true }>;
}

export type ResStatus = "ativa" | "confirmada" | "cancelada" | "vencida";
export function statusOf(events: readonly ReservationEvent[], reservationId: string, on: string): ResStatus | null {
  const mine = events.filter((e) => e.reservationId === reservationId); if (!mine.length) return null;
  const last = mine.at(-1)!;
  if (last.kind === "confirmar") return "confirmada";
  if (last.kind === "cancelar") return "cancelada";
  return on > last.expiresOn ? "vencida" : "ativa";
}
export function activeHolds(events: readonly ReservationEvent[], on: string) {
  const ids = [...new Set(events.map((e) => e.reservationId))];
  return ids.filter((id) => { const s = statusOf(events, id, on); return s === "ativa" || s === "confirmada"; });
}

export interface ResActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[] }
export interface ResPolicy { requiredCapability: string | null; holdDays: number | null }
export type ResOutcome = { ok: true; event: ReservationEvent; replay: boolean } | { ok: false; reason: string };

const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Executa com repetição limitada em conflito de versão; nunca sobreocupa. */
export async function reservationOp(store: ReservationStore, op: {
  kind: ReservationEvent["kind"]; cellKey: string; reservationId: string; studentRef: string; idempotencyKey: string; reason: string; on: string; at: string;
  /** vagas autorizadas − ocupação, relidas no ato (null = não lidas) */ readCeiling: () => Promise<number | null>;
}, actor: ResActor, pol: ResPolicy, maxRetries = 5): Promise<ResOutcome> {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não reserva." };
  if (!pol.requiredCapability || !actor.capabilities.includes(pol.requiredCapability)) return { ok: false, reason: "Competência não configurada ou ausente." };
  if (!op.reason.trim() || !op.idempotencyKey.trim()) return { ok: false, reason: "Motivo e chave idempotente obrigatórios." };
  if (op.kind === "criar" && pol.holdDays === null) return { ok: false, reason: "Prazo de reserva não homologado." };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const snap = await store.read(op.cellKey);
    const prior = snap.events.find((e) => e.idempotencyKey === op.idempotencyKey);
    if (prior) return prior.kind === op.kind && prior.reservationId === op.reservationId ? { ok: true, event: prior, replay: true } : { ok: false, reason: "Chave idempotente já usada em outra operação." };
    const st = statusOf(snap.events, op.reservationId, op.on);
    let event: ReservationEvent;
    if (op.kind === "criar") {
      if (st !== null) return { ok: false, reason: "Reserva já existe." };
      const holds = activeHolds(snap.events, op.on);
      if (holds.some((id) => snap.events.find((e) => e.reservationId === id)!.studentRef === op.studentRef)) return { ok: false, reason: "Estudante já tem reserva ativa nesta linha." };
      const ceiling = await op.readCeiling();
      if (ceiling === null) return { ok: false, reason: "Vagas disponíveis não lidas." };
      if (holds.length >= ceiling) return { ok: false, reason: "Sem vaga: reserva recusada para não sobreocupar." };
      event = { reservationId: op.reservationId, cellKey: op.cellKey, kind: "criar", studentRef: op.studentRef, personId: actor.personId, at: op.at, expiresOn: addDays(op.on, pol.holdDays!), idempotencyKey: op.idempotencyKey, reason: op.reason.trim() };
    } else {
      if (st !== "ativa") return { ok: false, reason: `Reserva ${st ?? "inexistente"}: não pode ${op.kind}.` };
      const created = snap.events.find((e) => e.reservationId === op.reservationId)!;
      event = { ...created, kind: op.kind, personId: actor.personId, at: op.at, idempotencyKey: op.idempotencyKey, reason: op.reason.trim() };
    }
    const c = await store.commit(op.cellKey, snap.version, event);
    if (c.ok) return { ok: true, event, replay: false };
  }
  return { ok: false, reason: "Concorrência persistente: tente novamente." };
}

/** Store de referência em memória com CAS — usado por testes de corrida e pelo laboratório. */
export function memoryStore(): ReservationStore & { all(k: string): ReservationEvent[] } {
  const cells = new Map<string, { version: number; events: ReservationEvent[] }>();
  const get = (k: string) => { if (!cells.has(k)) cells.set(k, { version: 0, events: [] }); return cells.get(k)!; };
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  return {
    async read(k) { await tick(); const c = get(k); return { cellKey: k, version: c.version, events: [...c.events] }; },
    async commit(k, v, e) { await tick(); const c = get(k); if (c.version !== v) return { ok: false, conflict: true }; c.events.push(e); c.version++; return { ok: true, version: c.version }; },
    all: (k) => [...get(k).events],
  };
}
