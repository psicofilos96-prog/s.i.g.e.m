import { describe, it, expect } from "vitest";
import { addDocVersion, retention, MEAL_REPORTS, pnaeStatement, caeView, caeAct } from "./ged-reports-pnae";

const sha = "a".repeat(64);
const v1 = { docId: "d", cls: "cardapio" as const, sha256: sha, path: "alimentacao-evidencias/cardapios/d.pdf", authorId: "n", reason: null, schoolId: null };

describe("GED da alimentação", () => {
  it("versões com motivo, classe imutável e armazenamento privado", () => {
    const c = addDocVersion([], v1, 0) as ReturnType<typeof addDocVersion> & unknown[];
    expect(Array.isArray(c)).toBe(true);
    expect(addDocVersion(c as never, v1, 1)).toEqual({ error: "nova versão exige motivo" });
    expect(addDocVersion(c as never, { ...v1, cls: "contrato", reason: "x" }, 1)).toHaveProperty("error");
    expect(addDocVersion([], { ...v1, path: "public/x.pdf" }, 0)).toHaveProperty("error");
  });
  it("retenção sem regra aprovada retém", () => {
    expect(retention("cardapio", {}, "2020-01-01", "2030-01-01").action).toBe("reter");
    expect(retention("cardapio", { cardapio: { years: 5, approved: true } }, "2020-01-01", "2026-01-01").action).toBe("elegivel-para-descarte-com-decisao-humana");
  });
});

describe("relatórios, PNAE e CAE", () => {
  it("relatórios em PDF/XLSX pelo motor comum", () => {
    expect(MEAL_REPORTS.map((r) => r.id.replace("alimentacao-", ""))).toEqual(["planejamento", "lotes-validade", "distribuicao", "producao", "custos", "perdas"]);
    expect(MEAL_REPORTS.every((r) => r.formats.includes("pdf") && r.formats.includes("xlsx"))).toBe(true);
  });
  it("PNAE é apoio e nunca transmitido; sem contábil saldo é null", () => {
    const s = pnaeStatement({ transferred: { value: 100, source: "FNDE" }, booked: null, familyFarming: { state: "BLOCKED_BY_HOMOLOGATED_RULE", share: null }, schoolDays: null, servedMeals: null });
    expect([s.transmission, s.balance]).toEqual(["nao-transmitido", null]);
    expect(s.disclaimer).toContain("Não é prestação de contas oficial");
  });
  it("CAE só lê relatórios permitidos, sem dado pessoal, e não produz atos", () => {
    expect(caeView("alimentacao-producao", [])).toHaveProperty("error");
    const def = MEAL_REPORTS.find((r) => r.id === "alimentacao-custos");
    expect(caeView("alimentacao-custos", [{ item: "arroz", nome: "x", cost: 1 }], def)).toEqual({ rows: [{ item: "arroz", cost: 1 }], readOnly: true });
    expect(caeAct("parecer").error).toContain("não é produzido");
  });
});
