import { describe, it, expect } from "vitest";
import { categoriesFor, checkUse, validateSupportDescription, SUGGESTED_DOMAINS, type CategoryConfig } from "./mediator-support-categories";

const c = (o: Partial<CategoryConfig>): CategoryConfig => ({ id: "loc", version: 1, status: "homologada", validFrom: "2026-01-01", validTo: null, domain: "locomocao",
  label: "Apoio na locomoção", functions: ["profissional-apoio"], protocolRef: null, requiresProtocol: false, homologatedBy: "h1", authorPersonId: "a1", ...o });

describe("Mediador L09 — categorias de apoio", () => {
  it("sete domínios sugeridos são só sugestão: sem configuração nada é disponível", () => {
    expect(SUGGESTED_DOMAINS).toHaveLength(7);
    expect(categoriesFor([], "profissional-apoio", "2026-03-01").ok).toBe(false);
    expect(categoriesFor(null, "profissional-apoio", "2026-03-01").ok).toBe(false);
  });
  it("categoria só para a função liberada; outra função não herda", () => {
    expect(categoriesFor([c({})], "profissional-apoio", "2026-03-01").ok).toBe(true);
    expect(categoriesFor([c({})], "mediador-escolar", "2026-03-01").ok).toBe(false);
    expect(categoriesFor([c({})], null, "2026-03-01").ok).toBe(false);
  });
  it("rascunho, auto-homologação, fora de vigência e protocolo ausente não valem", () => {
    for (const o of [{ status: "rascunho" as const }, { homologatedBy: "a1" }, { validFrom: "2026-04-01" }, { requiresProtocol: true }])
      expect(categoriesFor([c(o)], "profissional-apoio", "2026-03-01").ok).toBe(false);
    expect(categoriesFor([c({ requiresProtocol: true, protocolRef: "PROT-12" })], "profissional-apoio", "2026-03-01").ok).toBe(true);
    expect(categoriesFor([c({}), c({ version: 2, status: "retirada" })], "profissional-apoio", "2026-03-01").ok).toBe(false);
  });
  it("prescrição e clínico bloqueiam; íntimo bloqueia fora de higiene e só aconselha em higiene", () => {
    expect(validateSupportDescription("Administrou o remédio 5 ml", "alimentacao").block.length).toBeGreaterThan(0);
    expect(validateSupportDescription("conforme laudo", "comunicacao").block.length).toBe(1);
    expect(validateSupportDescription("Auxiliou após urina", "locomocao").block.length).toBe(1);
    const h = validateSupportDescription("Auxiliou após urina", "higiene-autocuidado");
    expect(h.block).toEqual([]); expect(h.advise.length).toBe(1);
  });
  it("uso exige versão vigente e descrição válida; devolve referência versionada", () => {
    const ok = checkUse({ cfg: [c({})], functionId: "profissional-apoio", date: "2026-03-01", categoryId: "loc", categoryVersion: 1, text: "Conduziu até o refeitório" });
    expect(ok.ok && ok.ref).toEqual({ categoryId: "loc", version: 1, protocolRef: null });
    expect(checkUse({ cfg: [c({ version: 2 })], functionId: "profissional-apoio", date: "2026-03-01", categoryId: "loc", categoryVersion: 1, text: "" }).ok).toBe(false);
  });
});
