import { describe, it, expect } from "vitest";
import { SECTORS, INTEGRATION_CONTRACTS, canOpWrite, guardPurpose, isolateSchool, auditEvent, parseCentralSearch, screenState, interventionProgress } from "./op-integration";

describe("OP Lote 21 — UX, segurança e integração", () => {
  it("contrato com os 8 setores; OP nunca escreve no dono canônico", () => {
    expect(SECTORS.every((s) => INTEGRATION_CONTRACTS[s].reads.length > 0)).toBe(true);
    expect(canOpWrite("docente", "plano").ok).toBe(false);
    expect(canOpWrite("nei", "PEI").ok).toBe(false);
    expect(canOpWrite("secretaria", "matrícula").ok).toBe(false);
    expect(canOpWrite("docente", "devolutiva").ok).toBe(true);
    expect(canOpWrite("ciece", "qualquer").ok).toBe(false);
  });
  it("orientação ≠ fiscalização administrativa", () => {
    expect(guardPurpose("Fiscalização do ponto do servidor")).toMatch(/Supervisão/);
    expect(guardPurpose("Acompanhamento do planejamento")).toBeNull();
    expect(INTEGRATION_CONTRACTS.supervisao.opWrites).toEqual([]);
  });
  it("isolamento entre escolas e alcance não lido", () => {
    expect(isolateSchool("s2", ["s1"]).ok).toBe(false);
    expect(isolateSchool(null, null).ok).toBe(false);
    expect(isolateSchool(null, ["s1"])).toEqual({ ok: true, schoolId: "s1" });
    expect(isolateSchool(null, ["s1", "s2"]).ok).toBe(false);
  });
  it("auditoria de leitura/exportação por allowlist, sem nome", () => {
    const r = auditEvent({ action: "exportacao", resource: "op-recuperacao", schoolId: "s1", purpose: "acompanhamento", accountId: "a", rowCount: 12, format: "pdf", studentName: "Ana" });
    expect(r.ok && JSON.stringify(r.event)).not.toMatch(/Ana/);
    expect(auditEvent({ action: "apagar", accountId: "a", schoolId: "s1", purpose: "x" }).ok).toBe(false);
    expect(auditEvent({ action: "leitura", accountId: "a", schoolId: "s1", purpose: "formacao", granularity: "individual" }).ok).toBe(false);
  });
  it("filtros da URL só declarados; busca livre recusada", () => {
    expect(parseCentralSearch({ escola: "s1", aba: "fichas", q: "Ana" })).toEqual({ filters: { escola: "s1", aba: "fichas" }, rejected: ["q"] });
  });
  it("estado de tela nunca fica em carregamento sem fim", () => {
    expect(screenState({ loading: false, error: null, denied: false, rows: null })).toBe("erro");
    expect(screenState({ loading: false, error: null, denied: true, rows: null })).toBe("negado");
    expect(screenState({ loading: false, error: null, denied: false, rows: [] })).toBe("vazio");
    expect(interventionProgress(["diagnostico", "proposta"]).filter((s) => s.done)).toHaveLength(2);
  });
});
