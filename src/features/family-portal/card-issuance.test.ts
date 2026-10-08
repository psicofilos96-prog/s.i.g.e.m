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
