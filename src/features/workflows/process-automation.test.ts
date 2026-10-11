import { describe, expect, it } from "vitest";
import { addBusinessDays, allowEmit, dedupeOutbox, escalationDue, queueInScope, retryDecision, slaIndicators } from "./process-automation";

const cal = ["2026-10-13", "2026-10-14", "2026-10-16", "2026-10-19"]; // 15 sem aula
describe("central de processos", () => {
  it("prazo útil pula dia não útil; sem calendário é null", () => {
    expect(addBusinessDays("2026-10-12", 3, cal)).toBe("2026-10-16");
    expect(addBusinessDays("2026-10-12", 9, cal)).toBeNull();
    expect(addBusinessDays("2026-10-12", 1, null)).toBeNull();
  });
  it("escalonamento só por regra declarada", () => {
    expect(escalationDue("2026-10-12", "2026-10-16", [{ afterBusinessDays: 2, toQueue: "direcao" }, { afterBusinessDays: 4, toQueue: "rede" }], cal).queues).toEqual(["direcao"]);
    expect(escalationDue("2026-10-12", "2026-10-16", [], null).state).toBe("nao-verificavel");
  });
  it("anti-loop e outbox idempotente", () => {
    expect(allowEmit(["diario", "direcao"], "diario")).toBe(false);
    expect(allowEmit(["diario"], "familia")).toBe(true);
    expect(dedupeOutbox([{ idempotencyKey: "a" }, { idempotencyKey: "a" }])).toHaveLength(1);
  });
  it("retry só transitório", () => {
    expect(retryDecision(503, 0)).toBe("retry");
    expect(retryDecision(503, 4)).toBe("dead-letter");
    expect(retryDecision(400, 0)).toBe("final");
  });
  it("setor fora do escopo não é acionado", () => {
    expect(queueInScope(["A"], "B")).toBe(false);
    expect(queueInScope(["A"], null)).toBe(false);
  });
  it("SLA: sem prazo fora do denominador", () => {
    expect(slaIndicators([{ dueOn: null, closedOn: null }, { dueOn: "2026-10-10", closedOn: "2026-10-09" }, { dueOn: "2026-10-10", closedOn: null }], "2026-10-11"))
      .toEqual({ semPrazo: 1, comPrazo: 2, noPrazo: 1, foraDoPrazo: 0, abertosAtrasados: 1, taxaNoPrazo: 100 });
  });
});
