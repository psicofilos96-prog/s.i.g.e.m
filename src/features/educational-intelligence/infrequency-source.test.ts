import { describe, expect, it } from "vitest";
import { canOpenCase, infrequencyAlerts, type InfrequencyRow } from "./infrequency-source";

const r = (o: Partial<InfrequencyRow>): InfrequencyRow => ({ school_id: "e1", class_id: "t1", student_id: "s1", enrollment_id: "m1", period_id: "p1", period_start: "2026-02-01", present: 0, absent: 0, unmarked: 0, ...o });

describe("infrequência a partir do Diário", () => {
  it("exatamente 75% não alerta; 74% alerta", () => {
    const a = infrequencyAlerts([r({ present: 75, absent: 25 }), r({ student_id: "s2", enrollment_id: "m2", present: 74, absent: 26 })], 1);
    expect(a.periodo.find((x) => x.studentId === "s1")?.status).toBe("sem-alerta");
    expect(a.periodo.find((x) => x.studentId === "s2")?.status).toBe("alerta");
  });
  it("período e acumulado separados", () => {
    const a = infrequencyAlerts([r({ present: 10, absent: 0 }), r({ period_id: "p2", period_start: "2026-05-01", present: 5, absent: 10 })], 2);
    expect(a.periodo[0]?.status).toBe("alerta");
    expect(a.acumulado[0]?.presencePct).toBe(60);
  });
  it("aula sem marcação fica fora e é contada à parte", () => {
    const a = infrequencyAlerts([r({ present: 8, absent: 2, unmarked: 5 })], 1);
    expect(a.periodo[0]?.planned).toBe(10);
    expect(a.unmarked.get("m1|t1")).toBe(5);
  });
  it("sem aula marcada é não apurado, nunca zero", () => {
    expect(infrequencyAlerts([r({ unmarked: 3 })], 1).periodo[0]?.status).toBe("nao-apurado");
  });
  it("transferência gera linhas separadas por turma, sem somar", () => {
    const a = infrequencyAlerts([r({ present: 5, absent: 5 }), r({ class_id: "t2", enrollment_id: "m1b", present: 10, absent: 0 })], 1);
    expect(a.periodo).toHaveLength(2);
    expect(a.transferred).toEqual(["s1"]);
  });
  it("caso de busca ativa só com alerta", () => {
    const a = infrequencyAlerts([r({ present: 75, absent: 25 })], 1);
    expect(canOpenCase(a.periodo[0]!)).toBe(false);
  });
});
