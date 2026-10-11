import { describe, expect, it } from "vitest";
import { canReplace, currentByType, deriveAlerts } from "./server-portal";
import type { DocRow } from "./documents-model";

const row = (o: Partial<DocRow>): DocRow => ({ document_id: "d", version: 1, version_id: "v", person_id: "p", masked_name: null, type: "antecedente_criminal", season: "2026",
  school_id: null, path: "p/d/f", sha256: "0".repeat(64), mime: "application/pdf", size: 10, issuer: null, issued_on: null, valid_until: null,
  submitted_at: "2026-10-01T00:00:00Z", submitted_by_me: true, seq: 1, last_event: "enviado", status: "pendente_validacao", note: null, ...o });

describe("portal do servidor", () => {
  const T = ["antecedente_criminal", "antecedente_civil"];
  it("rejeição traz a mensagem do revisor", () => {
    const a = deriveAlerts([row({ status: "rejeitado", note: "ilegível" })], "2026-10-11", "2026", T);
    expect(a.find((x) => x.tone === "danger")?.text).toContain("ilegível");
  });
  it("aviso de vencimento em até 30 dias; vencido é perigo", () => {
    expect(deriveAlerts([row({ valid_until: "2026-10-20" })], "2026-10-11", "2026", T).some((x) => x.tone === "warning")).toBe(true);
    expect(deriveAlerts([row({ valid_until: "2026-12-31" })], "2026-10-11", "2026", T).some((x) => x.tone === "warning")).toBe(false);
    expect(deriveAlerts([row({ status: "vencido", valid_until: "2026-01-01" })], "2026-10-11", "2026", T)[0]?.tone).toBe("danger");
  });
  it("tipo sem envio na temporada vira aviso informativo, não exigência", () => {
    const a = deriveAlerts([row({})], "2026-10-11", "2026", T);
    expect(a).toHaveLength(1); expect(a[0]?.tone).toBe("info"); expect(a[0]?.text).toContain("cíveis");
  });
  it("atual por tipo ignora outra temporada e excluídos", () => {
    const m = currentByType([row({ season: "2025" }), row({ document_id: "x", status: "excluido" })], "2026");
    expect(m.size).toBe(0);
  });
  it("só substitui o que não está válido", () => {
    expect(canReplace(row({ status: "rejeitado" }))).toBe(true); expect(canReplace(row({ status: "valido" }))).toBe(false);
  });
});
