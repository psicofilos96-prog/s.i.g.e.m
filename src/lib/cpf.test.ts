import { describe, expect, it } from "vitest";
import { cpfForStorage, cpfMessage, cpfStatus, formatCpf, isValidCpf, maskCpfForDisplay } from "./cpf";

describe("CPF central", () => {
  it("aceita CPFs válidos com e sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("aceita CPF com zeros à esquerda", () => {
    expect(isValidCpf("000.000.001-91")).toBe(true);
    expect(cpfForStorage("000.000.001-91")).toEqual({ ok: true, value: "00000000191" });
  });
  it("recusa dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(cpfStatus("52998224724")).toBe("invalido");
  });
  it("recusa sequências repetidas", () => {
    for (let n = 0; n <= 9; n++) expect(isValidCpf(String(n).repeat(11))).toBe(false);
  });
  it("incompleto não mostra erro durante a digitação", () => {
    expect(cpfStatus("5299822")).toBe("incompleto");
    expect(cpfMessage("5299822")).toBeNull();
    expect(cpfMessage("5299822", { touched: true })).toBe("O CPF tem 11 números.");
  });
  it("ausente só é erro quando o campo é obrigatório", () => {
    expect(cpfForStorage("")).toEqual({ ok: true, value: null });
    expect(cpfMessage("", { touched: true })).toBeNull();
    expect(cpfMessage("", { touched: true, required: true })).toBe("Informe o CPF.");
  });
  it("inválido não pode ser gravado", () => {
    expect(cpfForStorage("11111111111")).toEqual({ ok: false });
  });
  it("máscara 000.000.000-00 e exibição protegida", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("5299")).toBe("529.9");
    expect(maskCpfForDisplay("52998224725")).toBe("***.982.247-**");
  });
});
