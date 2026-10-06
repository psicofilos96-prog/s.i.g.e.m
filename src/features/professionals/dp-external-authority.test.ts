import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IMPORT_ADAPTERS, adapterById } from "@/features/data-import/adapters";
import { ITEMS, evaluate } from "@/features/year-preparation/readiness-model";
import { BLOCKED_DEPENDENCIES } from "@/features/support/diagnostics-model";

const read = (p: string) => readFileSync(p, "utf8");
describe("BC — DP externo é a autoridade funcional", () => {
  it("nenhum menu/guia atual anuncia módulo ou perfil RH", () => {
    expect(read("src/config/navigation.ts")).not.toMatch(/\bRH\b|Vida funcional|recursos humanos/i);
    expect(read("src/features/institutional-admin/general-admin.ts")).not.toMatch(/\(RH\)/);
    expect(read("docs/guias-por-perfil-ba.md")).not.toMatch(/^\| RH \|/m);
  });
  it("readiness não exige perfil RH e DP fica bloqueado sem contrato", () => {
    expect(JSON.stringify(ITEMS)).not.toMatch(/\bRH\b/);
    const dp = evaluate({}).find((s) => s.id === "dp")!;
    expect(dp.state).toBe("BLOCKED");
    expect(dp.reason).toContain("DP_FILE_CONTRACT_PENDING");
  });
  it("nenhum adapter presume layout DP/GPE", () => {
    for (const id of ["dp-quadro-funcional", "gpe"]) {
      const a = adapterById(id)!;
      expect(a.layoutStatus).toBe("leiaute-ausente");
      expect(a.comparedFields).toEqual([]);
      expect(() => a.parse("cpf;nome;cargo")).toThrow();
    }
    expect(IMPORT_ADAPTERS.filter((a) => /dp|pessoal/i.test(a.id) && a.layoutStatus !== "leiaute-ausente")).toEqual([]);
  });
  it("GPE não é apresentado como arquivo aguardado", () => {
    expect(BLOCKED_DEPENDENCIES.map((b) => `${b.id} ${b.label}`).join()).not.toMatch(/GPE/);
    expect(JSON.stringify(ITEMS)).not.toMatch(/GPE/);
    for (const d of ["docs/release-candidate-ax.md", "docs/guias-por-perfil-ba.md"]) expect(read(d)).not.toMatch(/arquivo DP|DP\/GPE|; GPE;/);
  });
});
