import { describe, expect, it } from "vitest";
import { accessDecision, applicableRequirements, familyView, recordDocEvent, regularizationAlert, type Checklist } from "./document-checklist";

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; code: string }): T => { if (!r.ok) throw new Error(r.code); return r.value; };

const c: Checklist = { id: "c", processKind: "matricula-inicial", version: 1, homologated: true, requirements: [
  { id: "cert", label: "Certidão", legalBasis: null, basisVerifiedOn: null, validFrom: "2026-01-01", validTo: null, blocksAccess: true },
  { id: "vac", label: "Vacinação", legalBasis: "Lei X art. Y", basisVerifiedOn: "2026-02-01", validFrom: "2026-01-01", validTo: null, blocksAccess: true },
  { id: "old", label: "Antigo", legalBasis: null, basisVerifiedOn: null, validFrom: "2020-01-01", validTo: "2025-12-31", blocksAccess: false },
] };

describe("conferência documental", () => {
  it("checklist não homologado não exige nada; vigência filtra", () => {
    expect(applicableRequirements({ ...c, homologated: false }, "2026-03-01")).toBeNull();
    expect(applicableRequirements(c, "2026-03-01")!.map((r) => r.id)).toEqual(["cert", "vac"]);
  });
  it("documento ausente sem base legal verificada nunca bloqueia; abre regularização", () => {
    const reqs = applicableRequirements(c, "2026-03-01")!.filter((r) => r.id === "cert");
    expect(accessDecision(reqs, [], "2026-03-01")).toMatchObject({ blocked: false, regularization: ["cert"] });
    expect(accessDecision(null, [], "2026-03-01")).toMatchObject({ blocked: false });
  });
  it("bloqueio só com base legal registrada e verificada", () => {
    expect(accessDecision(applicableRequirements(c, "2026-03-01"), [], "2026-03-01")).toMatchObject({ blocked: true, blockingBasis: ["Lei X art. Y"] });
    expect(accessDecision(applicableRequirements(c, "2026-03-01"), [], "2026-01-15")).toMatchObject({ blocked: false });
  });
  it("anexo fora da escola, autovalidação e devolução sem motivo são recusados", () => {
    expect(recordDocEvent([], { requirementId: "cert", status: "recebido", at: "t", actorPrincipalId: "a", attachmentPath: "B/x.pdf" }, "A")).toMatchObject({ code: "doc:attachment-out-of-scope" });
    const r = unwrap(recordDocEvent([], { requirementId: "cert", status: "recebido", at: "t", actorPrincipalId: "a", attachmentPath: "A/x.pdf" }, "A"));
    const e = unwrap(recordDocEvent(r, { requirementId: "cert", status: "em-conferencia", at: "t", actorPrincipalId: "b" }, "A"));
    expect(recordDocEvent(e, { requirementId: "cert", status: "validado", at: "t", actorPrincipalId: "a" }, "A")).toMatchObject({ code: "doc:self-validation" });
    expect(recordDocEvent(e, { requirementId: "cert", status: "pendente", at: "t", actorPrincipalId: "b" }, "A")).toMatchObject({ code: "doc:reason-required" });
    expect(recordDocEvent(e, { requirementId: "cert", status: "validado", at: "t", actorPrincipalId: "b" }, "A")).toMatchObject({ ok: true });
  });
  it("alerta só com prazo; família não vê anexo", () => {
    expect(regularizationAlert("2026-03-01", null, "2026-04-01")).toBeNull();
    expect(regularizationAlert("2026-03-01", 30, "2026-04-01")).toBe("vencido");
    expect(Object.keys(familyView(applicableRequirements(c, "2026-03-01"), [])[0]!)).toEqual(["label", "status"]);
  });
});
