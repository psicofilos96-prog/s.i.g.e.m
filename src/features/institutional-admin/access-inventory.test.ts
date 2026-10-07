import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { LOGINS_REPORT, exportRows, filterInventory, passwordProblem, resetEligibility, type InventoryRow } from "./access-inventory";

const row = (o: Partial<InventoryRow>): InventoryRow => ({
  user_id: crypto.randomUUID(), login: "x@sigem.itap.gov.br", account_kind: "setorial", station_code: "secretaria_escolar",
  scope_kind: "school", school_id: "inep-1", school_name: "E. M. A", inep: "1", revoked: false, banned: false,
  last_sign_in_at: null, created_at: "2026-10-06T00:00:00Z", origin: "decisao", person_name: null, ...o,
});

describe("N1 inventário de logins", () => {
  it("filtra por estação, escola, tipo e situação", () => {
    const rows = [row({}), row({ station_code: "ciece", scope_kind: "network", school_id: null }), row({ account_kind: "humano", revoked: false }), row({ revoked: true })];
    expect(filterInventory(rows, { station: "ciece" })).toHaveLength(1);
    expect(filterInventory(rows, { kind: "humano" })).toHaveLength(1);
    expect(filterInventory(rows, { state: "revogada" })).toHaveLength(1);
    expect(filterInventory(rows, { school: "inep-1" })).toHaveLength(3);
  });
  it("lote só de contas de setor; pessoa só individualmente", () => {
    expect(resetEligibility([row({}), row({})]).ok).toBe(true);
    expect(resetEligibility([row({}), row({ account_kind: "humano" })]).ok).toBe(false);
    expect(resetEligibility([row({ account_kind: "humano" })]).ok).toBe(true);
    expect(resetEligibility([row({ revoked: true })]).ok).toBe(false);
  });
  it("senha exige 12+ caracteres, letras e números e confirmação igual", () => {
    expect(passwordProblem("curta1", "curta1")).not.toBeNull();
    expect(passwordProblem("somenteletrasaqui", "somenteletrasaqui")).not.toBeNull();
    expect(passwordProblem("Itaperuna2026x", "Itaperuna2026y")).not.toBeNull();
    expect(passwordProblem("Itaperuna2026x", "Itaperuna2026x")).toBeNull();
  });
  it("exportação tem as colunas pedidas e nenhuma coluna de segredo", () => {
    const ids = LOGINS_REPORT.columns.map((c) => c.id);
    expect(ids).toEqual(["login", "tipo", "estacao", "escopo", "escola", "inep", "situacao", "ultimo_acesso", "criada_em", "origem"]);
    expect(ids.some((i) => /senha|password|hash|token/.test(i))).toBe(false);
    const csv = toCsv(runReport(LOGINS_REPORT, { params: {} }, exportRows([row({}), row({ revoked: true })])), { headerLines: [], title: "t" });
    expect(csv).toContain("Acesso revogado");
    expect(csv).toContain("E. M. A");
  });
  it("o valor da senha nunca é gravado, registrado nem devolvido pelo servidor", () => {
    const src = readFileSync("src/features/institutional-admin/access-reset.functions.ts", "utf8");
    expect(src).not.toMatch(/console\.|telemetry|log\(/);
    expect(src).not.toMatch(/return[^;]*password/);
    const sql = readFileSync("drizzle/migrations/0210_n1_access_center_inventory.sql", "utf8");
    expect(sql).not.toMatch(/password|senha text/i);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals s WHERE s.auth_user_id = auth.uid())");
  });
});
