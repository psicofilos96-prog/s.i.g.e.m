import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertSafePath, guardUpload, safeLabel, UPLOAD_POLICY, uploadRefusalText } from "./upload-policy";
import { governError } from "@/lib/observability/governed-errors";
import { orphanReport } from "./file-guard";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7 x");
const UPLOAD_SITES = [
  "src/features/inclusion/inclusion-attachments.functions.ts",
  "src/features/teaching-planning/planning-source.ts",
  "src/features/teacher-assessment/authoring-source.ts",
  "src/features/school-meals/evidence.functions.ts",
  "src/features/school-secretariat/enrollment-wizard-source.ts",
];

describe("NFILE.1.1 — política única de upload", () => {
  it("os 5 pontos de upload passam por guardUpload e caminho seguro; nenhum URL público", () => {
    for (const f of UPLOAD_SITES) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/guardUpload\("/);
      expect(s, f).toMatch(/assertSafePath\(/);
      expect(s, f).not.toMatch(/getPublicUrl|upsert:\s*true/);
    }
  });
  it("MIME falso (extensão/tipo declarado mente) é recusado", () => {
    expect(() => guardUpload("planejamento-docente", png, "application/pdf")).toThrow("upload:tipo-divergente");
    expect(() => guardUpload("fotos-estudantes", pdf, "application/pdf")).toThrow("upload:tipo-nao-permitido");
    expect(() => guardUpload("avaliacao-docente", new TextEncoder().encode("<script>"), "image/png")).toThrow("upload:tipo-nao-permitido");
  });
  it("arquivo grande e vazio recusados pelo limite do domínio", () => {
    const big = new Uint8Array(UPLOAD_POLICY["fotos-estudantes"].maxBytes + 1); big.set(png);
    expect(() => guardUpload("fotos-estudantes", big, "image/png")).toThrow("upload:grande-demais");
    expect(() => guardUpload("inclusao-sensivel", new Uint8Array(), "")).toThrow("upload:vazio");
    expect(guardUpload("inclusao-sensivel", pdf, "application/pdf")).toBe("application/pdf");
  });
  it("path traversal e nome hostil neutralizados", () => {
    expect(() => assertSafePath("escola/../outra/x")).toThrow("upload:caminho-invalido");
    expect(() => assertSafePath("a//b")).toThrow();
    expect(safeLabel("../../etc/passwd")).toBe("passwd");
    expect(safeLabel('C:\\x\\<img onerror=1>.pdf')).not.toMatch(/[<>\\/]/);
    expect(safeLabel("...")).toBe("arquivo");
  });
  it("recusa vira mensagem de validação, nunca texto cru", () => {
    expect(governError(new Error("upload:tipo-divergente")).category).toBe("validacao");
    expect(uploadRefusalText(new Error("upload:grande-demais"))).toMatch(/tamanho/);
  });
  it("arquivo referenciado (histórico/versionado) nunca é limpável; só rascunho velho sem referência", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    const r = orphanReport([
      { bucket: "fotos-estudantes", path: "e/drafts/x.png", createdAt: "2026-01-01" },
      { bucket: "fotos-estudantes", path: "e/d/ref.png", createdAt: "2026-01-01" },
      { bucket: "inclusao-sensivel", path: "e/a/solto", createdAt: "2026-01-01" },
    ], new Set(["fotos-estudantes/e/d/ref.png"]), now, 30);
    expect(r.map((x) => [x.path, x.safeToClean])).toEqual([["e/drafts/x.png", true], ["e/a/solto", false]]);
  });
});
