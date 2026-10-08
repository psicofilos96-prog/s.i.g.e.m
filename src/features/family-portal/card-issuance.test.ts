import { describe, expect, it } from "vitest";
import { cardMessage, cardState, projectCardChain, validateCardDraft, verifyUrlFor, withIssuance, type CardChainRow } from "./card-issuance";

const row = (v: number, kind: CardChainRow["kind"], until = "2027-12-31", pid = "ABCDE12345"): CardChainRow =>
  ({ public_id: pid, version: v, kind, student_id: "s1", academic_year: "2027", valid_until: until, student_name: "Ana", class_label: "1º A", reason: v > 1 ? "x" : null, recorded_at: `2027-02-0${v}T12:00:00Z` });

describe("carteirinha emitida", () => {
  it("cancelamento na cabeça ⇒ cancelada, mesmo dentro da validade", () => {
    expect(projectCardChain([row(1, "emissao"), row(2, "cancelamento")], "2027-03-01")[0]!.state).toBe("cancelada");
  });
  it("validade vencida ⇒ expirada; último dia ainda é válida", () => {
    expect(cardState({ kind: "emissao", valid_until: "2027-12-31" }, "2028-01-01")).toBe("expirada");
    expect(cardState({ kind: "emissao", valid_until: "2027-12-31" }, "2027-12-31")).toBe("valida");
  });
  it("histórico preserva todas as versões em ordem e a cabeça é a maior", () => {
    const v = projectCardChain([row(2, "reemissao"), row(1, "emissao")], "2027-03-01")[0]!;
    expect(v.history.map((h) => h.version)).toEqual([1, 2]);
    expect(v.head.version).toBe(2);
  });
  it("QR só com origem https e código da versão emitida", () => {
    expect(verifyUrlFor("http://x", "ABCDE12345", 1)).toBeNull();
    expect(verifyUrlFor("https://x.app/", "ABCDE12345", 2)).toBe("https://x.app/verificar/carteirinha/ABCDE12345.2");
  });
  it("sem emissão, a projeção da família não ganha código nem QR", () => {
    const base = { name: "Ana", school: null, className: null, shift: null, code: null, year: null, photoUrl: null, verifyUrl: null, status: "vigente" as const };
    expect(withIssuance(base, null, "https://x.app")).toEqual(base);
    const c = withIssuance(base, { public_id: "ABCDE12345", version: 3, status: "valida", academic_year: "2027", valid_until: "2027-12-31", student_name: "Ana", school_name: "E", class_label: null }, "https://x.app");
    expect(c.code).toBe("ABCDE12345.3");
  });
  it("reemissão e cancelamento exigem motivo; emissão exige validade ≥ início do ano", () => {
    expect(validateCardDraft({ kind: "cancelamento", reason: " ", validUntil: "", year: "" })).not.toBeNull();
    expect(validateCardDraft({ kind: "emissao", reason: "", validUntil: "2026-12-31", year: "2027" })).not.toBeNull();
    expect(validateCardDraft({ kind: "emissao", reason: "", validUntil: "2027-12-31", year: "2027" })).toBeNull();
  });
  it("permissão ausente é explicada como não atribuída", () => {
    expect(cardMessage("card:capability-missing")).toMatch(/não foi atribuída/);
  });
});

import { issuedValidity } from "./card-issuance";
describe("N9.2.4 — validade impressa", () => {
  it("vem do status da emissão, nunca da matrícula", () => {
    expect(issuedValidity({ status: "valida", valid_until: "2027-12-31" })).toBe("Válida até 31/12/2027");
    expect(issuedValidity({ status: "expirada", valid_until: "2026-12-31" })).toBe("Expirada em 31/12/2026");
  });
  it("família A não recebe código/QR de outra emissão: sem emissão própria, nada sobreposto", () => {
    const a = { name: "A", school: null, className: null, shift: null, code: null, year: null, photoUrl: null, verifyUrl: null, status: "vigente" as const };
    const r = withIssuance(a, null, "https://x.app");
    expect(r.code).toBeNull(); expect(r.verifyUrl).toBeNull(); expect(r.validity).toBeUndefined();
    expect(withIssuance(a, { public_id: "B", version: 1, status: "valida", academic_year: "2027", valid_until: "2027-12-31", student_name: "B", school_name: "E", class_label: null }, "http://inseguro").verifyUrl).toBeNull();
  });
});
