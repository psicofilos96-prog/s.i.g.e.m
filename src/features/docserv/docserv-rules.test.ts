import { describe, expect, it } from "vitest";
import { effectiveRule, extractionRecord, parseIdentityCsv, requirementLabel, submissionWindow, suggestFromText, suggestedValidUntil, type PolicyState, type Season } from "./docserv-rules";

const legacy: PolicyState = { approved: null, latest: { version: 1, status: "rascunho", origin: "legado DocServ", reason: "x", rules: { antecedente_criminal: { obrigatorio: true, validade_meses: null, aviso_dias: 30, retencao_dias: null } } } };
const approved: PolicyState = { approved: { version: 2, status: "aprovada", origin: "rede", reason: "x", rules: { antecedente_criminal: { obrigatorio: true, validade_meses: 3, aviso_dias: 15, retencao_dias: 1825 } } }, latest: null };

describe("política", () => {
  it("regra legada em rascunho não obriga nada", () => {
    expect(effectiveRule(legacy, "antecedente_criminal")).toBeNull();
    expect(requirementLabel(legacy, "antecedente_criminal")).toBe("sem política aprovada");
  });
  it("política aprovada obriga e sugere validade", () => {
    expect(requirementLabel(approved, "antecedente_criminal")).toContain("obrigatório");
    expect(suggestedValidUntil(approved, "antecedente_criminal", "2026-01-15")).toBe("2026-04-15");
    expect(suggestedValidUntil(legacy, "antecedente_criminal", "2026-01-15")).toBeNull();
  });
});

describe("leitura assistida do PDF", () => {
  it("encontra emissão, validade e emissor", () => {
    const s = suggestFromText("TRIBUNAL DE JUSTIÇA DO ESTADO X. Certidão emitida em 02/10/2026. Válida até 31/12/2026.");
    expect(s.issued).toBe("2026-10-02"); expect(s.validUntil).toBe("2026-12-31"); expect(s.issuer).toMatch(/tribunal/i); expect(s.confidence).toBe("alta");
  });
  it("data por extenso", () => expect(suggestFromText("Data de emissão: 5 de março de 2026").issued).toBe("2026-03-05"));
  it("texto sem datas não sugere nada", () => expect(suggestFromText("documento").confidence).toBe("nenhuma"));
  it("registro guarda se a pessoa aceitou ou corrigiu", () => {
    const s = suggestFromText("emitida em 02/10/2026 válida até 31/12/2026");
    const r = extractionRecord(s, { issued: "2026-10-02", validUntil: "2026-11-30", issuer: null });
    expect(r?.aceito).toEqual({ emissao: true, validade: false, emissor: false });
  });
});

describe("temporadas", () => {
  const S: Season[] = [{ year: "2026", cycle: 1, seq: 1, opens_on: "2026-01-01", closes_on: "2026-04-30", status: "aberta", reason: "x" },
    { year: "2026", cycle: 2, seq: 1, opens_on: "2026-09-01", closes_on: "2026-12-31", status: "aberta", reason: "x" }];
  it("sem temporada cadastrada o envio é livre", () => expect(submissionWindow(S, "2027", "2027-02-01").allowed).toBe(true));
  it("com temporada, só ciclo aberto na data", () => {
    expect(submissionWindow(S, "2026", "2026-10-11").cycles).toEqual([2]);
    expect(submissionWindow(S, "2026", "2026-06-01").allowed).toBe(false);
  });
});

describe("importação em dry-run", () => {
  it("lê CSV com ; e valida identificadores", () => {
    const r = parseIdentityCsv("tipo;matricula;cpf;inep;senha\nservidor;123;111.222.333-44;;x\nescola;;;\nservidor;;12;;");
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]?.cpf).toBe("11122233344"); expect(r.rows[0]?.problem).toBeNull();
    expect(r.rows[1]?.problem).toBe("escola sem INEP"); expect(r.rows[2]?.problem).toBe("CPF com formato inválido");
    expect(r.ignoredColumns).toContain("senha");
  });
  it("limite de linhas é sinalizado", () => expect(parseIdentityCsv("matricula\n1\n2\n3", 2).truncated).toBe(true));
});
