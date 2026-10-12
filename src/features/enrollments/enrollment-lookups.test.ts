import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ENROLLMENT_LOOKUPS, assertSafeLookups, lookupFilter, summarizeReturn } from "./enrollment-lookups";

describe("Lote 21 — busca por nome e retorno do writer", () => {
  it("nunca mostra CPF, contato, hash ou caminho de arquivo", () => {
    expect(assertSafeLookups(ENROLLMENT_LOOKUPS)).toEqual([]);
  });
  it("termo com menos de 3 letras não busca (sem listagem nominal)", () => {
    expect(lookupFilter(ENROLLMENT_LOOKUPS._application!, "ab")).toBeNull();
  });
  it("busca por nome do estudante ou código e escapa curingas", () => {
    expect(lookupFilter(ENROLLMENT_LOOKUPS._application!, "Ana%,(x")).toBe("application_code.ilike.*Ana x*,student_name.ilike.*Ana x*");
  });
  it("mostra o número de protocolo devolvido pelo banco", () => {
    expect(summarizeReturn({ protocol_number: "PROT-2026-000012", id: "u" })).toBe("protocol_number: PROT-2026-000012 · id: u");
    expect(summarizeReturn(null)).toBeNull();
  });
  it("a central de Matrículas usa a busca e não grava fora do writer", () => {
    const page = readFileSync("src/features/enrollments/enrollment-operations-page.tsx", "utf8");
    expect(page).toContain("ENROLLMENT_LOOKUPS");
    const console = readFileSync("src/components/sigem/operations-console.tsx", "utf8");
    expect(console).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });
});
