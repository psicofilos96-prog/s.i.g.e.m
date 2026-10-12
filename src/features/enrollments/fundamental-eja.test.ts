import { describe, expect, it } from "vitest";
import { nextPosition, periodWindows, vacancyCellKey, validateClassPeriod, withinWindow, type MatrixRef } from "./fundamental-eja";

const eja = { offerId: "eja", regime: "semestral" as const, positionKeys: ["fase-1", "fase-2"] };
const ef = { offerId: "ef", regime: "anual" as const, positionKeys: ["ano-6"] };
const sem = { calendarId: "c-eja", periods: [{ periodId: "S2", from: "2027-07-20", to: "2027-12-15" }, { periodId: "S1", from: "2027-02-01", to: "2027-07-05" }] };
const anual = { calendarId: "c-reg", periods: [{ periodId: "A", from: "2027-02-01", to: "2027-12-15" }] };
const mat: MatrixRef[] = [{ matrixVersionId: "m1", positionKey: "fase-1", homologated: true, validFrom: "2027-01-01", validTo: null }];

describe("Fundamental e EJA L18", () => {
  it("janelas só do calendário aplicável compatível com o regime declarado", () => {
    const w = periodWindows(eja, sem);
    expect(w.ok && w.windows.map((p) => p.periodId)).toEqual(["S1", "S2"]);
    expect(periodWindows(eja, anual).ok).toBe(false);
    expect(periodWindows(ef, anual).ok).toBe(true);
    expect(periodWindows({ ...eja, regime: null }, sem).ok).toBe(false);
    expect(periodWindows(eja, null).ok).toBe(false);
  });
  it("turma no semestre exige posição da oferta, turno e matriz homologada cobrindo a janela", () => {
    const w = periodWindows(eja, sem);
    expect(validateClassPeriod({ classId: "t", offerId: "eja", periodId: "S1", positionKeys: ["fase-1"], shift: "noite" }, eja, w, mat).ok).toBe(true);
    expect(validateClassPeriod({ classId: "t", offerId: "eja", periodId: "S1", positionKeys: ["fase-2"], shift: "noite" }, eja, w, mat).ok).toBe(false);
    expect(validateClassPeriod({ classId: "t", offerId: "eja", periodId: "S1", positionKeys: ["fase-1"], shift: null }, eja, w, mat).ok).toBe(false);
    expect(validateClassPeriod({ classId: "t", offerId: "eja", periodId: "S1", positionKeys: ["fase-1"], shift: "noite" }, eja, w, [{ ...mat[0]!, validTo: "2027-03-01" }]).ok).toBe(false);
    expect(validateClassPeriod({ classId: "t", offerId: "eja", periodId: "S1", positionKeys: ["fase-1"], shift: "noite" }, eja, w, [...mat, { ...mat[0]!, matrixVersionId: "m2" }]).ok).toBe(false);
  });
  it("alocação dentro da janela; sem fim declarado é recusada no semestral", () => {
    const s1 = { periodId: "S1", from: "2027-02-01", to: "2027-07-05" };
    expect(withinWindow(s1, "2027-02-01", "2027-07-05")).toBe(true);
    expect(withinWindow(s1, "2027-02-01", "2027-08-01")).toBe(false);
    expect(withinWindow(s1, "2027-02-01", null)).toBe(false);
  });
  it("progressão de fase nunca automática; vagas por semestre não se somam", () => {
    expect(nextPosition(null).ok).toBe(false);
    expect(nextPosition({ recorded: true, outcomePositionKey: null }).ok).toBe(false);
    expect(nextPosition({ recorded: true, outcomePositionKey: "fase-2" })).toEqual({ ok: true, positionKey: "fase-2" });
    expect(vacancyCellKey("E", "eja", "S1", "fase-1", "noite")).not.toBe(vacancyCellKey("E", "eja", "S2", "fase-1", "noite"));
  });
});
