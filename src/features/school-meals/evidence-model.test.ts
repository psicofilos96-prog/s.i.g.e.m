import { describe, expect, it } from "vitest";
import { evidenceMessage, sha256Hex, sniffMedia, validateEvidence, EVIDENCE_MAX_BYTES } from "./evidence-model";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

describe("evidências da alimentação", () => {
  it("identifica o tipo pelos bytes, não pelo nome", () => {
    expect(sniffMedia(png)).toBe("image/png");
    expect(sniffMedia(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMedia(new TextEncoder().encode("<html>"))).toBeNull();
  });
  it("recusa vazio, acima de 10 MB, tipo falso e tipo divergente", () => {
    expect(validateEvidence(new Uint8Array(), "image/png")).toEqual({ error: "meal:evidence-size" });
    expect(validateEvidence(new Uint8Array(EVIDENCE_MAX_BYTES + 1), "")).toEqual({ error: "meal:evidence-size" });
    expect(validateEvidence(new TextEncoder().encode("x"), "application/pdf")).toEqual({ error: "meal:evidence-media-type" });
    expect(validateEvidence(png, "application/pdf")).toEqual({ error: "meal:evidence-media-mismatch" });
    expect(validateEvidence(png, "image/png")).toEqual({ media: "image/png" });
  });
  it("calcula o SHA-256 do original", async () => {
    expect(await sha256Hex(png)).toBe("c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77");
  });
  it("negação de permissão vira mensagem sem revelar dado", () => {
    expect(evidenceMessage("capability:conferir-recebimento-alimentar")).toMatch(/permissão/);
  });
});
