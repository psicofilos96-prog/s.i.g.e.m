import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInventory } from "../../../scripts/capability-inventory.mjs";
import { buildCapabilityMatrix, CAPABILITY_INVENTORY, extractCapabilities } from "./capability-matrix";

const inv = [{ id: "aprovar-mudancas-de-tecnologia", module: "Tecnologia", firstMigration: "0477.sql", scopes: ["rede" as const] }];
const eng = (id: string, kind: string, from = "2026-01-01", until: string | null = null) => ({ id, engagement_kind_id: kind, valid_from: from, valid_until: until });

describe("P1-02 matriz de capacidades", () => {
  it("inventário versionado está em sincronia com as migrations", () => {
    expect(CAPABILITY_INVENTORY).toEqual(buildInventory());
  });
  it("cobre os módulos novos", () => {
    const mods = new Set(CAPABILITY_INVENTORY.map((c) => c.module));
    for (const m of ["Matrículas", "Tecnologia", "Documentos e Acervo", "Desenvolvimento"]) expect(mods.has(m)).toBe(true);
  });
  it("extrai escopo da função exigente", () => {
    expect(extractCapabilities("has_network_capability('a-b') or has_school_capability('c-d', s)")).toEqual([{ id: "a-b", scope: "rede" }, { id: "c-d", scope: "escola" }]);
  });
  it("sem regra na política ⇒ sem titular, mesmo havendo atuações", () => {
    expect(buildCapabilityMatrix(inv, [], [eng("e1", "tecnico")], new Map(), "2026-10-12")[0]!.status).toBe("sem-titular");
  });
  it("regra só para tipo sem atuação vigente ⇒ regra sem vínculo", () => {
    const rules = [{ engagement_kind_id: "gestor-ti", capability_id: "aprovar-mudancas-de-tecnologia", scope_dimensions: ["network"] }];
    const engs = [eng("e1", "gestor-ti", "2025-01-01", "2025-12-31"), eng("e2", "gestor-ti")];
    expect(buildCapabilityMatrix(inv, rules, engs, new Map([["e2", "2026-05-01"]]), "2026-10-12")[0]!.status).toBe("regra-sem-vinculo-vigente");
  });
  it("regra + atuação vigente do tipo ⇒ com titular, contando só vigentes", () => {
    const rules = [{ engagement_kind_id: "gestor-ti", capability_id: "aprovar-mudancas-de-tecnologia", scope_dimensions: ["network"] }];
    const r = buildCapabilityMatrix(inv, rules, [eng("e1", "gestor-ti"), eng("e2", "gestor-ti", "2027-01-01")], new Map(), "2026-10-12")[0]!;
    expect(r.status).toBe("com-titular");
    expect(r.holders[0]!.activeEngagements).toBe(1);
  });
  it("a matriz não grava nem atribui", () => {
    const src = readFileSync("src/features/institutional-admin/capability-matrix-section.tsx", "utf8") + readFileSync("src/features/institutional-admin/capability-matrix.ts", "utf8");
    expect(src).not.toMatch(/\.rpc\(|\.insert\(|\.update\(|supabase/);
  });
});
