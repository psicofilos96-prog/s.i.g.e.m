import { describe, it, expect } from "vitest";
import { advance, checkEnrollment, batchPreview, reenrollmentPreview, confirmReenrollment, previewFingerprint } from "./enrollment-flow";

const base = { yearState: "operacional" as const, offerHomologated: true, positionDeclared: true, startDate: "2026-02-02", conflictingActive: [], coexistenceAllowed: null, missingDocuments: [], laterRegularizationAllowed: null };

describe("ciclo da matrícula", () => {
  it("exige autor humano, base esperada e motivo no cancelamento", () => {
    const a = advance([], { stage: "rascunho", at: "t", actorPrincipalId: "p", human: true, reason: null }, 0, { cancelEffectiveAllowed: false });
    expect(a.ok).toBe(true);
    const ev = a.ok ? a.value : [];
    expect(advance(ev, { stage: "efetivada", at: "t", actorPrincipalId: "p", human: true, reason: null }, 1, { cancelEffectiveAllowed: false })).toEqual({ ok: false, code: "invalid-transition" });
    expect(advance(ev, { stage: "cancelada", at: "t", actorPrincipalId: "p", human: true, reason: "" }, 1, { cancelEffectiveAllowed: false })).toEqual({ ok: false, code: "reason-required" });
    expect(advance(ev, { stage: "em-analise", at: "t", actorPrincipalId: "x", human: false, reason: null }, 1, { cancelEffectiveAllowed: false })).toEqual({ ok: false, code: "human-author-required" });
    expect(advance(ev, { stage: "em-analise", at: "t", actorPrincipalId: "p", human: true, reason: null }, 0, { cancelEffectiveAllowed: false })).toEqual({ ok: false, code: "stale-base" });
  });
});

describe("verificações", () => {
  it("falta documental vira pendência quando regularização posterior é permitida", () => {
    expect(checkEnrollment({ ...base, missingDocuments: ["certidão"], laterRegularizationAllowed: true })).toEqual({ blockers: [], pendencies: ["regularizar: certidão"] });
    expect(checkEnrollment({ ...base, missingDocuments: ["certidão"] }).blockers).toEqual(["norma de regularização documental não declarada"]);
  });
  it("sem data de início, ano encerrado ou vínculo incompatível bloqueia", () => {
    const r = checkEnrollment({ ...base, startDate: null, yearState: "encerrado", conflictingActive: [{ schoolId: "B", offerId: "o" }], coexistenceAllowed: false });
    expect(r.blockers).toEqual(["ano letivo encerrado", "data de início efetiva não declarada", "vínculo vigente incompatível"]);
  });
  it("lote não esconde recusados nem duplicados", () => {
    const ok = { blockers: [], pendencies: [] };
    expect(batchPreview([{ key: "a", check: ok }, { key: "a", check: ok }, { key: "b", check: { blockers: ["x"], pendencies: [] } }]).map((i) => i.status)).toEqual(["pronto", "duplicado", "recusado"]);
  });
});

describe("rematrícula", () => {
  const prior = [
    { enrollmentId: "e1", studentId: "s1", schoolId: "A", year: "2026", standing: "aprovado", endedReason: null },
    { enrollmentId: "e2", studentId: "s2", schoolId: "A", year: "2026", standing: null, endedReason: null },
    { enrollmentId: "e3", studentId: "s3", schoolId: "A", year: "2026", standing: "aprovado", endedReason: "transferido" },
  ];
  it("sem regra homologada tudo é exceção; com regra, prévia liga ao ano anterior", () => {
    expect(reenrollmentPreview(prior, "A", "2026", "2027", null, new Set()).every((r) => r.status === "excecao")).toBe(true);
    const p = reenrollmentPreview(prior, "A", "2026", "2027", [{ fromStanding: "aprovado", continues: true }], new Set());
    expect(p.map((r) => r.status)).toEqual(["proposta", "excecao", "excecao"]);
    expect(p[0]!.previousEnrollmentId).toBe("e1");
  });
  it("confirmação explícita, prévia igual e idempotente", () => {
    const p = reenrollmentPreview(prior, "A", "2026", "2027", [{ fromStanding: "aprovado", continues: true }], new Set());
    const fp = previewFingerprint(p);
    const keys = p.map((r) => r.idempotencyKey);
    expect(confirmReenrollment(p, fp, { fingerprint: "x", keys, actorPrincipalId: "p", human: true }, new Set())).toEqual({ ok: false, code: "preview-changed" });
    const r = confirmReenrollment(p, fp, { fingerprint: fp, keys, actorPrincipalId: "p", human: true }, new Set([keys[0]!]));
    expect(r.ok && r.value.execute.length).toBe(0);
    expect(r.ok && r.value.skipped).toEqual([keys[0]]);
  });
});
