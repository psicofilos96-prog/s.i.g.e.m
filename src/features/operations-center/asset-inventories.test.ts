import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canClose, divergences, INVENTORY_ASSET_WRITES, summary, type Count, type Expected } from "./asset-inventories";

const SQL = readFileSync("drizzle/migrations/0418_ops11_asset_inventories.sql", "utf8");
const E: Expected[] = [{ assetId: "a1", expectedSpace: "s1" }, { assetId: "a2", expectedSpace: "s1" }, { assetId: "a3", expectedSpace: "s2" }];
const C: Count[] = [
  { id: "c1", assetId: "a1", result: "localizado", foundSpace: "s1", actorPerson: "m", hasEvidence: true },
  { id: "c2", assetId: "a2", result: "localizado", foundSpace: "s2", actorPerson: "m", hasEvidence: false },
  { id: "c3", assetId: null, result: "nao-esperado", foundSpace: "s1", foundDescription: "Projetor sem plaqueta", actorPerson: "m", hasEvidence: true },
];

describe("Centro de Operações L11 — inventário", () => {
  it("divergências são projeção: não conferido, outro ambiente, não esperado", () => {
    const d = divergences(E, C, []);
    expect(d.map((x) => x.kind).sort()).toEqual(["nao-conferido", "nao-esperado", "outro-ambiente"]);
    expect(summary(E, d)).toMatchObject({ expected: 3, located: 1, notChecked: 1, otherSpace: 1, unexpected: 1 });
  });
  it("encerramento: fora da equipe, tudo conferido, divergência com providência", () => {
    const full = [...C, { id: "c4", assetId: "a3", result: "nao-localizado", foundSpace: null, actorPerson: "m", hasEvidence: false } as Count];
    const noAct = divergences(E, full, []);
    expect(canClose({ team: ["m"], counters: ["m"], closer: "m", divergences: noAct }).ok).toBe(false);
    expect(canClose({ team: ["m"], counters: ["m"], closer: "dir", divergences: noAct }).ok).toBe(false);
    const acts = [{ assetId: "a2", kind: "regularizar-localizacao", note: "Atualizar ambiente" }, { assetId: "a3", kind: "apurar-desaparecimento", note: "Abrir apuração" },
      { assetId: null, countId: "c3", kind: "incorporar", note: "Verificar origem do projetor" }];
    expect(canClose({ team: ["m"], counters: ["m"], closer: "dir", divergences: divergences(E, full, acts) }).ok).toBe(true);
  });
  it("banco: fotografia na abertura, uma conferência por bem, encerramento fail-closed, sem escrita no bem", () => {
    expect(SQL).toMatch(/INSERT INTO public\.ops_asset_inventory_expected[\s\S]*effective_on <= _ref/);
    expect(SQL).toMatch(/ops_inv_one_count_per_asset/);
    for (const r of ["opsinv:self-close", "opsinv:unchecked-assets", "opsinv:divergence-without-action", "opsinv:not-team-member", "opsinv:asset-not-expected"]) expect(SQL).toContain(r);
    expect(SQL).not.toMatch(/INSERT INTO public\.ops_asset_events/);
    expect(INVENTORY_ASSET_WRITES).toEqual([]);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
