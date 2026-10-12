import { describe, it, expect } from "vitest";
import { validateRecovery, recoverySignals, proposedAction, guardRecoveryText, activityProvenance, centralRecovery, type RecoveryCase, type RecoveryActivity } from "./op-recovery";
import type { ResultFact } from "@/features/teacher-diary/learning-record";

const c: RecoveryCase = { interventionLogicalId: "iv", schoolId: "s1", classId: "c1", periodId: "b3", periodTo: "2026-12-15", audience: { scope: "grupo", studentIds: ["a", "b"] }, skillIds: ["H1"], responsiblePersonIds: ["prof"], startedOn: "2026-10-01", reassessOn: "2026-11-01", activityIds: ["act1"] };
const act = (o: Partial<RecoveryActivity> = {}): RecoveryActivity => ({ activityId: "act1", originalActivityId: "orig", classId: "c1", skillIds: ["H1"], date: "2026-10-05", authorPersonId: "prof", realized: true, ...o });
const res = (studentId: string, date: string, value: number): ResultFact => ({ studentId, instrumentId: "i", date, value, skillIds: ["H1"] });
const ctx = { myStudents: ["a", "b"], hasCapability: true, activities: [act()], objective: "Recompor frações" };

describe("Lote 12 — recuperação da aprendizagem", () => {
  it("valida estudante/grupo, habilidade, atividade vinculada e período", () => {
    expect(validateRecovery(c, ctx)).toEqual([]);
    expect(validateRecovery({ ...c, audience: { scope: "estudante", studentIds: ["a", "b"] } }, ctx).length).toBeGreaterThan(0);
    expect(validateRecovery(c, { ...ctx, activities: [act({ classId: "c9" })] }).join()).toMatch(/outra turma/);
    expect(validateRecovery(c, { ...ctx, activities: [act({ skillIds: ["H9"] })] }).join()).toMatch(/habilidade/);
    expect(validateRecovery(c, { ...ctx, activities: [] }).join()).toMatch(/não encontrada/);
    expect(validateRecovery(c, { ...ctx, hasCapability: false }).length).toBeGreaterThan(0);
  });
  it("não automatiza promoção, retenção ou fechamento", () => {
    expect(guardRecoveryText("se não melhorar, fica retido")).toBeTruthy();
    expect(validateRecovery(c, { ...ctx, objective: "garantir aprovação no fechamento" }).join()).toMatch(/Conselho/);
    for (const s of recoverySignals(c, [res("a", "2026-09-01", 4), res("a", "2026-10-20", 7)], [act()], "2026-10-25")) expect(proposedAction(s).automatic).toBe(false);
  });
  it("sinais exigem evidência", () => {
    const sig = recoverySignals(c, [res("a", "2026-09-01", 4), res("a", "2026-10-20", 7), res("b", "2026-09-01", 5), res("b", "2026-10-20", 5)], [act()], "2026-10-25");
    expect(sig.find((s) => s.studentId === "a")!.signal).toBe("concluir-ciclo");
    expect(sig.find((s) => s.studentId === "b")!.signal).toBe("revisar-estrategia");
    expect(recoverySignals(c, [], [act({ realized: false })], "2026-10-25").every((s) => s.signal === "sem-evidencia")).toBe(true);
    expect(recoverySignals(c, [], [act()], "2026-10-25")[0]!.signal).toBe("continuar");
    expect(recoverySignals(c, [], [act()], "2026-11-05")[0]!.signal).toBe("sem-evidencia");
  });
  it("proveniência da atividade: autor responsável e dentro do período", () => {
    expect(activityProvenance(act(), c)).toEqual([]);
    expect(activityProvenance(act({ authorPersonId: "x", date: "2027-01-01" }), c)).toHaveLength(2);
  });
  it("central só contagens suprimidas", () => {
    expect(centralRecovery(recoverySignals(c, [], [act()], "2026-10-25"))).toMatchObject({ continuar: "suprimido", "revisar-estrategia": 0 });
  });
});
