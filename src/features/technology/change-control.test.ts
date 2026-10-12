import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { changeOutcome, changeReadiness, missingDocs } from "./change-control";

const SQL = readFileSync("drizzle/migrations/0484_tech10_change_documents.sql", "utf8") + readFileSync("drizzle/migrations/0485_tech10_fix_juntada_check.sql", "utf8");

describe("Tecnologia L10 — mudanças documentadas e reversão", () => {
  it("cada ato exige seu documento", () => {
    expect(missingDocs("aprovar", [], ["avaliar"])).toEqual(["plano"]);
    expect(missingDocs("executar", ["plano"], ["avaliar", "aprovar"])).toEqual(["teste"]);
    expect(missingDocs("reverter", ["plano", "teste"], ["avaliar", "aprovar", "executar"])).toEqual(["evidencia-reversao"]);
    expect(missingDocs("encerrar", ["revisao-pos"], ["avaliar", "aprovar", "executar", "revisar"])).toEqual(["evidencia-execucao"]);
    expect(missingDocs("encerrar", ["revisao-pos"], ["avaliar", "aprovar", "executar", "reverter", "revisar"])).toEqual([]);
  });
  it("prontidão segue as transições do núcleo", () => {
    expect(changeReadiness(["avaliar", "aprovar", "executar"], ["plano", "teste"])).toEqual([
      { action: "reverter", missing: ["evidencia-reversao"] }, { action: "revisar", missing: [] }]);
  });
  it("reversão preserva a execução na trilha", () => {
    expect(changeOutcome(["avaliar", "aprovar", "executar", "reverter"])).toBe("revertida");
    expect(changeOutcome(["avaliar", "aprovar", "executar", "revisar", "encerrar"])).toBe("implantada-encerrada");
  });
  it("banco: gate por trigger, juntada real, coluna oculta, append-only", () => {
    expect(SQL).toMatch(/BEFORE INSERT ON public\.tech_change_events/);
    expect(SQL).toMatch(/event_type = 'documento_juntado'/);
    expect(SQL).not.toMatch(/GRANT SELECT \([^)]*case_event_ref/);
    expect(SQL).toMatch(/doc_numbering_append_only/);
  });
});
