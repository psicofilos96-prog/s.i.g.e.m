import { describe, it, expect } from "vitest";
import { draftFromTemplates, TEMPLATE_SKELETONS, editDraft, publish, saveVersion, startResponse, answerProblems, suggestedProvisions, validateStructure, type InstrumentVersion } from "./supervision-instruments";

const ok = <T,>(r: { ok: true; value: T } | { ok: false; code: string }): T => { if (!r.ok) throw new Error(r.code); return r.value; };

describe("instrumentos", () => {
  it("templates nunca trazem norma nem obrigatoriedade", () => {
    const qs = Object.values(TEMPLATE_SKELETONS).flatMap((s) => s.questions);
    expect(qs.every((x) => x.normRef === null && !x.required && x.defaultDueDays === null)).toBe(true);
    expect(Object.keys(TEMPLATE_SKELETONS).length).toBe(8);
  });
  it("publicação por competência e por pessoa distinta; publicada congela", () => {
    let chain: InstrumentVersion[] = [draftFromTemplates(["calendario", "turmas"], "i", "Visita", "sup", "t")];
    expect(publish(chain, { principalId: "sup", human: true, hasCapability: true }, 1)).toEqual({ ok: false, code: "publisher-must-differ" });
    expect(publish(chain, { principalId: "coord", human: true, hasCapability: false }, 1)).toEqual({ ok: false, code: "no-competence" });
    chain = ok(publish(chain, { principalId: "coord", human: true, hasCapability: true }, 1));
    expect(chain[0]!.state).toBe("publicada");
    expect(editDraft(chain, [], "sup")).toEqual({ ok: false, code: "published-is-frozen" });
    expect(saveVersion(chain, { instrumentId: "i", title: "Visita", sections: chain[0]!.sections, authorPrincipalId: "sup", at: "t", reason: "" }, 1, true)).toEqual({ ok: false, code: "reason-required" });
  });
  it("resposta presa à versão usada, imune a edição futura", () => {
    let chain: InstrumentVersion[] = ok(publish([draftFromTemplates(["calendario"], "i", "V", "sup", "t")], { principalId: "c", human: true, hasCapability: true }, 1));
    const r = ok(startResponse("r", "v", chain[0]!));
    chain = ok(saveVersion(chain, { instrumentId: "i", title: "V", sections: [{ key: "x", title: "X", questions: [] }], authorPrincipalId: "sup", at: "t", reason: "nova" }, 1, true));
    expect(r.version).toBe(1);
    expect(r.frozenSections[0]!.key).toBe("calendario");
    chain = ok(editDraft(chain, [{ ...TEMPLATE_SKELETONS["ppp"]! }], "sup"));
    chain = ok(publish(chain, { principalId: "c", human: true, hasCapability: true }, 2));
    expect(chain.map((v) => v.state)).toEqual(["retirada", "publicada"]);
    expect(r.frozenSections[0]!.key).toBe("calendario");
  });
  it("validação de resposta, evidência e providência com prazo só declarado", () => {
    const sec = { key: "s", title: "S", questions: [{ key: "a", text: "A?", type: "sim-nao" as const, required: true, evidenceRequired: true, attachmentsAllowed: true, normRef: null, recommendation: "Regularizar", defaultDueDays: 10 }, { key: "b", text: "B", type: "escala" as const, required: false, scale: { min: 1, max: 5, labels: {} }, evidenceRequired: false, attachmentsAllowed: false, normRef: null, recommendation: null, defaultDueDays: null }] };
    expect(validateStructure([sec])).toEqual([]);
    const r = { id: "r", visitId: "v", instrumentId: "i", version: 1, frozenSections: [sec], answers: [{ questionKey: "a", value: false, evidence: [], note: null }, { questionKey: "b", value: 9, evidence: [], note: null }] };
    expect(answerProblems(r)).toEqual(["a: evidência exigida", "b: fora da escala"]);
    expect(suggestedProvisions(r, "2026-03-01")).toEqual([{ questionKey: "a", text: "Regularizar", due: "2026-03-11", normRef: null, suggestion: true }]);
  });
});
