import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { goDecision, pilotChecklist, type NetworkFacts } from "./pilot-readiness";
import type { ClassFacts, SchoolFacts } from "@/features/onboarding/onboarding-model";

const net: NetworkFacts = { homologatedPolicies: 1, schools: 1, schoolEngagements: 3, importBatches: 0, documentTemplates: 1, guardianAuthorizations: 0, familyEnabled: false };
const cls: ClassFacts = { classId: "t", name: "1A", record: true, periodOrganization: true, matrix: "resolvida", journey: true, schedule: true, assignments: 1, allocations: 0, offering: null, shift: null };
const school = (c: ClassFacts[] | null, cal: number | null = 1): SchoolFacts => ({ schoolId: "e", schoolName: "E", validOn: "2027-03-01", enrollments: 0, calendars: cal, engagements: 3, classes: c });
const st = (items: ReturnType<typeof pilotChecklist>, id: string) => items.find((i) => i.id === id)!.state;

describe("prontidão para piloto", () => {
  it("backup é sempre confirmação manual ⇒ NO-GO até o runbook", () => {
    const items = pilotChecklist(net, school([cls]));
    expect(st(items, "backup")).toBe("pendente");
    expect(goDecision(items).open.map((i) => i.id)).toEqual(["backup"]);
  });
  it("leitura falha ⇒ bloqueado, nunca concluído", () => {
    expect(st(pilotChecklist({ ...net, homologatedPolicies: null }, null), "politica")).toBe("bloqueado");
    expect(st(pilotChecklist(net, school(null)), "escola-diario")).toBe("bloqueado");
  });
  it("opcionais: sem lote e família desligada são não aplicáveis e não travam", () => {
    const items = pilotChecklist(net, school([cls]));
    expect(st(items, "importacao")).toBe("nao-aplicavel"); expect(st(items, "familia")).toBe("nao-aplicavel");
    expect(st(pilotChecklist({ ...net, familyEnabled: true }, null), "familia")).toBe("pendente");
  });
  it("dois calendários bloqueiam; turma pendente é contada, sem porcentagem", () => {
    expect(st(pilotChecklist(net, school([cls], 2)), "calendario")).toBe("bloqueado");
    const i = pilotChecklist(net, school([cls, { ...cls, classId: "u", schedule: false }])).find((x) => x.id === "escola-diario")!;
    expect(i.state).toBe("pendente"); expect(i.why).toBe("1 de 2 turmas com pendência."); expect(i.why).not.toMatch(/%/);
  });
  it("todo item leva a uma tela existente", () => {
    const routes = readdirSync("src/routes").map((f) => f.replace(/\.tsx?$/, ""));
    for (const i of pilotChecklist(net, school([cls]))) { const f = i.fix.slice(1).replace(/\//g, "."); expect(routes.includes(f) || routes.includes(`${f}.index`), i.fix).toBe(true); }
  });
  it("página só lê (sem escrita)", () => {
    expect(readFileSync("src/features/pilot/pilot-page.tsx", "utf8")).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  });
});
