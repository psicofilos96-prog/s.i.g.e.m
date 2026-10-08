import { describe, it, expect } from "vitest";
import { importTooLarge, IMPORT_MAX_BYTES } from "./import-kernel";
describe("NFILE.3 — teto de leitura de importação", () => {
  it("aceita até 20 MB", () => expect(importTooLarge({ size: 20 * 1024 * 1024 })).toBe(false));
  it("recusa acima de 20 MB", () => expect(importTooLarge({ size: IMPORT_MAX_BYTES + 1 })).toBe(true));
});
