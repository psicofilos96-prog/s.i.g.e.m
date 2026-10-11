import { describe, expect, it } from "vitest";
import { displayStatus, fileProblem, reviewNeedsNote, sha256Hex, storagePath } from "./documents-model";

describe("DocServ documentos", () => {
  it("aceita só PDF/JPG/PNG até 10 MB", () => {
    expect(fileProblem({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(fileProblem({ type: "application/zip", size: 1000 })).not.toBeNull();
    expect(fileProblem({ type: "image/png", size: 11 * 1024 * 1024 })).not.toBeNull();
  });
  it("vencido é derivado da validade", () => {
    expect(displayStatus("valido", "2026-01-01", "2026-10-11")).toBe("vencido");
    expect(displayStatus("valido", "2027-01-01", "2026-10-11")).toBe("valido");
    expect(displayStatus("pendente_validacao", null, "2026-10-11")).toBe("pendente_validacao");
    expect(displayStatus("valido", "2026-01-01", "2026-10-11", true)).toBe("excluido");
  });
  it("rejeitar ou alertar exige observação", () => {
    expect(reviewNeedsNote("rejeitado")).toBe(true); expect(reviewNeedsNote("valido")).toBe(false);
  });
  it("caminho começa por pessoa/documento", () => {
    expect(storagePath("p1", "d1", "cert idão.pdf").startsWith("p1/d1/")).toBe(true);
  });
  it("hash SHA-256 conhecido", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
