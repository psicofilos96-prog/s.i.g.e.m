import { describe, it, expect } from "vitest";
import { validateObservation, revise, autonomyTimeline, type Observation } from "./mediator-participation";

const des = { logicalId: "D1", personId: "m1", studentId: "e1", from: "2026-02-01", to: null };
const ctx = { personId: "m1", technical: false, today: "2026-03-10", designation: des };
const obs = (o: Partial<Observation> = {}): Observation => ({ id: "o1", version: 1, supersedes: null, designationId: "D1", studentId: "e1", authorPersonId: "m1",
  date: "2026-03-02", context: "recreio", activity: "Entrar na fila", level: "apoio-pontual", barriers: ["Barulho"], resources: ["Cartão visual"], note: "", reason: null, ...o });

describe("Mediador L10 — participação e autonomia", () => {
  it("observação válida por contexto e atividade; cinco níveis", () => {
    const { id, version, supersedes, ...base } = obs();
    expect(validateObservation(base, ctx)).toEqual([]);
    expect(validateObservation({ ...base, level: "nao-observado" }, ctx)).toEqual([]);
  });
  it("sem contexto/atividade, sem designação, executor técnico e futuro recusados", () => {
    const { id, version, supersedes, ...base } = obs();
    expect(validateObservation({ ...base, context: "", activity: "" }, ctx)).toHaveLength(2);
    expect(validateObservation(base, { ...ctx, designation: null })).toHaveLength(1);
    expect(validateObservation(base, { ...ctx, technical: true, personId: null })).toHaveLength(1);
    expect(validateObservation({ ...base, date: "2026-03-11" }, ctx)).toHaveLength(1);
  });
  it("proíbe escore, classificação permanente e juízo de evolução", () => {
    const { id, version, supersedes, ...base } = obs();
    for (const note of ["escore 3", "nunca consegue", "evoluiu muito", "nível de suporte 2"]) expect(validateObservation({ ...base, note }, ctx).length).toBe(1);
  });
  it("revisão versionada, só autor, com motivo e base", () => {
    const r = revise([obs()], "o1", 1, { level: "sem-apoio" }, "m1", "registrado errado");
    expect(r.ok && r.version).toMatchObject({ version: 2, supersedes: 1, level: "sem-apoio" });
    expect(revise([obs()], "o1", 1, { level: "sem-apoio" }, "m2", "outro autor").ok).toBe(false);
    expect(revise([obs()], "o1", 0, { level: "sem-apoio" }, "m1", "base velha").ok).toBe(false);
    expect(revise([obs()], "o1", 1, {}, "m1", "nada mudou").ok).toBe(false);
  });
  it("leitura agrupa por atividade+contexto sem total, média nem tendência", () => {
    const t = autonomyTimeline([obs(), obs({ id: "o2", date: "2026-03-05", level: "sem-apoio" }), obs({ id: "o3", context: "sala" }), obs({ version: 2, level: "apoio-frequente" })], "e1", { from: "2026-02-01", to: "2026-03-31" });
    if (t.state !== "ok") throw new Error();
    expect(t.groups).toHaveLength(2);
    expect(t.groups[0]!.entries.map((e) => e.level)).toEqual(["Realizou com apoio frequente", "Realizou sem apoio"]);
    expect(JSON.stringify(t)).not.toMatch(/media|score|trend|tendencia|total/i);
    expect(autonomyTimeline(null, "e1", { from: "a", to: "z" }).state).toBe("nao-disponivel");
  });
});
