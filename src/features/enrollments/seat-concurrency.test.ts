import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { changeCapacity, close, occupancy, reserve, type SeatPool } from "./seat-concurrency";

const sql = readFileSync("drizzle/migrations/0468_enr15_seat_concurrency_apply.sql", "utf8");
const T = 1_000_000;
const one: SeatPool = { authorized: 1, events: [] };
const ok = (r: ReturnType<typeof reserve>) => { if (!r.ok) throw new Error(r.reason); return r.pool; };

describe("L15 concorrência das vagas", () => {
  it("duas reservas na última vaga: só a primeira entra", () => {
    const p = ok(reserve(one, { holdId: "h1", applicationId: "a1", minutes: 10, personId: "x", key: "k1" }, T));
    expect(reserve(p, { holdId: "h2", applicationId: "a2", minutes: 10, personId: "x", key: "k2" }, T)).toEqual({ ok: false, reason: "sem-vaga" });
  });
  it("mesma chave repetida é idempotente e não ocupa duas vagas", () => {
    const p = ok(reserve({ authorized: 2, events: [] }, { holdId: "h1", applicationId: "a1", minutes: 10, personId: "x", key: "k" }, T));
    const r = reserve(p, { holdId: "h9", applicationId: "a1", minutes: 10, personId: "x", key: "k" }, T);
    expect(r.ok && r.replay && r.holdId).toBe("h1");
    expect(occupancy(p, T)).toBe(1);
  });
  it("duas confirmações da mesma reserva: a segunda é recusada", () => {
    const p = ok(reserve(one, { holdId: "h", applicationId: "a", minutes: 10, personId: "r", key: "k" }, T));
    const c = ok(close(p, { holdId: "h", kind: "confirmar", personId: "c", key: "c1" }, T));
    expect(close(c, { holdId: "h", kind: "confirmar", personId: "c2", key: "c2" }, T)).toEqual({ ok: false, reason: "reserva-encerrada" });
  });
  it("expiração vence a confirmação tardia e libera a vaga", () => {
    const p = ok(reserve(one, { holdId: "h", applicationId: "a", minutes: 1, personId: "r", key: "k" }, T));
    const later = T + 60_000;
    expect(close(p, { holdId: "h", kind: "confirmar", personId: "c", key: "c" }, later)).toEqual({ ok: false, reason: "reserva-vencida" });
    expect(reserve(p, { holdId: "h2", applicationId: "b", minutes: 5, personId: "r", key: "k2" }, later).ok).toBe(true);
  });
  it("capacidade não cai abaixo da ocupação", () => {
    const p = ok(reserve({ authorized: 2, events: [] }, { holdId: "h", applicationId: "a", minutes: 10, personId: "r", key: "k" }, T));
    expect(changeCapacity(p, 0, T)).toEqual({ ok: false, reason: "capacidade-abaixo-da-ocupacao" });
    expect(changeCapacity(p, 1, T).ok).toBe(true);
  });
  it("reprocessamento não dá segunda vaga ao mesmo pedido", () => {
    const p = ok(reserve({ authorized: 5, events: [] }, { holdId: "h", applicationId: "a", minutes: 10, personId: "r", key: "run1" }, T));
    expect(reserve(p, { holdId: "h2", applicationId: "a", minutes: 10, personId: "r", key: "run2" }, T)).toEqual({ ok: false, reason: "pedido-ja-tem-vaga" });
  });
  it("banco trava quadro e pedido, reconta no ato, é append-only e fecha anon", () => {
    expect(sql.match(/FROM public\.enr_seat_pools WHERE id = _pool FOR UPDATE/)).not.toBeNull();
    expect(sql).toMatch(/FROM public\.enr_applications WHERE id = _application AND campaign_id = _camp FOR UPDATE/);
    expect(sql).toMatch(/FROM public\.enr_seat_pools WHERE id = _r\.pool_id FOR UPDATE/);
    expect(sql).toMatch(/UNIQUE \(pool_id, seq\)/);
    expect(sql).toMatch(/enr_seat_events_one_close ON public\.enr_seat_events\(hold_id\) WHERE kind IN \('confirmar','liberar'\)/);
    expect(sql).toMatch(/_expected_version THEN RAISE EXCEPTION 'versao-desatualizada'/);
    expect(sql).toMatch(/expires_at <= now\(\) THEN RAISE EXCEPTION 'reserva-vencida'/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_seat_pools, public\.enr_seat_pool_versions, public\.enr_seat_events FROM authenticated, anon/);
    expect(sql).not.toMatch(/TO anon/);
  });
});
