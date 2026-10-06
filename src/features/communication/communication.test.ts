import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allowedActions, availabilityLine, commMessage } from "./communication-model";

describe("AJ — comunicação escola ↔ família", () => {
  it("ações derivam do estado; cancelado é final", () => {
    expect(allowedActions("rascunho")).toEqual({ edit: true, publish: true, cancel: false });
    expect(allowedActions("publicado")).toEqual({ edit: true, publish: false, cancel: true });
    expect(allowedActions("retificacao-em-rascunho")).toEqual({ edit: true, publish: true, cancel: true });
    expect(allowedActions("cancelado")).toEqual({ edit: false, publish: false, cancel: false });
  });
  it("disponibilidade nunca afirma recebimento externo", () => {
    expect(availabilityLine(null, null, null, false)).toMatch(/Ainda não disponível/);
    const l = availabilityLine("2026-10-01T10:00:00Z", 3, 1, true);
    expect(l).toMatch(/Disponível no SIGEM/);
    expect(l).not.toMatch(/recebid|entregue/i);
  });
  it("capability negada não revela detalhe", () => {
    expect(commMessage("capability:publicar-comunicacao-escolar")).not.toMatch(/publicar-comunicacao/);
  });
  it("migrations não concedem DML à automação nem criam canal externo", () => {
    const sql = readFileSync("drizzle/migrations/0172_aj_school_family_communication.sql", "utf8").replace(/--.*$/gm, "");
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*service_role/i);
    expect(sql).not.toMatch(/whatsapp|sms|smtp|push_token/i);
    const fix = readFileSync("drizzle/migrations/0173_aj_ai_revoke_service_role_dml.sql", "utf8");
    expect(fix).toMatch(/school_communication_acts/);
    expect(fix).toMatch(/meal_menu_publications/);
  });
});
