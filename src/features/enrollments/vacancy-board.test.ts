import { describe, expect, it } from "vitest";
import { authorizedVacancies, boardTotals, cellKey, recordVacancyEvent, vacancyLine,
  type Occupancy, type Reservation, type VActor, type VacancyCell, type VacancyCompetence, type VacancyEvent } from "./vacancy-board";

const cell: VacancyCell = { schoolId: "A", offerId: "of-1", axes: { etapa: "ef", ano: "1", turno: "man" }, periodFrom: "2027-02-01", periodTo: "2027-12-20" };
const K = cellKey(cell);
const comp: VacancyCompetence = { planejar: "planejar-vagas", autorizar: "autorizar-vagas", retificar: "autorizar-vagas", revogar: "autorizar-vagas" };
const esc: VActor = { personId: "p-esc", isHuman: true, capabilities: ["planejar-vagas"], schoolIds: ["A"] };
const rede: VActor = { personId: "p-rede", isHuman: true, capabilities: ["planejar-vagas", "autorizar-vagas"], schoolIds: "rede" };
const inp = (seq: number, q: number | null, x: Record<string, unknown> = {}) => ({ quantity: q, reason: "m", at: "2026-10-12", validFrom: "2027-02-01", validTo: null, expectedSeq: seq, authorizedCapacityCeiling: 30, ...x });
function chain(): VacancyEvent[] {
  const c: VacancyEvent[] = [];
  const p = recordVacancyEvent(cell, c, "planejar", esc, inp(0, 28), comp); if (!p.ok) throw new Error(p.reason); c.push(p.event);
  const a = recordVacancyEvent(cell, c, "autorizar", rede, inp(1, 25, { actRef: "ato-v1" }), comp); if (!a.ok) throw new Error(a.reason); c.push(a.event);
  return c;
}
const occ = (s: string, from = "2027-02-01", to: string | null = null): Occupancy => ({ studentId: s, cellKey: K, allocationId: `al-${s}-${from}`, from, to });
const res = (id: string, s: string, status: Reservation["status"] = "ativa", expiresOn = "2027-03-10"): Reservation => ({ reservationId: id, studentRef: s, cellKey: K, createdAt: "2027-01-20", expiresOn, status });

describe("Quadro de vagas L05", () => {
  it("disponível = autorizadas − ocupação válida − reservas ativas", () => {
    const l = vacancyLine(K, "2027-03-01", "2027-03-01", chain(), [occ("s1"), occ("s2"), occ("s3", "2027-02-01", "2027-02-20")], [res("r1", "s9"), res("r2", "s8", "cancelada"), res("r3", "s7", "ativa", "2027-02-15")]);
    expect(l).toMatchObject({ authorized: 25, occupied: 2, reserved: 1, available: 22 });
  });
  it("sem dupla contagem: estudante duplicado e reserva já convertida", () => {
    const l = vacancyLine(K, "2027-03-01", "2027-03-01", chain(), [occ("s1"), { ...occ("s1"), allocationId: "dup" }], [res("r1", "s1")]);
    expect(l.occupied).toBe(1); expect(l.reserved).toBe(0); expect(l.available).toBe(24);
    expect(l.issues.length).toBe(2);
  });
  it("parcela não lida ⇒ disponível null; total não fecha", () => {
    const l = vacancyLine(K, "2027-03-01", "2027-03-01", chain(), null, []);
    expect(l.available).toBeNull();
    expect(boardTotals([l, vacancyLine(K, "2027-03-01", "2027-03-01", chain(), [], [])]).available).toBeNull();
    expect(vacancyLine(K, "2027-03-01", "2027-03-01", chain().slice(0, 1), [], []).available).toBeNull();
  });
  it("data de referência e conhecimento são respeitadas", () => {
    expect(authorizedVacancies(chain(), K, "2027-01-15", "2027-01-15").value).toBeNull();
    expect(authorizedVacancies(chain(), K, "2027-03-01", "2026-01-01").value).toBeNull();
  });
  it("autorização exige pessoa, competência, ato, teto da capacidade e autorizador ≠ planejador", () => {
    const c = chain().slice(0, 1);
    expect(recordVacancyEvent(cell, c, "autorizar", { ...rede, isTechnicalExecutor: true }, inp(1, 25, { actRef: "a" }), comp).ok).toBe(false);
    expect(recordVacancyEvent(cell, c, "autorizar", rede, inp(1, 25), comp).ok).toBe(false);
    expect(recordVacancyEvent(cell, c, "autorizar", rede, inp(1, 31, { actRef: "a" }), comp).ok).toBe(false);
    expect(recordVacancyEvent(cell, c, "autorizar", rede, inp(1, 25, { actRef: "a", authorizedCapacityCeiling: null }), comp).ok).toBe(false);
    expect(recordVacancyEvent(cell, c, "autorizar", { ...rede, personId: "p-esc" }, inp(1, 25, { actRef: "a" }), comp).ok).toBe(false);
    expect(recordVacancyEvent(cell, c, "autorizar", rede, inp(1, 25, { actRef: "a" }), {}).ok).toBe(false);
    expect(recordVacancyEvent(cell, c, "autorizar", rede, inp(1, 25, { actRef: "a", validTo: "2028-01-01" }), comp).ok).toBe(false);
  });
  it("retificação e revogação preservam histórico; excedente sinalizado", () => {
    const c = chain();
    const r = recordVacancyEvent(cell, c, "retificar", rede, inp(2, 2, { actRef: "ato-v2" }), comp); if (!r.ok) throw 0; c.push(r.event);
    const l = vacancyLine(K, "2027-03-01", "2027-03-01", c, [occ("s1"), occ("s2"), occ("s3")], []);
    expect(l.available).toBe(0); expect(l.issues.join()).toMatch(/Excedente de 1/);
    const v = recordVacancyEvent(cell, c, "revogar", rede, inp(3, null, { actRef: "ato-v3" }), comp); if (!v.ok) throw 0; c.push(v.event);
    expect(authorizedVacancies(c, K, "2027-03-01", "2027-03-01").value).toBeNull();
    expect(c.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
  });
});
