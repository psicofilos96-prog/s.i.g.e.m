import { describe, expect, it } from "vitest";
import { isActive, protectionDocPath } from "./protection-model";

describe("proteção judicial", () => {
  it("documento fica na pasta da própria escola e do aluno", () => {
    expect(protectionDocPath("inep-1", "s1", "id", "Mandado judicial (1).pdf")).toBe("inep-1/s1/id-Mandado_judicial_1_.pdf");
  });
  it("vigência: encerrada ou fora do período não vale", () => {
    expect(isActive("2026-01-01", null, false, "2026-10-17")).toBe(true);
    expect(isActive("2026-01-01", "2026-05-01", false, "2026-10-17")).toBe(false);
    expect(isActive("2026-01-01", null, true, "2026-10-17")).toBe(false);
  });
});
