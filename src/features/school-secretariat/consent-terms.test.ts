import { describe, expect, it } from "vitest";
import { CONSENT_TERMS, currentConsents, type ConsentRow } from "./consent-terms";

const r = (o: Partial<ConsentRow>): ConsentRow => ({ term_key: "uso-de-imagem", term_version: 1, sequence: 1, decision: "autoriza", guardian_name: "Maria Silva", declared_on: "2026-10-17", ...o });

describe("termos do cadastro", () => {
  it("sem manifestação o termo fica não manifestado, nunca aceito", () => {
    expect(currentConsents([]).get("uso-de-imagem")!.row).toBeNull();
  });
  it("vale a última manifestação (revogação depois de autorizar)", () => {
    const c = currentConsents([r({}), r({ sequence: 2, decision: "revogado" })]);
    expect(c.get("uso-de-imagem")!.row!.decision).toBe("revogado");
  });
  it("ciência de faltas só aceita 'ciente'", () => {
    expect(CONSENT_TERMS.find((t) => t.key === "ciencia-de-faltas")!.decisions).toEqual(["ciente"]);
  });
  it("imagem permite recusar", () => {
    expect(CONSENT_TERMS.find((t) => t.key === "uso-de-imagem")!.decisions).toContain("nao-autoriza");
  });
});
