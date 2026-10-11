import { describe, expect, it } from "vitest";
import { attachRecord, goalResult, planGaps, recordPlanVersion, sign, transitionDoc, validatePpp, type InstDoc } from "./management-plan";

const goal = { id: "g", objective: "frequência", target: "≥ 90%", indicatorKey: "frequencia", baseline: null,
  actions: [{ id: "a1", description: "busca ativa", responsibleEngagementId: null, due: null, resources: null, indicatorKey: null }] };

describe("Direção — plano, PPP, agenda e documentos", () => {
  it("plano versionado com base esperada; lacunas e meta não apurada explícitas", () => {
    const r = recordPlanVersion([], { planId: "p", schoolId: "A", year: 2026, diagnosisRefs: ["diag:1"], goals: [goal], authorId: "dir", reason: "inicial" }, 0, true);
    if (!r.ok) throw 0;
    expect(recordPlanVersion(r.chain, { ...r.chain[0]!, reason: "x" }, 0, true)).toMatchObject({ code: "plano:base-desatualizada" });
    expect(planGaps(r.chain[0]!)).toEqual([{ action: "a1", gap: "sem responsável" }, { action: "a1", gap: "sem prazo" }]);
    expect(goalResult(goal, null, 0.9).state).toBe("nao-apurado");
    expect(goalResult(goal, 0.92, 0.9).state).toBe("atingida");
  });
  it("PPP só com rito homologado, competência, participação e validador ≠ autor", () => {
    const p = { id: "ppp", version: 1, participants: [{ personId: "x", segment: "docentes" }], validations: [], authorId: "dir" };
    expect(validatePpp(p, "c", ["validar-ppp"], null, "d")).toMatchObject({ code: "ppp:rito-de-validacao-nao-homologado" });
    expect(validatePpp(p, "dir", ["validar-ppp"], "validar-ppp", "d")).toMatchObject({ code: "ppp:autovalidacao" });
    expect(validatePpp({ ...p, participants: [] }, "c", ["validar-ppp"], "validar-ppp", "d")).toMatchObject({ code: "ppp:sem-participacao-registrada" });
    expect(validatePpp(p, "c", ["validar-ppp"], "validar-ppp", "d").ok).toBe(true);
  });
  it("conselho na agenda exige ata do colegiado", () => {
    const a = { id: "e", schoolId: "A", kind: "conselho" as const, date: "d", title: "1º bim", tasks: [], minuteRef: null };
    expect(attachRecord(a, "x", "registro-simples")).toMatchObject({ code: "agenda:conselho-exige-ata-do-colegiado" });
  });
  it("documento: revisão→aprovação por competência, ata com deliberação, assinatura só do próprio e simples", () => {
    const d: InstDoc = { id: "d", kind: "ata", schoolId: "A", authorId: "sec", version: 1, events: [] };
    const caps = { ata: "aprovar-ata-escolar" };
    expect(transitionDoc(d, "aprovado", "dir", ["aprovar-ata-escolar"], caps)).toMatchObject({ code: "doc:transicao-invalida" });
    const rv = transitionDoc(d, "em-revisao", "sec", [], caps); if (!rv.ok) throw 0;
    expect(transitionDoc(rv.doc, "aprovado", "sec", ["aprovar-ata-escolar"], caps)).toMatchObject({ code: "doc:autoaprovacao" });
    expect(transitionDoc(rv.doc, "aprovado", "dir", ["aprovar-ata-escolar"], caps)).toMatchObject({ code: "doc:ata-sem-deliberacao" });
    expect(transitionDoc({ ...rv.doc, kind: "oficio" }, "aprovado", "dir", ["x"], caps)).toMatchObject({ code: "doc:competencia-nao-declarada" });
    const ap = transitionDoc(rv.doc, "aprovado", "dir", ["aprovar-ata-escolar"], caps, { deliberationRef: "del:1" }); if (!ap.ok) throw 0;
    expect(sign(ap.doc, "dir", "outro", { icpBrasil: false })).toMatchObject({ code: "assinatura:so-o-proprio-signatario" });
    const s = sign(ap.doc, "dir", "dir", { icpBrasil: false }); expect(s.ok && s.signature.level).toBe("simples");
  });
});
