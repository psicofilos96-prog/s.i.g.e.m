import { describe, it, expect } from "vitest";
import { addVersion, canRead, retentionAction, compute, supervisionReport, chartSeries } from "./supervision-records";

const h = "a".repeat(64);
const v = { docId: "d1", schoolId: "E1", kind: "parecer" as const, classification: "restrito" as const, authorId: "p", isHuman: true, reason: null, storagePath: "supervisao/E1/d1/v1.pdf", sha256: h, at: "2026-03-01" };

describe("acervo", () => {
  it("versiona com motivo, identidade imutável e acesso por classificação", () => {
    const c = addVersion([], v, 0); if (!c.ok) throw new Error(c.code);
    expect(addVersion(c.value, v, 1)).toEqual({ ok: false, code: "motivo-obrigatorio" });
    expect(addVersion(c.value, { ...v, reason: "x", kind: "ata" }, 1)).toEqual({ ok: false, code: "identidade-imutavel" });
    expect(addVersion([], { ...v, storagePath: "publico/x" }, 0)).toEqual({ ok: false, code: "fora-do-caminho-privado" });
    expect(canRead(c.value[0]!, "registrar")).toBe(false);
    expect(canRead(c.value[0]!, "conferir")).toBe(true);
  });
  it("sem decisão de retenção sempre retém", () => {
    expect(retentionAction({ ...v, version: 1 }, [], "2050-01-01").action).toBe("reter");
    expect(retentionAction({ ...v, version: 1 }, [{ kind: "parecer", years: 5, destination: "eliminar", approvedRef: "ato 1" }], "2031-03-01").action).toBe("eliminar");
  });
});

describe("indicadores e relatórios", () => {
  it("não informado ≠ zero, denominador zero sem valor", () => {
    expect(compute("cobertura", null, 10, "2026-01-01", "2026-06-30")!.state).toBe("nao-informado");
    expect(compute("cobertura", 0, 0, "a", "b")!.state).toBe("denominador-zero");
    expect(compute("cobertura", 0, 10, "a", "b")!.value).toBe(0);
    const rows = [
      { schoolId: "E1", supervisorId: "s", visits: 2, openPending: null, recurrences: 0, regularized: 1, functioningAttention: 0, drill: "/x" },
      { schoolId: "E2", supervisorId: "s", visits: 9, openPending: 1, recurrences: 0, regularized: 1, functioningAttention: 0, drill: "/y" },
    ];
    const r = supervisionReport(rows, ["E1"], {});
    expect(r.totals.visits).toBe(2);
    expect(r.totals.openPending).toBeNull();
    expect(r.rows[0]!.cells[1]).toBe("não informado");
    expect(chartSeries(rows, "openPending").excludedMissing).toBe(1);
  });
});
