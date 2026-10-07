import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("scripts/ops-readiness.mjs", "utf8");

describe("NOPS.2 — checklist de prontidão", () => {
  it("ensaio de restauração termina em ROLLBACK e nunca em COMMIT", () => {
    expect(src).toMatch(/rollback;/);
    expect(src).not.toMatch(/\bcommit;/i);
  });
  it("ensaio não toca tabelas de estudante", () => expect(src).not.toMatch(/student|estudante_|enrollment/i));
  it("dependências externas imprimem só presença, nunca o valor", () =>
    expect(src).toMatch(/\? "presente" : "ausente"/));
  it("área de armazenamento pública faz o checklist falhar", () => expect(src).toMatch(/área pública/));
  it("restauração completa segue marcada como pendência de infraestrutura", () => expect(src).toMatch(/INFRAESTRUTURA_PENDENTE/));
});
