import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { explainProtocolError, protocolState, receiptText } from "./protocol-registry";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes("doc06_single_protocol"))}`, "utf8");

describe("L06 protocolo único", () => {
  it("estado é projeção de eventos e nunca vira deferido", () => {
    const s = protocolState([
      { seq: 1, eventType: "registrado", toUnitId: null },
      { seq: 2, eventType: "encaminhado", toUnitId: "SEMED" },
    ]);
    expect(s).toEqual({ status: "em-transito", unit: "SEMED", lastSeq: 2 });
    expect(sql).not.toMatch(/'deferido'|'indeferido'/);
  });
  it("comprovante declara que protocolo não é deferimento", () => {
    expect(receiptText({ protocolNumber: "PROT-2026-000001", channel: "presencial", subject: "x", receiptHash: "a".repeat(64), registeredAt: "2026-10-12" }))
      .toMatch(/não é deferimento/);
  });
  it("numeração única por ano com lock, idempotência e seq esperado", () => {
    expect(sql).toMatch(/UNIQUE \(year, seq\)/);
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    expect(sql).toMatch(/idempotency_key text NOT NULL UNIQUE/);
    expect(sql).toMatch(/protocol:stale-base/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
  it("traduz recusa", () => { expect(explainProtocolError("protocol:forbidden")).toMatch(/capacidade/); });
});
