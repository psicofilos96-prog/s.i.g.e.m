import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CODE_PATTERN, changeNextAllowed, checkChangeEvent, currentNature, linkedTickets, problemState } from "./itsm-core";

const sql = readFileSync("drizzle/migrations/0477_tech02_itsm_core.sql", "utf8");
const base = { last: "avaliar" as const, action: "aprovar" as const, actor: "b", proposer: "a", priorActors: ["c"], risk: "medio" as const, act: null };

describe("Tecnologia L02 — núcleo ITSM", () => {
  it("chamado reutiliza a solicitação canônica, sem fila paralela", () => {
    expect(sql).toMatch(/public\.open_ops_request\('tecnologia'/);
    expect(sql).not.toMatch(/CREATE TABLE public\.(tech_tickets|helpdesk)/);
  });
  it("incidente, requisição, problema e mudança são distintos e com código único", () => {
    for (const t of ["tech_ticket_records", "tech_problems", "tech_changes"]) expect(sql).toContain(`CREATE TABLE public.${t}`);
    expect(sql).toMatch(/problem_code text NOT NULL UNIQUE/);
    expect(sql).toMatch(/change_code text NOT NULL UNIQUE/);
    expect(sql).toMatch(/tech_ticket_code_once/);
    expect(CODE_PATTERN.test("CHM-2026-000001")).toBe(true);
  });
  it("natureza vigente = último registro; reclassificar exige motivo", () => {
    expect(currentNature([{ seq: 1, ticket_code: "c", nature: "incidente", reason: null }, { seq: 2, ticket_code: "c", nature: "requisicao", reason: "motivo suficiente" }])).toBe("requisicao");
    expect(sql).toMatch(/CHECK \(seq = 1 OR reason IS NOT NULL\)/);
  });
  it("problema: estado do ledger, vínculo a chamados", () => {
    const ev = [{ seq: 1, action: "investigar" as const }, { seq: 2, action: "vincular-chamado" as const, request_id: "r1" }];
    expect(problemState(ev)).toBe("em-investigacao");
    expect(linkedTickets(ev)).toEqual(["r1"]);
    expect(sql).toMatch(/'chamado-fora-do-escopo'/);
  });
  it("mudança: transições fechadas, aprovador ≠ autor/participantes, ato em risco alto", () => {
    expect(changeNextAllowed(null)).toEqual(["avaliar"]);
    expect(checkChangeEvent(base)).toBeNull();
    expect(checkChangeEvent({ ...base, actor: "a" })).toBe("aprovador-igual-autor");
    expect(checkChangeEvent({ ...base, actor: "c" })).toBe("aprovador-igual-autor");
    expect(checkChangeEvent({ ...base, risk: "alto" })).toBe("sem-ato");
    expect(checkChangeEvent({ ...base, last: null })).toBe("transicao-invalida");
    for (const k of ["'aprovador-igual-autor'", "'sem-ato'", "'transicao-invalida'", "'aprovar-mudancas-de-tecnologia'"]) expect(sql).toContain(k);
  });
  it("append-only, seq esperado, idempotência, pessoa da sessão, RLS por escola/rede, sem anon", () => {
    expect(sql.match(/doc_numbering_append_only/g)?.length).toBe(5);
    expect(sql.match(/'versao-desatualizada'/g)?.length).toBe(3);
    expect(sql).toMatch(/has_network_capability\('gerir-tecnologia-da-rede'\)/);
    expect(sql).toMatch(/ops_can_read\('tecnologia'/);
    expect(sql).toMatch(/FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
