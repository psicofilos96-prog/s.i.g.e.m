import { describe, it, expect } from "vitest";
import { guardAutomationOutput, prefillContext, recordReminders, meetingReminders, guidanceNotices, reportFromRecords, saveStateFrom, recoverDraft, filterRecords } from "./mediator-automation";

describe("Mediador L18 — automações e confiabilidade", () => {
  it("automação nunca diagnostica, avalia nem decide", () => {
    expect(guardAutomationOutput("lembrete-registro", "Registro do dia ainda não salvo.").ok).toBe(true);
    for (const t of ["Possível diagnóstico de TEA", "O estudante melhorou", "Recomenda-se troca de turma", "Aluno apto"]) expect(guardAutomationOutput("relatorio-de-registros", t).ok).toBe(false);
    expect(guardAutomationOutput("classificar-estudante", "x").ok).toBe(false);
  });
  it("contexto só com campos autorizados", () => {
    expect(prefillContext({ schoolName: "E1", className: "5A", cid: "F84", laudo: "x" })).toEqual({ schoolName: "E1", className: "5A" });
    expect(prefillContext(null)).toEqual({});
  });
  it("lembrete de registro só em dia letivo lido e sem registro salvo", () => {
    expect(recordReminders({ date: "2026-03-10", schoolDayOn: true, activeDesignations: ["L1", "L2"], savedFor: ["L1"] }).map((r) => r.designationId)).toEqual(["L2"]);
    expect(recordReminders({ date: "2026-03-10", schoolDayOn: null, activeDesignations: ["L1"], savedFor: [] })).toEqual([]);
    expect(recordReminders({ date: "2026-03-10", schoolDayOn: true, activeDesignations: ["L1"], savedFor: null })).toEqual([]);
  });
  it("lembrete de reunião só dentro da janela configurada", () => {
    const m = [{ id: "r1", date: "2026-03-12", title: "NEI", designationId: "L1" }, { id: "r2", date: "2026-04-01", title: "X", designationId: "L1" }];
    expect(meetingReminders(m, "2026-03-10", 3)).toHaveLength(1);
    expect(meetingReminders(m, "2026-03-10", null)).toEqual([]);
  });
  it("aviso de orientação só sem ciência, com chave idempotente", () => {
    const n = guidanceNotices([{ logicalId: "G", version: 1, studentId: "e1" }, { logicalId: "G", version: 2, studentId: "e1" }], new Set(["G:1"]));
    expect(n.map((x) => x.idempotencyKey)).toEqual(["orient:G:2"]);
  });
  it("relatório só conta; não lido nunca vira zero", () => {
    expect(reportFromRecords(null).ok).toBe(false);
    expect(reportFromRecords([{ block: "apoio" }, { block: "apoio" }])).toMatchObject({ ok: true, counts: { apoio: 2 } });
  });
  it("'Salvo' só com chave e versão confirmadas", () => {
    expect(saveStateFrom({ sent: true, response: { key: "k", version: 2 } }).status).toBe("salvo");
    expect(saveStateFrom({ sent: true, response: { key: "k" } }).status).toBe("erro");
    expect(saveStateFrom({ sent: true, response: { conflict: true } }).status).toBe("conflito");
    expect(saveStateFrom({ sent: true, response: null }).status).toBe("enviando");
  });
  it("rascunho só da mesma conta e designação, dentro da validade", () => {
    const raw = JSON.stringify({ accountId: "a", designationId: "L1", savedAt: 1000, body: { note: "x" } });
    expect(recoverDraft(raw, "a", "L1", 2000, 5000)).toEqual({ note: "x" });
    expect(recoverDraft(raw, "b", "L1", 2000, 5000)).toBeNull();
    expect(recoverDraft(raw, "a", "L1", 99999, 5000)).toBeNull();
    expect(recoverDraft("{quebrado", "a", "L1", 2000, 5000)).toBeNull();
  });
  it("filtros por estudante, bloco e período em ordem estável", () => {
    const rows = [{ id: "1", studentId: "e1", block: "apoio", date: "2026-03-01" }, { id: "2", studentId: "e1", block: "barreira", date: "2026-03-05" }, { id: "3", studentId: "e2", block: "apoio", date: "2026-03-05" }];
    expect(filterRecords(rows, { studentId: "e1" }).map((r) => r.id)).toEqual(["2", "1"]);
    expect(filterRecords(rows, { block: "apoio", from: "2026-03-02" }).map((r) => r.id)).toEqual(["3"]);
  });
});
