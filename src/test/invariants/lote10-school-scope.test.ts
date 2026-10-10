import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const file = readdirSync("drizzle/migrations").find((f) => f.includes("lote10_school_scope_fixes"));
const sql = readFileSync(`drizzle/migrations/${file}`, "utf8");

describe("LOTE 10 — escopo escolar", () => {
  it("capacidade de turma sem class_id não vale mais para todas as escolas", () => {
    expect(sql).not.toMatch(/c\.class_id IS NULL OR c\.class_id = _class/);
    expect(sql).toMatch(/c\.school_id = \(SELECT k\.school_id FROM public\.institutional_classes k WHERE k\.id = _class\)/);
    expect(sql).toMatch(/c\.class_id IS NULL AND c\.school_id IS NULL/); // rede (Admin/Supervisão) preservada
  });
  it("docente só lê com atuação vigente", () => {
    expect((sql.match(/e\.valid_until IS NULL OR e\.valid_until >= current_date/g) ?? []).length).toBe(2);
  });
  it("sem search_path mutável e sem grant novo", () => {
    expect(sql).toMatch(/SET search_path TO ''/);
    expect(sql).not.toMatch(/GRANT/);
  });
});
