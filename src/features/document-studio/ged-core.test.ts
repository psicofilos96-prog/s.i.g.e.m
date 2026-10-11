import { describe, expect, it } from "vitest";
import { attachmentAllowed, canMove, nextNumber, publicVerification, retentionAction, signatureLabel } from "./ged-core";

describe("GED", () => {
  it("numeração por tipo/ano/unidade", () => {
    const issued = [{ type: "oficio" as const, year: 2026, unit: "SEMED", seq: 4 }, { type: "oficio" as const, year: 2025, unit: "SEMED", seq: 9 }, { type: "memorando" as const, year: 2026, unit: "SEMED", seq: 7 }];
    expect(nextNumber(issued, "oficio", 2026, "SEMED").label).toBe("OFICIO Nº 005/2026 — SEMED");
    expect(nextNumber(issued, "oficio", 2026, "Escola A").seq).toBe(1);
  });
  it("tramitação fechada", () => {
    expect(canMove("rascunho", "despachado")).toBe(false);
    expect(canMove("arquivado", "em-tramitacao")).toBe(false);
  });
  it("assinatura simples não equivale à qualificada; sem pessoa recusa", () => {
    expect(signatureLabel({ kind: "simples", personId: "p", icpEvidence: null }).label).toContain("não equivale");
    expect(signatureLabel({ kind: "qualificada-icp", personId: "p", icpEvidence: null }).ok).toBe(false);
    expect(signatureLabel({ kind: "simples", personId: null, icpEvidence: null }).ok).toBe(false);
  });
  it("verificação pública só metadados", () => {
    expect(publicVerification({ numero: "1", hash: "h", conteudo: "x", assinante: "João" })).toEqual({ numero: "1", hash: "h" });
  });
  it("retenção sem decisão retém", () => {
    expect(retentionAction(null, "2010-01-01", "2026-10-11")).toBe("reter");
    expect(retentionAction({ years: 5, legalBasis: "tabela X" }, "2010-01-01", "2026-10-11")).toBe("elegivel-para-descarte-com-revisao");
  });
  it("anexo público recusado", () => expect(attachmentAllowed("https://x/y.pdf")).toBe(false));
});
