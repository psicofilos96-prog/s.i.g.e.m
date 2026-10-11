import { describe, it, expect } from "vitest";
import { contractProblems, balances, familyFarmingStatement, type Contract } from "./contracts-ledger";

const c: Contract = { id: "c1", supplierId: "f1", homologated: true, processRef: "PE 12/2026", validFrom: "2026-01-01", validTo: "2026-12-31",
  items: [{ itemId: "arroz", unitPrice: 5, contractedQty: 100, familyFarming: false }, { itemId: "alface", unitPrice: 2, contractedQty: 100, familyFarming: true }],
  supplierDocs: [{ kind: "cnd", validTo: "2026-02-01" }] };

describe("contratos da alimentação", () => {
  it("sem processo, fora de vigência ou documento vencido/não configurado é apontado", () => {
    expect(contractProblems({ ...c, processRef: null }, "2027-01-02", null)).toEqual([
      "processo formal de aquisição não referenciado", "contrato fora de vigência na data", "documentos exigidos do fornecedor não configurados"]);
    expect(contractProblems(c, "2026-03-01", ["cnd", "alvara"])).toEqual(["documento cnd vencido em 2026-02-01", "documento alvara ausente"]);
  });
  it("solicitado, contratado, entregue e aceito ficam separados; saldo consome só o aceito", () => {
    const b = balances(c, { arroz: { requested: 120, delivered: 50, accepted: 40 } });
    expect(b[0]).toMatchObject({ requested: 120, contracted: 100, delivered: 50, accepted: 40, pendingAcceptance: 10, balance: 60, acceptedValue: 200 });
    expect(b[0]!.occurrences).toContain("solicitado acima do contratado");
    expect(b[1]!.balance).toBeNull();
  });
  it("agricultura familiar só com parâmetro homologado; lacuna deixa incompleto", () => {
    const flows = { c1: { arroz: { requested: null, delivered: 40, accepted: 40 }, alface: { requested: null, delivered: 50, accepted: 50 } } };
    expect(familyFarmingStatement([c], flows, null).state).toBe("BLOCKED_BY_HOMOLOGATED_RULE");
    const p = { key: "af", percent: 45, legalRef: "parâmetro informado", version: "1", homologated: true };
    const r = familyFarmingStatement([c], flows, p);
    expect([r.state, r.share]).toEqual(["nao-atende", 33.33]);
    expect(familyFarmingStatement([c], { c1: { arroz: flows.c1.arroz } }, p).state).toBe("incompleto");
  });
});
