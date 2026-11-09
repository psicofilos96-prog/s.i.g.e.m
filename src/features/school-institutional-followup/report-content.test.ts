import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { followupPdfSections, scopedPdfAttachments } from "./report-content";
import type { SchoolSnapshot } from "./model";
import type { FollowupAttachment } from "./source";
const snapshot: SchoolSnapshot = {
  visits: [{ id: "v2", logical_id: "l1", school_id: "s1", version: 2, supersedes_id: "v1", visit_date: "2026-11-09", diagnosis: "[align=justify] **Diagnóstico** com *ênfase*", strengths: "", weaknesses: "", summary: null, correction_reason: "Correção", author_name: "Equipe", created_at: "2026-11-09T12:00:00Z", can_correct: false },
    { id: "other", logical_id: "l2", school_id: "s1", version: 1, supersedes_id: null, visit_date: "2026-11-09", diagnosis: "Outra visita", strengths: "", weaknesses: "", summary: null, correction_reason: null, author_name: "Equipe", created_at: "2026-11-09T12:00:00Z", can_correct: false }],
  visit_history: [{ id: "v1", logical_id: "l1", school_id: "s1", version: 1, supersedes_id: null, visit_date: "2026-11-08", diagnosis: "Original", strengths: "", weaknesses: "", summary: null, correction_reason: null, author_name: "Equipe", created_at: "2026-11-08T12:00:00Z" }], actions: [], updates: [],
};
const attachment = (id: string, visit_id: string, visit_logical_id: string): FollowupAttachment => ({ id, visit_id, visit_logical_id, storage_path: `s1/${id}`, caption: null, content_type: "image/png", size_bytes: 100, author_name: "Equipe", created_at: "2026-11-09T12:00:00Z" });
describe("anexos e parágrafos do PDF de acompanhamento", () => {
  it("inclui fotos da visita e das versões anteriores, sem outras visitas", () => {
    const files = [attachment("a", "v2", "l1"), attachment("b", "v1", "l1"), attachment("c", "other", "l2")];
    expect(scopedPdfAttachments(snapshot, "s1", files, "v2").map((a) => a.id)).toEqual(["a", "b"]);
    expect(scopedPdfAttachments(snapshot, "s1", files).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });
  it("recusa caminho externo, versão desconhecida e anexo duplicado", () => {
    const a = attachment("a", "v2", "l1");
    expect(() => scopedPdfAttachments(snapshot, "s1", [{ ...a, storage_path: "s2/a" }])).toThrow();
    expect(() => scopedPdfAttachments(snapshot, "s1", [{ ...a, visit_id: "unknown" }])).toThrow();
    expect(() => scopedPdfAttachments(snapshot, "s1", [a, a])).toThrow();
  });
  it("leva o alinhamento e ênfase ao PDF sem os marcadores e sem outra visita", () => {
    const sections = followupPdfSections(snapshot, "s1", "v2");
    const paragraph = sections.flatMap((s) => s.paragraphs).find((p) => p.alignment === "justify");
    expect(paragraph?.runs).toEqual([{ text: "Diagnóstico", bold: true }, { text: " com " }, { text: "ênfase", italic: true }]);
    expect(JSON.stringify(sections)).not.toContain("Outra visita");
    expect(JSON.stringify(sections)).toContain("Original");
  });
});