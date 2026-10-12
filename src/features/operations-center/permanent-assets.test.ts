import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCOUNTING_FIELDS, ASSET_WRITERS, displayTag, projectAsset, type AssetEvent } from "./permanent-assets";

const SQL = readFileSync("drizzle/migrations/0414_ops09_assets.sql", "utf8");
const ID = { internalCode: "SIGEM-BEM-00000001", categoryKey: "mobiliario", description: "Mesa", origin: "doacao", originRef: "Termo 12", incorporatedOn: "2026-02-01" };
const L: AssetEvent = { seq: 1, kind: "localizacao", on: "2026-02-01", actorPerson: "a", schoolId: "s1", spaceId: "sala1" };

describe("Centro de Operações L09 — bens permanentes", () => {
  it("código interno nunca vira tombamento; oficial só com fonte e documento", () => {
    const p = projectAsset(ID, [L]);
    expect(p.ok && p.asset.tagState).toBe("sem-tombamento-oficial");
    expect(p.ok && displayTag(p.asset)).toMatch(/Sem tombamento oficial/);
    expect(projectAsset(ID, [L, { seq: 2, kind: "tombamento-oficial", on: "2026-03-01", actorPerson: "b", officialTag: "123", officialSource: "", hasDoc: true }]).ok).toBe(false);
    const t = projectAsset(ID, [L, { seq: 2, kind: "tombamento-oficial", on: "2026-03-01", actorPerson: "b", officialTag: "123", officialSource: "Livro de tombo PMI", hasDoc: true }]);
    expect(t.ok && t.asset.officialTag).toBe("123");
  });
  it("responsável não acompanha mudança de escola; baixa encerra cadeia", () => {
    const ev: AssetEvent[] = [L, { seq: 2, kind: "responsavel", on: "2026-02-02", actorPerson: "a", engagementId: "eng" },
      { seq: 3, kind: "localizacao", on: "2026-03-01", actorPerson: "a", schoolId: "s2" }];
    const p = projectAsset(ID, ev);
    expect(p.ok && p.asset).toMatchObject({ schoolId: "s2", responsibleEngagement: null });
    const b = [...ev, { seq: 4, kind: "baixa", on: "2026-04-01", actorPerson: "c", hasDoc: true, note: "Inservível conforme laudo" } as AssetEvent];
    expect(projectAsset(ID, [...b, { seq: 5, kind: "estado", on: "2026-04-02", actorPerson: "c", condition: "bom" }])).toEqual({ ok: false, reason: "evento-apos-baixa" });
  });
  it("banco: tombamento único, sem campo contábil, writers definer e sem DML direto", () => {
    expect(SQL).toMatch(/UNIQUE INDEX ops_asset_official_tag_unique/);
    for (const f of ACCOUNTING_FIELDS) expect(SQL).not.toMatch(new RegExp(`\\b${f} (numeric|text|int)`));
    for (const w of ASSET_WRITERS) expect(SQL).toMatch(new RegExp(`FUNCTION public\\.${w}\\(`));
    expect(SQL).toMatch(/opsa:category-not-approved/);
    expect(SQL).toMatch(/opsac:self-approval/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
