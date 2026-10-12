import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { close, reserve, type SeatPool } from "./seat-concurrency";
import { canRelease, currentRule, holdState, occupiedByStates } from "./reservation-states";

const sql = readFileSync("drizzle/migrations/0469_enr16_temporal_reservations.sql", "utf8");
const T = 5_000_000;
const ok = (r: ReturnType<typeof reserve>): SeatPool => { if (!r.ok) throw new Error(r.reason); return r.pool; };

describe("L16 reservas temporais", () => {
  it("prazo só por regra aprovada por pessoa ≠ autor; maior versão aprovada vale", () => {
    expect(currentRule([{ version: 1, holdMinutes: 60, authorPerson: "a", approverPerson: null }])).toBeNull();
    expect(currentRule([{ version: 1, holdMinutes: 60, authorPerson: "a", approverPerson: "a" }])).toBeNull();
    expect(currentRule([
      { version: 1, holdMinutes: 60, authorPerson: "a", approverPerson: "b" },
      { version: 2, holdMinutes: 90, authorPerson: "a", approverPerson: "b" },
      { version: 3, holdMinutes: 5, authorPerson: "a", approverPerson: null },
    ])?.holdMinutes).toBe(90);
  });
  it("quatro estados e só ativa/confirmada ocupam", () => {
    let p: SeatPool = { authorized: 4, events: [] };
    for (const h of ["h1", "h2", "h3", "h4"]) p = ok(reserve(p, { holdId: h, applicationId: h, minutes: h === "h3" ? 1 : 60, personId: "r", key: h }, T));
    p = ok(close(p, { holdId: "h2", kind: "confirmar", personId: "c", key: "c" }, T));
    p = ok(close(p, { holdId: "h4", kind: "liberar", personId: "r", key: "l" }, T));
    const later = T + 120_000;
    expect(["h1", "h2", "h3", "h4"].map((h) => holdState(p, h, later))).toEqual(["ativa", "confirmada", "expirada", "cancelada"]);
    expect(occupiedByStates(p, later)).toBe(2);
  });
  it("liberação controlada: só ativa e com motivo", () => {
    expect(canRelease("confirmada", "motivo suficiente")).toBe("so-reserva-ativa-pode-ser-liberada");
    expect(canRelease("ativa", "curto")).toBe("motivo-obrigatorio");
    expect(canRelease("ativa", "desistência registrada")).toBeNull();
  });
  it("banco: prazo da regra aprovada, origem fechada, writer antigo revogado, estado não gravado", () => {
    expect(sql).toMatch(/JOIN public\.enr_seat_hold_rule_approvals a ON a\.rule_id = r\.id/);
    expect(sql).toMatch(/make_interval\(mins => _rule\.hold_minutes\)/);
    expect(sql).toMatch(/'prazo-sem-regra-aprovada'/);
    expect(sql).toMatch(/_r\.author_person = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.enr_seat_reserve\(uuid,uuid,uuid,int,text\) FROM authenticated/);
    expect(sql).not.toMatch(/ADD COLUMN state/);
    expect(sql).not.toMatch(/TO anon/);
  });
});
