import { describe, it, expect } from "vitest";
import { buildAgenda, notificationEvent, attachmentRequest, AGENDA_WRITES, type AgendaSource } from "./case-agenda";

const s = (o: Partial<AgendaSource>): AgendaSource => ({ kind: "contato", caseId: "c", sourceRef: "r", due: null, responsibleEngagement: "e1", done: false, protocolRef: null, sensitiveAttachment: false, ...o });
const act = new Set(["e1"]);

describe("L19 agenda do caso", () => {
  it("projeta só pendentes, prazo só declarado, ordem cronológica", () => {
    const a = buildAgenda([s({ sourceRef: "x" }), s({ sourceRef: "v", kind: "visita", due: "2026-10-01" }), s({ sourceRef: "p", due: "2026-10-20" }), s({ sourceRef: "d", done: true })], "2026-10-12", act);
    expect(a.map((i) => [i.sourceRef, i.state])).toEqual([["v", "vencido"], ["p", "a-vencer"], ["x", "sem-prazo"]]);
  });
  it("responsável não vigente vira órfão e não é notificado", () => {
    const [i] = buildAgenda([s({ due: "2026-10-01", responsibleEngagement: "old" })], "2026-10-12", act);
    expect(i.orphan).toBe(true); expect(notificationEvent(i, "2026-10-12")).toBeNull();
  });
  it("notificação idempotente e sem conteúdo do caso", () => {
    const [i] = buildAgenda([s({ due: "2026-10-01" })], "2026-10-12", act);
    const e = notificationEvent(i, "2026-10-12")!;
    expect(e.idempotency_key).toBe(notificationEvent(i, "2026-10-12")!.idempotency_key);
    expect(Object.keys(e.payload)).toEqual(["case_id", "kind", "source_ref"]);
  });
  it("anexo restrito só pelo leitor de Documentos com finalidade; agenda não escreve", () => {
    const [i] = buildAgenda([s({ sensitiveAttachment: true })], "2026-10-12", act);
    expect(attachmentRequest(i, "x")).toEqual({ error: "sem-finalidade" });
    expect(attachmentRequest(i, "Conferir comprovante de encaminhamento")!).toMatchObject({ rpc: "read_sensitive_case_document" });
    expect(AGENDA_WRITES).toEqual([]);
  });
});
