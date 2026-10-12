// LOTE 20 A&A — aceite técnico integrado com fixtures sintéticas (escolas A/B, transferência temporal,
// perfis coordenador/aplicador/docente/orientação/família/NEI/CIECE). Em memória: não prova RLS do banco.
import { describe, expect, it } from "vitest";
import { eligibleOn, type Allocation } from "./aa-application";
import { authorize, CAP_FOR, type Grant, type Request } from "./aa-security-integration";
import { canOpen, type Access } from "./aa-learning-map";
import { dailyTasks, countOf } from "./aa-daily-operation";

const allocs: Allocation[] = [
  { studentId: "s1", schoolId: "A", classId: "A1", from: "2026-02-01", to: "2026-05-31" },
  { studentId: "s1", schoolId: "B", classId: "B1", from: "2026-06-01", to: null },
  { studentId: "s2", schoolId: "A", classId: "A1", from: "2026-02-01", to: null },
];
const g = (capability: string, level: Grant["level"], scopeIds: string[]): Grant => ({ capability, level, scopeIds, validFrom: "2026-01-01", validTo: null });
const req = (o: Partial<Request>): Request => ({ data: "agregado", at: "2026-04-10", target: { schoolId: "A" }, purpose: null, allocations: allocs, ...o });

describe("A&A L20 aceite integrado", () => {
  it("vínculo temporal: transferido A→B é elegível só onde estava na data", () => {
    const ids = (d: string, s: string) => JSON.stringify(eligibleOn(allocs, d, { schoolIds: new Set([s]) }));
    expect(ids("2026-04-10", "A")).toContain("s1");
    expect(ids("2026-07-01", "A")).not.toContain("s1");
    expect(ids("2026-07-01", "B")).toContain("s1");
  });

  it("perfis: cada um só no próprio escopo; nada sem política homologada", () => {
    const coordenadorRede = [g(CAP_FOR.agregado, "rede", [])];
    const aplicadorA = [g(CAP_FOR.agregado, "escola", ["A"])];
    const docenteA1 = [g(CAP_FOR.nominal, "turma", ["A1"])];
    const familiaS2 = [g(CAP_FOR.nominal, "alocacao", ["s2"])];
    const nominal = (sid: string, school: string, at = "2026-04-10") => req({ data: "nominal", at, target: { schoolId: school, studentId: sid }, purpose: "acompanhar" });
    expect(authorize(coordenadorRede, req({ target: { schoolId: "B" } }), true).ok).toBe(true);
    expect(authorize(coordenadorRede, req({}), false).ok).toBe(false);
    expect(authorize(aplicadorA, req({ target: { schoolId: "B" } }), true).ok).toBe(false);
    expect(authorize(docenteA1, nominal("s1", "A"), true).ok).toBe(true);
    expect(authorize(docenteA1, nominal("s1", "B", "2026-07-01"), true).ok).toBe(false);
    expect(authorize(familiaS2, nominal("s2", "A"), true).ok).toBe(true);
    expect(authorize(familiaS2, nominal("s1", "A"), true).ok).toBe(false);
    // Orientação, NEI e CIECE sem concessão própria: negação uniforme
    for (const grants of [[], [g("capability-inexistente", "rede", [])]]) expect(authorize(grants, nominal("s2", "A"), true).ok).toBe(false);
  });

  it("mapa: escola B fechada a quem só tem A; nível estudante exige capability+finalidade", () => {
    const a: Access = { network: false, schools: new Set(["A"]), nominal: { capability: false, purpose: null } };
    expect(canOpen("escola", { escola: "B" }, a).ok).toBe(false);
    expect(canOpen("escola", { escola: "A" }, a).ok).toBe(true);
    expect(canOpen("estudante", { escola: "A" }, a).ok).toBe(false);
  });

  it("operação do dia: leitura negada não vira zero nem pendência inventada", () => {
    expect(countOf({ ok: false, reason: "negado" }, "x").value).toBeNull();
    expect(dailyTasks(null, { ok: false, reason: "negado" }, "2026-10-12")).toEqual([]);
  });
});
