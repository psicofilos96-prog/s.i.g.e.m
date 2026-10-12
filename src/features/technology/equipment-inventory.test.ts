import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { equipmentInventory, techCategories, type AssetRow, type CategoryMark } from "./equipment-inventory";

const M: CategoryMark[] = [
  { seq: 1, categoryKey: "informatica", action: "incluir", personId: "a", approvedBy: "b" },
  { seq: 2, categoryKey: "mobiliario", action: "incluir", personId: "a", approvedBy: null },
  { seq: 3, categoryKey: "audiovisual", action: "incluir", personId: "a", approvedBy: "a" },
];
const sheet = (serial: string | null) => [{ version: 1, equipmentType: "notebook", manufacturer: "X", model: "Y", serialNumber: serial }];
const A: AssetRow[] = [
  { id: "1", internalCode: "SIGEM-BEM-1", categoryKey: "informatica", events: [{ seq: 1, kind: "localizacao", schoolId: "s1", spaceId: "lab" }, { seq: 2, kind: "estado", condition: "bom" }], sheets: sheet("ABC") },
  { id: "2", internalCode: "SIGEM-BEM-2", categoryKey: "informatica", events: [{ seq: 1, kind: "localizacao", schoolId: "s1" }], sheets: sheet(" abc ") },
  { id: "3", internalCode: "SIGEM-BEM-3", categoryKey: "informatica", events: [], sheets: [] },
  { id: "4", internalCode: "SIGEM-BEM-4", categoryKey: "informatica", events: [{ seq: 1, kind: "baixa" }], sheets: [] },
  { id: "5", internalCode: "SIGEM-BEM-5", categoryKey: "mobiliario", events: [], sheets: [] },
];
const SQL = readFileSync("drizzle/migrations/0486_tech11_equipment_inventory.sql", "utf8");

describe("Tecnologia L11 — inventário de equipamentos", () => {
  it("só categorias aprovadas por outra pessoa contam", () => {
    expect([...techCategories(M)]).toEqual(["informatica"]);
    expect([...techCategories([...M, { seq: 4, categoryKey: "informatica", action: "retirar", personId: "a", approvedBy: "b" }])]).toEqual([]);
    expect(equipmentInventory(A, []).status).toBe("sem-categoria-aprovada");
  });
  it("inventário vem da cadeia patrimonial; baixados saem e lacunas aparecem", () => {
    const inv = equipmentInventory(A, M);
    expect(inv.items.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(inv.items[0]).toMatchObject({ schoolId: "s1", spaceId: "lab", condition: "bom", officialTag: null });
    expect(inv.writtenOff).toBe(1);
    expect(inv.gaps).toEqual({ withoutSheet: ["3"], withoutLocation: ["3"], withoutCondition: ["2", "3"], duplicateSerials: [["1", "2"]] });
  });
  it("banco: sem cadastro paralelo nem campo contábil, append-only, aprovador ≠ autor", () => {
    expect(SQL).toMatch(/REFERENCES public\.ops_assets\(id\)/);
    expect(SQL).not.toMatch(/CREATE TABLE public\.tech_(assets|equipments?)\b/);
    expect(SQL).toMatch(/'valor','custo','preco','depreciacao'/);
    expect(SQL).toMatch(/aprovador-igual-autor/);
    expect(SQL).toMatch(/bem-baixado/);
    expect((SQL.match(/doc_numbering_append_only/g) ?? []).length).toBe(3);
  });
});
