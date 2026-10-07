import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { sniffMime, checkUpload, orphanReport } from "./file-guard";
import { SIGNED_URL_TTL_SECONDS } from "./data-inventory";
const PNG = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]);
const PDF = new TextEncoder().encode("%PDF-1.7");
describe("NFILE.1", () => {
  it("MIME real", () => { expect(sniffMime(PNG)).toBe("image/png"); expect(sniffMime(new TextEncoder().encode("<html>"))).toBeNull(); });
  it("rejeita disfarce e excesso", () => {
    expect(checkUpload(PDF, "image/png", ["image/png","application/pdf"], 1e6)).toEqual({ ok: false, reason: "tipo-divergente" });
    expect(checkUpload(PNG, "image/png", ["image/png"], 4)).toEqual({ ok: false, reason: "grande-demais" });
    expect(checkUpload(PDF, "application/pdf", ["image/png"], 1e6).ok).toBe(false);
  });
  it("órfãos: só rascunho velho é limpável; referenciado nunca aparece", () => {
    const r = orphanReport([
      { bucket: "b", path: "drafts/x", createdAt: "2026-01-01" },
      { bucket: "b", path: "drafts/novo", createdAt: "2026-10-06" },
      { bucket: "b", path: "escola/a", createdAt: "2026-01-01" },
      { bucket: "b", path: "escola/ref", createdAt: "2026-01-01" },
    ], new Set(["b/escola/ref"]), new Date("2026-10-07"), 7);
    expect(r.map((f) => [f.path, f.safeToClean])).toEqual([["drafts/x", true], ["drafts/novo", false], ["escola/a", false]]);
  });
  it("URL assinada curta e nenhum URL público", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(300);
    expect(execSync("rg -l -g '!*.test.ts' getPublicUrl src || true").toString().trim()).toBe("");
    expect(readFileSync("src/features/privacy/data-inventory.ts", "utf8")).toContain("SIGNED_URL_TTL_SECONDS");
  });
});
