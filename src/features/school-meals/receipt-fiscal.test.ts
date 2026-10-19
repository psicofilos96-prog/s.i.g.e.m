import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { receivingMessage } from "./receiving-model";

describe("Recebimento exige nota fiscal", () => {
  it("o banco recusa confirmação sem documento fiscal", () => {
    const sql = readFileSync("drizzle/migrations/0598_meal_receipt_requires_fiscal_document.sql", "utf8");
    expect(sql).toMatch(/NEW\.status = 'confirmado' AND NEW\.fiscal_document_logical_id IS NULL/);
  });
  it("a recusa vira mensagem clara", () => {
    expect(receivingMessage("meal:fiscal-document-required")).toContain("nota fiscal");
  });
});
