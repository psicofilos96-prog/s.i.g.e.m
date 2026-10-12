import { describe, it, expect } from "vitest";
import { currentGuidance, validateSupport, submitAvailability, DRAFT_KEY, type InclusionRecordRow } from "./mediator-central";
import { recoverDraft } from "@/features/teacher-diary/teacher-ux-robustness";

const r = (o: Partial<InclusionRecordRow> & Pick<InclusionRecordRow, "id" | "logical_id">): InclusionRecordRow => ({
  version: 1, supersedes_id: null, event_kind: "registro", record_type: "orientacao", student_id: "e1", body: "Sentar próximo à porta",
  educational_purpose: "x", valid_from: "2026-02-01", valid_to: null, share_with_mediation: true, recorded_at: "t", ...o,
});

describe("Mediador L04 — Central de Acompanhamento", () => {
  it("orientação: só vigente, partilhada, cabeça da cadeia, e sem texto clínico", () => {
    const rows = [
      r({ id: "a1", logical_id: "A" }),
      r({ id: "a2", logical_id: "A", version: 2, supersedes_id: "a1", body: "Usar prancha de comunicação" }),
      r({ id: "b1", logical_id: "B", share_with_mediation: false }),
      r({ id: "c1", logical_id: "C", valid_to: "2026-02-28" }),
      r({ id: "d1", logical_id: "D", body: "Conforme laudo CID F84" }),
      r({ id: "e1", logical_id: "E", student_id: "e2" }),
    ];
    const g = currentGuidance(rows, "e1", "2026-03-10");
    expect(g.map((x) => x.id).sort()).toEqual(["A", "D"]);
    expect(g.find((x) => x.id === "A")?.text).toBe("Usar prancha de comunicação");
    expect(g.find((x) => x.id === "D")).toMatchObject({ text: null, withheld: true });
  });
  it("registro só com catálogo homologado e texto objetivo", () => {
    const d = { kind: "apoio" as const, categoryId: "loc", note: "Apoio na escada", context: "recreio", at: "t" };
    expect(validateSupport(d, null)[0]).toMatch(/não homologado/);
    expect(validateSupport(d, [{ id: "loc", version: 1, label: "Locomoção", kind: "apoio" }])).toEqual([]);
    expect(validateSupport({ ...d, kind: "barreira" }, [{ id: "loc", version: 1, label: "Locomoção", kind: "apoio" }]).length).toBe(1);
    expect(validateSupport({ ...d, note: "crise do transtorno" }, [{ id: "loc", version: 1, label: "L", kind: "apoio" }])[0]).toMatch(/clínico/);
  });
  it("sem writer canônico o envio nunca é simulado", () => {
    expect(submitAvailability(null, ["registro-diario"], "registro-diario").ok).toBe(false);
    expect(submitAvailability("w", [], "registro-diario").ok).toBe(false);
  });
  it("rascunho por conta+estudante e recuperação segura", () => {
    expect(DRAFT_KEY("u1", "e1")).not.toEqual(DRAFT_KEY("u2", "e1"));
    const raw = JSON.stringify({ accountId: "u1", contextKey: "e1", baseVersion: null, savedAt: "t", payload: { note: "x" } });
    expect(recoverDraft(raw, "u2", "e1", null).draft).toBeNull();
    expect(recoverDraft(raw, "u1", "e1", null).draft).not.toBeNull();
  });
});
