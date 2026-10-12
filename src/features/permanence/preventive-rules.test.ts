import { describe, expect, it } from "vitest";
import { evaluatePreventive, resolveRules, assertNoLabel, type RuleVersion, type Approval } from "./preventive-rules";
import type { Monitoring } from "./attendance-monitoring";

const m = (p: Partial<Monitoring>): Monitoring => ({ status: "ok", considered: 10, marked: 10, present: 6, absent: 4, unmarked: 0, rate: 0.4,
  consecutiveAbsences: 3, longestConsecutive: 3, streakInterruptedByMissingRecord: false,
  excluded: { "fora-da-vigencia": 0, "dia-nao-letivo": 0, "dia-indeterminado": 0, futura: 0 }, lastMarkedDate: "2026-05-10", ...p });
const rule = (o: Partial<RuleVersion> = {}): RuleVersion => ({ id: "r1", ruleKey: "faltas", version: 1, title: "Faltas seguidas", scope: { etapa: "EF" },
  conditions: [{ primitive: "faltas-consecutivas-min", value: 3 }], combine: "todas", sourceRef: "Res. X", validFrom: "2026-01-01", validTo: null, authorPerson: "a", ...o });
const ok: Approval = { ruleVersionId: "r1", verdict: "aprovada", decisionRef: "Dec 1", approverPerson: "b" };

describe("L03 regras preventivas", () => {
  it("sem aprovação, autoaprovação ou fora da vigência ⇒ bloqueado", () => {
    expect(evaluatePreventive("s", m({}), null, [rule()], [], { etapa: "EF" }, "2026-05-10")[0]!.kind).toBe("bloqueado");
    expect(evaluatePreventive("s", m({}), null, [rule()], [{ ...ok, approverPerson: "a" }], { etapa: "EF" }, "2026-05-10")[0]!.kind).toBe("bloqueado");
    expect(evaluatePreventive("s", m({}), null, [rule({ validTo: "2026-02-01" })], [ok], { etapa: "EF" }, "2026-05-10")[0]!.kind).toBe("bloqueado");
  });
  it("contexto ausente não corresponde ao escopo", () => {
    expect(evaluatePreventive("s", m({}), null, [rule()], [ok], {}, "2026-05-10")[0]!.kind).toBe("bloqueado");
  });
  it("aprovada e atingida gera hipótese com fonte, decisão e chave idempotente", () => {
    const e = evaluatePreventive("s", m({}), null, [rule()], [ok], { etapa: "EF" }, "2026-05-10")[0]!;
    expect(e.kind).toBe("hipotese");
    if (e.kind === "hipotese") { expect(e.hypothesis.decisionRef).toBe("Dec 1"); expect(e.hypothesis.idempotencyKey).toBe("perm-rule|faltas|v1|s|2026-05-10"); }
  });
  it("lacuna de lançamento ⇒ indeterminado, não alerta", () => {
    const e = evaluatePreventive("s", m({ consecutiveAbsences: 1, streakInterruptedByMissingRecord: true }), null, [rule()], [ok], { etapa: "EF" }, "2026-05-10")[0]!;
    expect(e.kind).toBe("indeterminado");
  });
  it("usa a última versão aprovada e detecta regras concorrentes", () => {
    const v2 = rule({ id: "r2", version: 2, conditions: [{ primitive: "faltas-consecutivas-min", value: 5 }] });
    const r = resolveRules([rule(), v2], [ok, { ...ok, ruleVersionId: "r2" }], { etapa: "EF" }, "2026-05-10");
    expect(r[0]!.kind === "aplicavel" && r[0]!.rule.version).toBe(2);
    const other = rule({ id: "r3", ruleKey: "outra" });
    expect(resolveRules([rule(), other], [ok, { ...ok, ruleVersionId: "r3" }], { etapa: "EF" }, "2026-05-10")[0]!.kind).toBe("ambigua");
  });
  it("vocabulário de evasão/diagnóstico é recusado", () => {
    expect(() => assertNoLabel("Estudante evadido")).toThrow();
  });
});
