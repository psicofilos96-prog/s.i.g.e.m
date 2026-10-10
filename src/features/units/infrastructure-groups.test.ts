import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const eqs: Array<[string, unknown]> = [];
let denied = false;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => {
    const b: Record<string, (...a: unknown[]) => unknown> = {};
    for (const k of ["select", "limit", "abortSignal"]) b[k] = () => b;
    b["eq"] = (c: unknown, v: unknown) => { eqs.push([`${t}.${c}`, v]); return b; };
    b["then"] = (r: (v: unknown) => unknown) => Promise.resolve(denied ? { data: null, error: { message: "denied" } } : { data: [], error: null }).then(r);
    return b;
  } },
}));

import { groupInfra, infraGroupOf } from "./infrastructure-groups";
import { readSchoolInfrastructure } from "./unit-infrastructure-panel";
import { formatInfraValue } from "@/features/schools/school-infrastructure";

describe("infraestrutura escolar 2026", () => {
  it("agrupa pelos campos da fonte", () => {
    expect(infraGroupOf("banheiro-acessivel", "Banheiro acessível (G2)")).toBe("acessibilidade");
    expect(infraGroupOf("abastecimento-de-agua", "Abastecimento de água")).toBe("servicos");
    expect(infraGroupOf("cozinha", "Cozinha (G1)")).toBe("dependencias");
    expect(infraGroupOf("biblioteca", "Biblioteca (G4)")).toBe("instalacoes");
    expect(infraGroupOf("forma-de-ocupacao-do-predio-escolar", "Forma de ocupação do prédio escolar")).toBe("predio");
    expect(infraGroupOf("novo-campo", "Algo novo")).toBe("outros");
  });
  it("equipamentos sem campo na fonte continua visível como ausência; nada é descartado", () => {
    const g = groupInfra([{ attributeId: "x", label: "Novo" }, { attributeId: "cozinha", label: "Cozinha (G1)" }]);
    expect(g.find((x) => x.group === "equipamentos")?.items).toEqual([]);
    expect(g.flatMap((x) => x.items)).toHaveLength(2);
  });
  it("ausência não vira 'não'", () => {
    expect(formatInfraValue(null)).toBe("não informado");
    expect(formatInfraValue(false)).toBe("não");
  });
  it("lê só a escola pedida, com a sessão; recusa falha fechada", async () => {
    eqs.length = 0;
    await readSchoolInfrastructure("E1");
    expect(eqs).toContainEqual(["school_infrastructure_observations.school_id", "E1"]);
    denied = true;
    await expect(readSchoolInfrastructure("E2")).rejects.toThrow();
    denied = false;
    const src = readFileSync("src/features/units/unit-infrastructure-panel.tsx", "utf8");
    expect(src).not.toMatch(/client\.server|\.insert\(|\.update\(|\.delete\(/);
  });
});
