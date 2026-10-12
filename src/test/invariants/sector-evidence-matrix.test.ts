import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sem tipos
import { buildMatrix } from "../../../scripts/sector-evidence-matrix.mjs";
import { PERMANENCE_STAGES } from "@/features/permanence/permanence-operations.gen";
import { OPS_STAGES } from "@/features/operations-center/ops-operations.gen";

describe("lote 17 — matriz evidência/pendência por setor", () => {
  it("o arquivo versionado é o que o disco prova hoje", () => {
    expect(JSON.parse(readFileSync("docs/data/sector-evidence-matrix.json", "utf8"))).toEqual(buildMatrix());
  });
  it("cobre os 12 setores pedidos", () => {
    expect(buildMatrix().map((s: { sector: string }) => s.sector)).toHaveLength(12);
  });
  it("toda ação dos consoles gerados aponta para writer existente", () => {
    const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
    for (const a of [...PERMANENCE_STAGES, ...OPS_STAGES].flatMap((s) => s.actions)) expect(types, a.rpc).toContain(`      ${a.rpc}: {`);
  });
});
