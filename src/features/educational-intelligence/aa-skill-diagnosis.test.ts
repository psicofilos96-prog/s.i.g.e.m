import { describe, it, expect } from "vitest";
import { diagnose, priorities, drillScope, DISTRACTOR_NOTE, type Answer, type Participation } from "./aa-skill-diagnosis";

const items = [
  { itemId: "i1", skillId: "H1", correctOption: "A", validatedKey: true },
  { itemId: "i2", skillId: "H1", correctOption: "B", validatedKey: true },
  { itemId: "i3", skillId: "H2", correctOption: null, validatedKey: false },
];
const part: Participation[] = ["s1", "s2", "s3", "s4"].map(s => ({ studentId: s, schoolId: "e1", classId: "t1", state: s === "s4" ? "ausente" : "participou" }));
const a = (s: string, i: string, o: string | null, ok: boolean | null, st: Answer["status"] = "respondida"): Answer => ({ studentId: s, schoolId: "e1", classId: "t1", itemId: i, option: o, status: st, correct: ok });
const answers = [a("s1", "i1", "A", true), a("s2", "i1", "C", false), a("s3", "i1", "C", false), a("s1", "i2", "B", true), a("s2", "i2", null, null, "em-branco"), a("s3", "i2", null, null, "nao-lida"), a("s4", "i1", "A", true)];

describe("A&A L09 diagnóstico por habilidade", () => {
  it("denominador, distribuição, erro recorrente e critérios explícitos", () => {
    const [h1, h2] = diagnose({ items, answers, participation: part, bandRule: null, minN: null }) as [ReturnType<typeof diagnose>[number], ReturnType<typeof diagnose>[number]];
    expect(h1).toMatchObject({ nItems: 2, nStudents: 3, nResponses: 5, nCorrect: 2 });
    expect(h1.rate).toBeCloseTo(0.4);
    expect(h1.distribution).toEqual({ A: 1, C: 2, B: 1, "em-branco": 1 });
    expect(h1.recurrentErrors[0]).toMatchObject({ itemId: "i1", option: "C" });
    expect(h1.criteria).toContain(DISTRACTOR_NOTE);
    expect(h1.limitations.join()).toMatch(/não lida/);
    expect(h2.rate).toBeNull(); // sem gabarito validado: não apurado, nunca zero
  });
  it("faixa só com regra homologada e versionada", () => {
    const rule = { ruleRef: "r", version: 2, homologated: true, bands: [{ label: "crítico", min: 0, max: 50 }, { label: "adequado", min: 50.01, max: 100 }] };
    expect(diagnose({ items, answers, participation: part, bandRule: { ...rule, homologated: false }, minN: null })[0]!.band).toBeNull();
    const d = diagnose({ items, answers, participation: part, bandRule: rule, minN: null });
    expect(d[0]!.band).toEqual({ label: "crítico", ruleRef: "r", version: 2 });
    expect(priorities(d, new Set(["crítico"])).rows?.map(r => r.skillId)).toEqual(["H1"]);
    expect(priorities(diagnose({ items, answers, participation: part, bandRule: null, minN: null }), new Set(["crítico"])).state).toBe("sem-regra");
  });
  it("grupo pequeno é retido com política", () => {
    const h1 = diagnose({ items, answers, participation: part, bandRule: null, minN: 5 })[0]!;
    expect(h1.suppressed).toBe(true);
    expect(h1.rate).toBeNull();
    expect(h1.distribution).toEqual({});
  });
  it("drill-down rede→escola→turma e nunca nominal", () => {
    const allowed = { network: false, schools: new Set(["e1"]) };
    expect(drillScope("rede", "e1", {}, allowed)).toEqual({ scope: "escola", filter: { schoolId: "e1" } });
    expect(drillScope("rede", "e9", {}, allowed)).toHaveProperty("refused");
    expect(drillScope("escola", "t1", { schoolId: "e1" }, allowed)).toEqual({ scope: "turma", filter: { schoolId: "e1", classId: "t1" } });
    expect(drillScope("turma", "s1", { schoolId: "e1", classId: "t1" }, allowed)).toHaveProperty("refused");
  });
});
