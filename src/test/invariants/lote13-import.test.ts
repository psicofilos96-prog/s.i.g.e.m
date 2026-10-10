import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((f) => f.includes("lote13_student_bond_census_attributes"))}`, "utf8");
describe("LOTE 13 — importação incremental", () => {
  it("lista fechada de campos, sem identidade nem PII", () => {
    expect(sql).toMatch(/field IN \('tipo-atendimento','recebe-aee','transporte-escolar'\)/);
    expect(sql).not.toMatch(/cpf|filia|endere|nascimento|nome/i);
  });
  it("idempotente, append-only, proveniência obrigatória e sem escrita por app role", () => {
    expect(sql).toContain("UNIQUE (bond_observation_id, field)");
    expect(sql).toContain("BEFORE UPDATE OR DELETE");
    for (const c of ["source_hash text NOT NULL", "source_locator text NOT NULL", "technical_operation_id uuid NOT NULL"]) expect(sql).toContain(c);
    expect(sql).not.toMatch(/GRANT[^;]*INSERT[^;]*TO (authenticated|anon)/);
    expect(sql).not.toMatch(/TO anon/);
  });
});
