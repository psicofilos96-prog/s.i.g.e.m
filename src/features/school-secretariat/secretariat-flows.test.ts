// SIGEM 2.0 — Lote 4/4: fluxos integrados da Secretaria sobre os núcleos puros (identidades sintéticas, nada persiste).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { enrollmentStart, multiSchool } from "@/features/data-quality/fundamentals-integrity";
import { accessArchive, corridorView, recordKitDelivery } from "./admin-operations";
import { documentReadiness } from "./document-readiness";
import { appendEntry, closeBook, currentView, rectify, verifyClosing, type Book } from "./registry-books";
import { appendProtocolEvent, openProtocol, protocolState } from "./service-desk";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const SINT = "sint-secretaria-lote4";

describe("fluxos integrados da Secretaria", () => {
  it("atendimento → documento → entrega", () => {
    const p = openProtocol({ id: "p", schoolId: "A", type: { id: "declaracao", label: "Declaração", homologated: true, deadlineBusinessDays: null }, requester: "hmac:x", studentId: "E1", at: "2026-03-02T10:00:00Z", actorPrincipalId: SINT });
    expect(p.ok).toBe(true);
    const ready = documentReadiness("declaracao-de-matricula", { composable: ["declaracao-de-matricula"], matrices: 0, collegialMinutes: 0, closings: 0, enrollmentStartsDeclared: 1 });
    expect(ready).toMatchObject({ ready: true });
    const done = p.ok && appendProtocolEvent(p.value, { kind: "concluido", at: "2026-03-03", actorPrincipalId: SINT, schoolId: "A", note: "entregue" }, 1);
    expect(done && done.ok && protocolState(done.value)).toBe("concluido");
  });

  it("histórico sem fechamento nem ata não é emitido (nada presumido)", () => {
    expect(documentReadiness("historico", { composable: [], matrices: 0, collegialMinutes: 0, closings: 0, enrollmentStartsDeclared: 0 })).toMatchObject({ ready: false });
  });

  it("matrícula sem início declarado e multiescola sem datas ficam na central de qualidade, sem correção", () => {
    expect(enrollmentStart({ declaredStart: null, technicalCreatedAt: "2026-01-10" })).toMatchObject({ kind: "pendente" });
    expect(multiSchool([{ school: "A", year: "2026", opened: null, closed: null }, { school: "B", year: "2026", opened: null, closed: null }])).not.toBeNull();
  });

  it("frequência → busca ativa só sobre chamada oficial", () => {
    const [v] = corridorView([{ studentId: "E1", date: "2026-03-02", mark: "ausente", official: true }, { studentId: "E1", date: "2026-03-03", mark: "ausente", official: false }], []);
    expect(v).toMatchObject({ lessons: 1, absences: 1 });
  });

  it("livro → fechamento → retificação preserva integridade", () => {
    const b: Book = { id: "b", kind: "transferencias", schoolId: "A", year: 2026, requiredFields: ["estudante", "destino"], entries: [], closedAt: null, closedBy: null, closingHash: null };
    const fact = { ref: "t1", kind: "transferencias" as const, schoolId: "A", effectiveOn: "2026-05-02", fields: { estudante: "E1", destino: "B" } };
    const closed = closeBook((appendEntry(b, fact, SINT) as any).value, "2026-12-20", SINT, h);
    const r = closed.ok && rectify(closed.value, 1, { ...fact, fields: { estudante: "E1", destino: "C" } }, "destino corrigido por ofício", SINT);
    expect(r && r.ok && currentView(r.value)[0]!.fields['destino']).toBe("C");
    expect(r && r.ok && verifyClosing(r.value, h)).toBe(true);
  });

  it("entrega → recibo e anexo privado segregado por escola", () => {
    expect(recordKitDelivery([], { kitId: "k", studentId: "E1", receivedBy: { personId: "R", authorized: true }, at: "2026-02-10" }, 3)).toMatchObject({ ok: true, remaining: 2 });
    expect(accessArchive({ id: "i", schoolId: "A", taxonomy: "recibos", reviewState: "revisado", reviewer: "r", uploader: "u" }, { principalId: "x", schoolIds: ["B"] }, "t")).toMatchObject({ ok: false });
  });
});
