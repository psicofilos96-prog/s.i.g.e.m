import { describe, it, expect } from "vitest";
import { requestIssues, linkIssues, bridgeState, CANONICAL_WRITER, BRIDGE_WRITES, requestKey, type GuidanceRequest } from "./guidance-bridge";

const req: GuidanceRequest = { caseId: "c", schoolId: "s", studentId: "e", kind: "recuperacao", purpose: "Apoio após retorno em matemática", requestedBy: "p", key: "k" };
const caps = new Set(["solicitar-orientacao-pedagogica"]);

describe("L16 ponte com a Orientação", () => {
  it("solicitação exige pessoa, capacidade, finalidade e barra conteúdo sensível", () => {
    expect(requestIssues(req, caps)).toEqual([]);
    expect(requestIssues({ ...req, requestedBy: null }, new Set())).toEqual(expect.arrayContaining(["sem-pessoa", "sem-capacidade"]));
    expect(requestIssues({ ...req, purpose: "Família relata violência doméstica" }, caps)).toContain("conteudo-sensivel");
  });
  it("vínculo só ao registro da OP do mesmo estudante/escola, sem autor técnico", () => {
    const rec = { kind: "recuperacao" as const, ref: "aa-int:1", schoolId: "s", studentId: "e", authorPerson: "op" };
    expect(linkIssues(req, rec, new Set())).toEqual([]);
    expect(linkIssues(req, { ...rec, studentId: "x" }, new Set())).toContain("outro-estudante-ou-escola");
    expect(linkIssues(req, rec, new Set(["op"]))).toContain("autor-tecnico");
  });
  it("sem registros paralelos: escritores são os da OP e a ponte não escreve", () => {
    expect(new Set(Object.values(CANONICAL_WRITER))).toEqual(new Set(["record_school_pedagogical_record_v2", "aa_record_intervention"]));
    expect(BRIDGE_WRITES).toEqual([]);
    expect(requestKey("c", "acolhimento", "r")).toBe(requestKey("c", "acolhimento", "r"));
  });
  it("estado deriva de solicitação e vínculo", () => {
    expect(bridgeState([], [], "acolhimento")).toBe("nao-solicitado");
    expect(bridgeState([req], [], "recuperacao")).toBe("solicitado");
  });
});
