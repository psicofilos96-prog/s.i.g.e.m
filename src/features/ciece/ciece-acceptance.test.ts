/**
 * CIECE Lote 20 — aceite integrado (camada pura, fixture sintética única em memória).
 * Duas escolas, transferência temporal, aluno sem turma, duplicidade, correção retroativa,
 * IBGE/INEP, Censo, snapshot/comparação, séries, projeção, solicitações, acesso e exportação.
 * NÃO prova RLS no banco nem login: isso exige SIGEM_TEST_HARNESS=1 (ausente).
 */
import { describe, expect, it } from "vitest";
import { audit } from "./quality-auditor";
import { openCases } from "./correction-desk";
import { buildSnapshot, compareSnapshots, officialize, reproduces } from "./historical-snapshots";
import { panorama } from "./observatory";
import { buildSeries, comparePoints } from "./indicator-series";
import { projectDemand } from "./projections";
import { agenda } from "./requests-documents";
import { decideAccess, registerExport, checkFlow, CIECE_INTEGRATIONS } from "./security-integration";

const SCHOOLS = [
  { id: "A", inep: "33000001", ibge: null, district: "Centro" },
  { id: "B", inep: null, ibge: null, district: null },
];
const key = { year: "2026", stageKey: "matricula-inicial", referenceDate: "2026-05-27", ruleRef: "mi@1" };
const src = [{ name: "alocacoes", sha256: "h1", knownAt: "2026-06-01" }];
const fact = (factId: string, o: Record<string, unknown> = {}) => ({ factId, personId: "p-" + factId, enrollmentId: "m-" + factId, schoolId: "A", classId: "T1" as string | null, validFrom: "2026-02-01" as string | null, validTo: null as string | null, version: 1, recordedAt: "2026-03-01", ...o });

describe("CIECE L20 aceite integrado", () => {
  it("cadastro: INEP ausente e distrito ausente viram pendência com dono, nunca correção", () => {
    const fs = audit({ schools: SCHOOLS });
    expect(fs.some((f) => f.subject === "B")).toBe(true);
    expect(fs.every((f) => f.subject !== "A" || f.grade !== "erro-confirmado")).toBe(true);
    const { cases } = openCases(fs);
    expect(cases.length).toBeGreaterThan(0);
    expect(new Set(cases.map((c) => c.protocol)).size).toBe(cases.length);
  });

  it("aluno sem turma, sem início e multiescola não somam ao total", () => {
    const fs = audit({ enrollments: [
      { id: "e1", studentId: "s1", schoolId: "A", yearId: "2026", openedOn: null, hasAllocation: false, author: "u" },
      { id: "e2", studentId: "s2", schoolId: "A", yearId: "2026", openedOn: "2026-02-01", hasAllocation: true, author: "u" },
      { id: "e3", studentId: "s2", schoolId: "B", yearId: "2026", openedOn: "2026-03-01", hasAllocation: true, author: "u" },
    ] });
    expect(fs.map((f) => f.ruleId)).toEqual(expect.arrayContaining(["sem-enturmacao"]));
    expect(fs.filter((f) => f.ruleId === "matricula-multiescola").every((f) => f.grade === "provavel")).toBe(true);
  });

  it("transferência A→B entre fotografias MI e posterior; correção retroativa nova versão", () => {
    const mi = buildSnapshot(key, [fact("1"), fact("2", { classId: null }), fact("3", { validFrom: null })], src, "2026-06-01", "p");
    expect(mi.excluded.map((e) => e.factId)).toContain("3");
    const chain = officialize([], mi);
    const later = buildSnapshot({ ...key, referenceDate: "2026-09-01" }, [fact("1", { validTo: "2026-07-31" }), fact("1b", { personId: "p-1", enrollmentId: "m-1b", schoolId: "B", validFrom: "2026-08-01" }), fact("2", { classId: null })], src, "2026-06-01", "p");
    const d = compareSnapshots(mi, later);
    expect(d.items).toEqual(expect.arrayContaining([{ factId: "1b", reason: "transferencia", detail: "A→B" }]));
    expect(d.items.some((i) => i.reason === "saida")).toBe(false);
    expect(reproduces(chain[0]!, buildSnapshot(key, [fact("2", { classId: null }), fact("3", { validFrom: null }), fact("1")], src, "2026-06-01", "q"))).toBe(true);
  });

  it("observatório e série: não lido ≠ 0; comparação só entre equivalentes", () => {
    const cells = panorama({ escolas: { state: "lido", value: 2, source: "s", referenceDate: "d" } });
    expect(cells.find((c) => c.key === "escolas")!.display).toBe("2");
    expect(cells.find((c) => c.key === "matriculas")!.display).toBe("não apurado");
    const P = [{ id: "b1", periodicity: "bimestral" as const, from: "2026-02-01", to: "2026-03-31", source: "cal" }];
    const o = (s: string, v: number | null) => ({ indicator: "mat", version: 1, schoolId: s, periodId: "b1", value: v, state: v === null ? "desconhecido" as const : "disponivel" as const, knownAt: "k", refs: [] });
    expect(comparePoints(buildSeries("mat", 1, "bimestral", "A", P, [o("A", 2)]), 0, buildSeries("mat", 1, "bimestral", "B", P, [o("B", null)]), 0).comparable).toBe(false);
  });

  it("projeção nunca é oficial; agenda sem documento fica pendente", () => {
    expect(projectDemand([{ year: 2025, value: 2, source: "x" }], [2027]).nature).toBe("recusada");
    expect(agenda([{ id: "sa", title: "Situação do Aluno", kind: "censo", date: "2027-02-01", sourceDoc: null }]).dated).toHaveLength(0);
  });

  it("acesso: escola A não vê B; nominal remove sensível; exportação registrada", () => {
    const pA = { userId: "u", capabilities: new Set(["consultar-ciece", "consultar-nominal-censo", "exportar-ciece"]), network: false, schools: new Set(["A"]), policyHomologated: true };
    expect(decideAccess(pA, { level: "agregado", schoolIds: ["B"], purpose: null, fields: [] }).allow).toBe(false);
    expect(decideAccess(pA, { level: "nominal", schoolIds: ["A"], purpose: "censo", fields: ["nome", "cpf"] }).droppedFields).toEqual(["cpf"]);
    expect(registerExport([], pA, { key: "k", userId: "u", report: "r", level: "agregado", params: "{}", sha256: "e".repeat(64), at: "t" }).ok).toBe(true);
    expect(checkFlow(CIECE_INTEGRATIONS.find((i) => i.sector === "NEI")!, ["laudo"]).ok).toBe(false);
  });
});
