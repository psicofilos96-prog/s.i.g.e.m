import { describe, it, expect } from "vitest";
import { planVisit, transition, saveReport, recoverDraft, agenda, reportPrintable, attachmentPath, type Visit } from "./supervision-visits";
import { appendAssignment } from "./supervision-access";

const asg = (() => { const r = appendAssignment([], { kind: "atribuir", assignmentId: "a", supervisorPrincipalId: "sup", schoolId: "A", from: "2026-01-01", to: null, level: "conferir", byPrincipalId: "c", byRole: "coordenador", human: true, reason: null, at: "t" }, 0); return r.ok ? r.value : []; })();
const viewer = { principalId: "sup", role: "supervisor" as const, schoolEngagements: [], capabilityOk: true };
const by = { principalId: "sup", human: true, at: "t" };
const input = { id: "v1", schoolId: "A", kind: "ordinaria" as const, objective: "conferir matrículas", start: "2026-03-10T08:00", end: "2026-03-10T11:00", participants: ["diretora"], attachments: [attachmentPath("A", "v1", "foto.jpg")], returnOfVisitId: null, extraordinaryReason: null };
const ok = <T,>(r: { ok: true; value: T } | { ok: false; code: string }): T => { if (!r.ok) throw new Error(r.code); return r.value; };

describe("planejamento", () => {
  it("escopo, anexo privado, extraordinária e conflito de horário", () => {
    const v = ok(planVisit(input, by, asg, viewer, []));
    expect(planVisit({ ...input, schoolId: "B" }, by, asg, viewer, [])).toEqual({ ok: false, code: "no-scope-for-school" });
    expect(planVisit({ ...input, attachments: ["outro/x"] }, by, asg, viewer, [])).toEqual({ ok: false, code: "attachment-outside-private-path" });
    expect(planVisit({ ...input, id: "v2", kind: "extraordinaria", attachments: [] }, by, asg, viewer, [])).toEqual({ ok: false, code: "extraordinary-reason-required" });
    expect(planVisit({ ...input, id: "v2", attachments: [], start: "2026-03-10T09:00" }, by, asg, viewer, [v])).toEqual({ ok: false, code: "schedule-conflict" });
    expect(planVisit({ ...input, id: "v3", kind: "retorno", returnOfVisitId: "v1", attachments: [] }, by, asg, viewer, [v])).toEqual({ ok: false, code: "return-needs-concluded-visit" });
    expect(agenda([], "2026-01-01", "2026-12-31")).toEqual([]);
  });
});

describe("ciclo e relatório", () => {
  it("planejada→execução→revisão→concluída com revisor distinto e providência para não conforme", () => {
    let v: Visit = ok(planVisit(input, by, asg, viewer, []));
    v = ok(transition(v, "em-execucao", { ...by, reason: null }, 1));
    expect(transition(v, "relatorio-em-revisao", { ...by, reason: null }, 2)).toEqual({ ok: false, code: "report-required" });
    v = ok(saveReport(v, { authorPrincipalId: "sup", text: "ok", checklist: [{ key: "m", label: "Matrículas", answer: "nao-conforme", note: null }], provisions: [], at: "t", reason: null }, 0, true));
    expect(saveReport(v, { authorPrincipalId: "sup", text: "x", checklist: [], provisions: [], at: "t", reason: "" }, 1, true)).toEqual({ ok: false, code: "reason-required" });
    v = ok(transition(v, "relatorio-em-revisao", { ...by, reason: null }, 2));
    expect(transition(v, "concluida", { ...by, reason: null }, 3)).toEqual({ ok: false, code: "reviewer-must-differ" });
    expect(transition(v, "concluida", { principalId: "coord", human: true, at: "t", reason: null }, 3)).toEqual({ ok: false, code: "nonconformity-needs-provision" });
    v = ok(saveReport(v, { authorPrincipalId: "sup", text: "ok", checklist: [{ key: "m", label: "Matrículas", answer: "nao-conforme", note: null }], provisions: [{ id: "p", text: "regularizar", responsible: "secretaria", due: "2026-04-10" }], at: "t", reason: "providência" }, 1, true));
    v = ok(transition(v, "concluida", { principalId: "coord", human: true, at: "t", reason: null }, 3));
    const pdf = reportPrintable(v)!;
    expect(pdf.version).toBe(2);
    expect(pdf.draft).toBe(false);
    expect(pdf.trail.map((t) => t.state)).toEqual(["planejada", "em-execucao", "relatorio-em-revisao", "concluida"]);
  });
  it("cancelar exige motivo; rascunho de outra base avisa", () => {
    const v = ok(planVisit(input, by, asg, viewer, []));
    expect(transition(v, "cancelada", { ...by, reason: "" }, 1)).toEqual({ ok: false, code: "reason-required" });
    expect(recoverDraft({ visitId: "v1", baseVersion: 3, text: "x", savedAt: "t", ownerPrincipalId: "sup" }, v, "sup").warning).not.toBeNull();
    expect(recoverDraft({ visitId: "v1", baseVersion: 0, text: "x", savedAt: "t", ownerPrincipalId: "sup" }, v, "outro").draft).toBeNull();
  });
});
