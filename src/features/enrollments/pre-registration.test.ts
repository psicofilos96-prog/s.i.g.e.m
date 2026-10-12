import { describe, expect, it } from "vitest";
import { findCandidates, protocolFor, publicStatusView, submitPreRegistration, toEnrollmentDraftPlan, validatePreRegistration } from "./pre-registration";

const H = (c: string) => c.repeat(64);
const input = { campaignId: "cp1", schoolPreferenceIds: ["A"], childName: "Ana Souza", childBirthDate: "2021-04-02", childCpfHmac: H("a"),
  guardianName: "Maria Souza", guardianContactHmac: H("b"), guardianRelationDeclared: "mãe", documentRefs: ["inscricoes/cp1/k1/certidao.pdf"], idempotencyKey: "k1" };
const people = [{ personId: "p1", nameNormalized: "ana souza", birthDate: "2021-04-02", cpfHmac: null }, { personId: "p2", nameNormalized: "outra", birthDate: null, cpfHmac: H("a") }, { personId: "p3", nameNormalized: "ana souza", birthDate: "2020-01-01", cpfHmac: null }];
const ctx = { campaignVersion: 1, campaignAccepts: (s: string) => s === "A", maxPreferences: null, today: "2026-11-10", now: "2026-11-10T10:00:00Z", people, existingProtocols: new Set<string>() };

describe("Inscrição/pré-matrícula L07", () => {
  it("identificação mínima: recusa campo extra, CPF em claro, texto clínico e documento fora do bucket", () => {
    const v = (x: Record<string, unknown>) => validatePreRegistration({ ...input, ...x }, ctx);
    expect(v({ endereco: "rua" })).toContain("Campo não permitido: endereco.");
    expect(v({ childCpfHmac: "123.456.789-00" }).join()).toMatch(/HMAC/);
    expect(v({ guardianRelationDeclared: "mãe, laudo TEA" }).join()).toMatch(/clínica/);
    expect(v({ documentRefs: ["https://x/y.pdf"] }).join()).toMatch(/protegido/);
    expect(v({ schoolPreferenceIds: ["A", "B"] }).join()).toMatch(/não configurado/);
    expect(v({})).toEqual([]);
  });
  it("candidatos: CPF forte, nome+nascimento fraca, nome sozinho nunca", () => {
    expect(findCandidates(input, people)).toEqual([{ personId: "p1", strength: "fraca", basis: "nome+nascimento" }, { personId: "p2", strength: "forte", basis: "CPF" }]);
  });
  it("protocolo idempotente e inscrição não cria matrícula, pessoa nem acesso familiar", async () => {
    const r = await submitPreRegistration(input, ctx); if (!r.ok) throw new Error(r.issues.join());
    expect(r.record.protocol).toBe(await protocolFor("cp1", "k1"));
    expect(r.record).toMatchObject({ createsEnrollment: false, createsPerson: false, createsGuardianAccess: false, campaignVersion: 1 });
    const again = await submitPreRegistration(input, { ...ctx, existingProtocols: new Set([r.record.protocol]) });
    expect(again.ok && again.duplicate).toBe(true);
    expect(Object.keys(publicStatusView(r.record))).toEqual(["protocol", "status", "submittedAt"]);
    expect((await submitPreRegistration(input, { ...ctx, campaignVersion: null })).ok).toBe(false);
  });
  it("conversão só por pessoa da escola, entre candidatos apurados, com motivo ao descartar", async () => {
    const r = await submitPreRegistration(input, ctx); if (!r.ok) throw 0;
    const sec = { personId: "p-sec", isHuman: true, capabilities: ["manter-matricula"], schoolIds: ["A"] };
    const d = (x: object, a: object = sec) => toEnrollmentDraftPlan(r.record, { ...sec, ...a }, { schoolId: "A", matchedPersonId: null, requiredCapability: "manter-matricula", reason: "", ...x }).ok;
    expect(d({})).toBe(false);
    expect(d({ reason: "homônimo confirmado diferente" })).toBe(true);
    expect(d({ matchedPersonId: "p9" })).toBe(false);
    expect(d({ matchedPersonId: "p2" })).toBe(true);
    expect(d({ matchedPersonId: "p2" }, { isTechnicalExecutor: true })).toBe(false);
    expect(d({ matchedPersonId: "p2", requiredCapability: null })).toBe(false);
    expect(d({ matchedPersonId: "p2", schoolId: "B" }, { schoolIds: ["B"] })).toBe(false);
  });
});
