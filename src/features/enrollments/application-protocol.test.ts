import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseReceipt, PROTOCOL_IS_NOT_VACANCY } from "./application-protocol";

const sql = readFileSync("drizzle/migrations/0462_enr10_application_protocols.sql", "utf8");
const base = { status: "ok", submitted_on: "2026-10-12", campaign_kind: "regular", campaign_year: 2027 };

describe("L10 protocolo da inscrição", () => {
  it("comprovante traz data, campanha e situação; número só no formato canônico", () => {
    expect(parseReceipt({ ...base, protocol_number: "PROT-2026-000012", situation: "protocolado" })).toMatchObject({ protocolNumber: "PROT-2026-000012", campaignYear: 2027 });
    expect(parseReceipt({ ...base, protocol_number: null, situation: "aguardando-protocolo" })).toMatchObject({ situation: "aguardando-protocolo" });
    expect(parseReceipt({ ...base, protocol_number: "INS-123", situation: "protocolado" }).status).toBe("indisponivel");
    expect(parseReceipt({ status: "indisponivel" }).status).toBe("indisponivel");
  });
  it("protocolo não equivale a vaga", () => {
    expect(PROTOCOL_IS_NOT_VACANCY).toMatch(/não garante vaga/);
    expect(sql).not.toMatch(/enr_reservations|vacancy|INSERT INTO public\.enr_campaign/i);
  });
  it("banco: um protocolo por pedido, só pelo registro canônico, chave determinística, sem DML direta", () => {
    expect(sql).toContain("application_id uuid PRIMARY KEY");
    expect(sql).toContain("registration_id uuid NOT NULL UNIQUE");
    expect(sql).toContain("public.register_protocol('digital'");
    expect(sql).toContain("'enr-app-' || _a.id");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).not.toMatch(/'PROT-'/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_application_protocols/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.enr_protocol_application\(uuid\)[^;]*anon/);
  });
});
