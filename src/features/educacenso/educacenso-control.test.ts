import { describe, expect, it } from "vitest";
import { collectionNext, educacensoMessage, layoutStatusText, schoolNext, summarize, type SchoolRow } from "./educacenso-control";

describe("Educacenso — controle anual", () => {
  it("nunca afirma homologação do leiaute", () => {
    for (const d of ["documentacao-pendente", "documentacao-inep-registrada", null] as const) expect(layoutStatusText(d)).not.toMatch(/^homologad/i);
    expect(layoutStatusText("documentacao-inep-registrada")).toMatch(/sem homologação/);
  });
  it("envio ao INEP só depois da conferência; devolução só pela rede", () => {
    expect(schoolNext(null, true)).not.toContain("declarada-enviada-ao-inep");
    expect(schoolNext("conferida-pela-escola", false)).toContain("declarada-enviada-ao-inep");
    expect(schoolNext("conferida-pela-escola", false)).not.toContain("devolvida-pela-rede");
    expect(schoolNext("conferida-pela-escola", true)).toContain("devolvida-pela-rede");
    expect(schoolNext("declarada-enviada-ao-inep", true)).toEqual(["em-retificacao"]);
  });
  it("coleta: configurar → abrir → encerrar → reabrir", () => {
    expect(collectionNext(null)).toEqual(["configurar"]);
    expect(collectionNext("configurar")).toContain("abrir");
    expect(collectionNext("abrir")).toEqual(["encerrar"]);
    expect(collectionNext("encerrar")).toEqual(["reabrir"]);
  });
  it("escola sem evento é não iniciada, e recibo é contado à parte", () => {
    const rows: SchoolRow[] = [
      { school_id: "a", inep: "1", head: null, receipt: { version: 1, issued_at: "", closed_at: null }, enrollments_without_start: 3 },
      { school_id: "b", inep: null, head: { seq: 1, state: "conferida-pela-escola", protocol_ref: null, reason: "x", actor_scope: "escola", recorded_at: "" }, receipt: null, enrollments_without_start: 0 },
    ];
    const s = summarize(rows);
    expect(s.byState["nao-iniciada"]).toBe(1);
    expect(s.byState["conferida-pela-escola"]).toBe(1);
    expect(s.withReceipt).toBe(1); expect(s.withoutInep).toBe(1); expect(s.withStartGaps).toBe(1);
  });
  it("mensagem amigável para recusa do banco", () => {
    expect(educacensoMessage("educacenso:protocol-and-conference-required")).toMatch(/recibo/);
  });
});
