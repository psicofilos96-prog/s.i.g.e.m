import { describe, expect, it } from "vitest";
import { appendProtocolEvent, convertPreEnrollment, currentHolder, isOverdue, openProtocol, preEnrollmentOrder, protocolDue, type ProtocolType } from "./service-desk";

const T: ProtocolType = { id: "declaracao", label: "Declaração", homologated: true, deadlineBusinessDays: 2 };
const open = (type: ProtocolType | undefined = T, requester: string | null = "hmac:ab") =>
  openProtocol({ id: "p1", schoolId: "A", type, requester, studentId: null, at: "2026-03-02T10:00:00Z", actorPrincipalId: "sint-1" });

describe("central de atendimento", () => {
  it("recusa tipo não homologado e CPF em texto", () => {
    expect(open({ ...T, homologated: false })).toEqual({ ok: false, code: "protocol:type-not-homologated" });
    expect(open(T, "123.456.789-09")).toEqual({ ok: false, code: "protocol:plain-cpf" });
  });
  it("escola B não age sobre protocolo da A até ser encaminhado", () => {
    const p = (open() as any).value;
    expect(appendProtocolEvent(p, { kind: "respondido", at: "x", actorPrincipalId: "b", schoolId: "B" }, 1)).toEqual({ ok: false, code: "protocol:not-in-scope" });
    const f = appendProtocolEvent(p, { kind: "encaminhado", at: "x", actorPrincipalId: "a", schoolId: "A", targetSchoolId: "B" }, 1);
    expect(f.ok && currentHolder(f.value)).toBe("B");
  });
  it("base desatualizada, cancelamento sem motivo e transição após conclusão são recusados", () => {
    const p = (open() as any).value;
    expect(appendProtocolEvent(p, { kind: "concluido", at: "x", actorPrincipalId: "a", schoolId: "A" }, 0)).toEqual({ ok: false, code: "protocol:stale-base" });
    expect(appendProtocolEvent(p, { kind: "cancelado", at: "x", actorPrincipalId: "a", schoolId: "A" }, 1)).toEqual({ ok: false, code: "protocol:reason-required" });
    const c = appendProtocolEvent(p, { kind: "concluido", at: "x", actorPrincipalId: "a", schoolId: "A" }, 1);
    expect(c.ok && appendProtocolEvent(c.value, { kind: "respondido", at: "y", actorPrincipalId: "a", schoolId: "A" }, 2)).toEqual({ ok: false, code: "protocol:transition-invalid" });
  });
  it("prazo só com calendário lido; sem calendário = não apurado", () => {
    const p = (open() as any).value;
    expect(protocolDue(p, T, null)).toBeNull();
    const due = protocolDue(p, T, ["2026-03-02", "2026-03-03", "2026-03-05"]);
    expect(due).toBe("2026-03-05");
    expect(isOverdue(p, due, "2026-03-06")).toBe(true);
    expect(isOverdue(p, null, "2026-03-06")).toBeNull();
  });
});

describe("pré-matrícula", () => {
  const pre = { id: "pm", schoolId: "A", protocolId: "p1", desiredOfferRef: null, status: "solicitada" as const, draftId: null };
  it("converte só para rascunho da matrícula guiada", () => {
    expect(convertPreEnrollment(pre, null)).toEqual({ ok: false, code: "pre:draft-required" });
    expect(convertPreEnrollment(pre, "d1")).toMatchObject({ ok: true, value: { status: "convertida", draftId: "d1" } });
  });
  it("sem critério homologado não há ordem de fila", () => {
    expect(preEnrollmentOrder([pre], false)).toBeNull();
  });
});
