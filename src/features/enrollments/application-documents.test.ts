import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applicationDocumentStanding, currentSituation, fileProblem, MAX_BYTES } from "./application-documents";

const sql = readFileSync("drizzle/migrations/0461_enr09_application_documents.sql", "utf8");

describe("L09 documentos do pedido", () => {
  it("só PDF/JPG/PNG até 10 MB", () => {
    expect(fileProblem({ type: "application/pdf", size: 100 })).toBeNull();
    expect(fileProblem({ type: "text/html", size: 100 })).not.toBeNull();
    expect(fileProblem({ type: "image/png", size: MAX_BYTES + 1 })).not.toBeNull();
  });
  it("situação = última conferência; vínculo ao GED não muda situação", () => {
    expect(currentSituation([], false)).toBe("nao-enviado");
    expect(currentSituation([], true)).toBe("em-conferencia");
    expect(currentSituation([{ seq: 1, outcome: "complementacao-solicitada" }, { seq: 2, outcome: "conferido" }, { seq: 3, outcome: "vinculado-ged" }], true)).toBe("conferido");
  });
  it("pendência nunca bloqueia pedido nem direito à educação", () => {
    const s = applicationDocumentStanding([{ docType: "comprovante-residencia", situation: "recusado" }]);
    expect(s.pending).toEqual(["comprovante-residencia"]);
    expect(s.blocksApplication).toBe(false);
    expect(s.blocksEducationRight).toBe(false);
    expect(sql).not.toMatch(/enr_applications[^;]*(bloque|block)/i);
  });
  it("banco: bucket privado, upload só no caminho emitido, sem leitura pública, append-only, conferência com competência e seq", () => {
    expect(sql).toContain("enr_document_slot_open(name)");
    expect(sql).not.toMatch(/FOR SELECT TO anon/);
    expect(sql).not.toMatch(/FOR (UPDATE|DELETE)[^;]*enr-documentos/);
    expect(sql).toContain("enr_docs_append_only");
    expect(sql).toContain("conferir-documentos-de-ingresso");
    expect(sql).toContain("sequencia-desatualizada");
    expect(sql).toContain("arquivo-nao-enviado");
    expect(sql).toMatch(/'indisponivel'::text, NULL::text/);
  });
});
