import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EMPTY_PROGRESS, STEPS, classChecklist, isReady, loadProgress, pendings, saveProgress, selectSchool, stepStatus, progressKey,
  type ClassFacts, type KV, type SchoolFacts,
} from "./onboarding-model";

const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };
const full: ClassFacts = { classId: "t1", name: "1A", record: true, periodOrganization: true, matrix: "resolvida", journey: true, schedule: true, assignments: 2, allocations: 0, offering: false, shift: false };
const school = (classes: ClassFacts[] | null, calendars: number | null = 1): SchoolFacts => ({ schoolId: "e1", schoolName: "E1", validOn: "2027-03-01", enrollments: 0, calendars, engagements: 1, classes });

describe("prontidão (checklist booleano)", () => {
  it("turma completa sem aluno, oferta e turno é pronta (contrato permite)", () => {
    const c = classChecklist(full, 1); expect(isReady(c)).toBe(true);
    expect(c.find((x) => x.id === "alunos")!.required).toBe(false);
  });
  it("turma sem matriz ou com matriz ambígua é pendência objetiva", () => {
    expect(pendings(classChecklist({ ...full, matrix: "ausente" }, 1)).map((p) => p.id)).toEqual(["matriz"]);
    expect(classChecklist({ ...full, matrix: "ambigua" }, 1).find((x) => x.id === "matriz")!.detail).toMatch(/mais de uma/);
  });
  it("não verificável nunca conta como pronto; dois calendários bloqueiam", () => {
    expect(isReady(classChecklist({ ...full, journey: null }, 1))).toBe(false);
    expect(isReady(classChecklist(full, 2))).toBe(false); expect(isReady(classChecklist(full, null))).toBe(false);
  });
  it("não há índice numérico nem default normativo", () => {
    const src = readFileSync("src/features/onboarding/onboarding-model.ts", "utf8");
    expect(src).not.toMatch(/score|percent|peso|weight/i);
    expect(Object.keys(classChecklist(full, 1)[0]!)).not.toContain("value");
  });
  it("estado das etapas: sem turmas, sem permissão, zero matrículas válido", () => {
    expect(stepStatus("turmas", school([]))).toBe("nao");
    expect(stepStatus("matriz", school(null))).toBe("nao-verificavel");
    expect(stepStatus("alunos-matriculas", school([full]))).toBe("sim");
    expect(stepStatus("prontidao-diario", school([full, { ...full, classId: "t2", schedule: false }]))).toBe("nao");
    expect(stepStatus("prontidao-diario", null)).toBe("nao-verificavel");
  });
  it("cada etapa leva a uma tela oficial existente", () => {
    for (const s of STEPS) { const f = s.fix.replace(/^\//, "").replace(/\//g, "."); expect(() => readFileSync(`src/routes/${f}.tsx`)).not.toThrow(); }
  });
});

describe("progresso retomável", () => {
  it("interrupção e retomada; sem PII armazenada", () => {
    const kv = mem(); const p0 = loadProgress(kv, "u1"); expect(p0).toEqual(EMPTY_PROGRESS);
    const r = saveProgress(kv, "u1", p0, { ...selectSchool(p0, "e1") });
    expect(r.ok).toBe(true);
    const resumed = loadProgress(kv, "u1"); expect(resumed.schoolId).toBe("e1"); expect(resumed.step).toBe("dados-institucionais");
    expect(Object.keys(JSON.parse(kv.m.get(progressKey("u1"))!)).sort()).toEqual(["reviewed", "schoolId", "step", "updatedAt", "v"]);
    expect(loadProgress(kv, "u2")).toEqual(EMPTY_PROGRESS); // outro usuário não herda
  });
  it("voltar não destrói revisões; duplicidade de revisão é idempotente", () => {
    const kv = mem(); let p = saveProgress(kv, "u", EMPTY_PROGRESS, { schoolId: "e1", step: "grade", reviewed: ["unidade", "turmas"] }).progress;
    p = saveProgress(kv, "u", p, { schoolId: "e1", step: "turmas", reviewed: [...p.reviewed, "turmas", "turmas"] }).progress;
    expect(p.reviewed).toEqual(["unidade", "turmas"]); expect(p.step).toBe("turmas");
  });
  it("concorrência entre abas: base antiga é recusada", () => {
    const kv = mem(); const base = loadProgress(kv, "u");
    const a = saveProgress(kv, "u", base, { schoolId: "e1", step: "turmas", reviewed: [] }, new Date(1));
    const b = saveProgress(kv, "u", base, { schoolId: "e2", step: "grade", reviewed: [] }, new Date(2));
    expect(a.ok).toBe(true); expect(b.ok).toBe(false); expect(b.progress.schoolId).toBe("e1");
  });
  it("progresso corrompido ou etapa desconhecida volta ao início sem erro", () => {
    const kv = mem(); kv.setItem(progressKey("u"), "{x"); expect(loadProgress(kv, "u")).toEqual(EMPTY_PROGRESS);
    kv.setItem(progressKey("u"), JSON.stringify({ v: 1, step: "hackear", reviewed: [] })); expect(loadProgress(kv, "u")).toEqual(EMPTY_PROGRESS);
  });
  it("trocar de escola zera revisões, não dados", () => {
    expect(selectSchool({ ...EMPTY_PROGRESS, schoolId: "e1", reviewed: ["grade"] }, "e2").reviewed).toEqual(["unidade"]);
  });
  it("o assistente não grava fatos (sem writer nem DML)", () => {
    for (const f of ["onboarding-source.ts", "onboarding-page.tsx"]) {
      const s = readFileSync(`src/features/onboarding/${f}`, "utf8");
      expect(s).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|rpc\("(register|record|create|apply)_/);
    }
  });
});
