import { describe, expect, it } from "vitest";
import { labelBody, labelCells, labelsSheetHtml } from "./labels";

describe("Etiquetas da Cartilha", () => {
  it("estocável traz a validade do lote em dd/mm/aaaa", () => {
    expect(labelBody("estocavel", "E.M. Teste", { name: "Arroz", expiresOn: "2027-05-10" }, null)).toContain("10/05/2027");
  });
  it("sem validade conhecida fica em branco, nunca presumida", () => {
    expect(labelBody("estocavel", "E.M.", { name: "Arroz", expiresOn: null }, null)).toContain('class="blank"');
  });
  it("manipulado: uma etiqueta por produto × cópias", () => {
    expect(labelCells({ kind: "manipulado", school: "E", products: [{ name: "A", expiresOn: null }, { name: "B", expiresOn: null }], copies: 3, date: "2027-03-01" })).toHaveLength(6);
  });
  it("escapa texto do usuário", () => {
    expect(labelsSheetHtml({ kind: "refil", school: "<script>", products: [], copies: 1, date: null })).not.toContain("<script>");
  });
});
