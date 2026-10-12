import { describe, expect, it } from "vitest";
import { decideAccess, registerExport, offeredIntegrations, checkFlow, CIECE_INTEGRATIONS, PROFILE_PROPOSAL, type Principal } from "./security-integration";

const P = (caps: string[], o: Partial<Principal> = {}): Principal => ({ userId: "u1", capabilities: new Set(caps), network: false, schools: new Set(["A"]), policyHomologated: true, ...o });
const H = "c".repeat(64);

describe("CIECE L18 segurança e integração", () => {
  it("sem política homologada nada é liberado; perfil é só proposta", () => {
    expect(decideAccess(P(PROFILE_PROPOSAL.estatistica.capabilities, { policyHomologated: false }), { level: "agregado", schoolIds: ["A"], purpose: null, fields: [] }).reasons).toContain("politica-nao-homologada");
  });
  it("isolamento entre escolas e nominal com finalidade, escola explícita e capacidade", () => {
    const esc = P(["consultar-ciece", "consultar-nominal-censo"]);
    expect(decideAccess(esc, { level: "agregado", schoolIds: ["B"], purpose: null, fields: [] }).reasons).toEqual(["fora-do-escopo-escolar"]);
    expect(decideAccess(esc, { level: "nominal", schoolIds: ["A"], purpose: null, fields: [] }).reasons).toEqual(["finalidade-nao-declarada"]);
    const ok = decideAccess(esc, { level: "nominal", schoolIds: ["A"], purpose: "conferencia-censo", fields: ["nome", "cpf", "cid"] });
    expect(ok).toMatchObject({ allow: true, level: "nominal", droppedFields: ["cpf", "cid"] });
    expect(decideAccess(P(["consultar-ciece"], { network: true }), { level: "nominal", schoolIds: "rede", purpose: "x", fields: [] }).reasons).toEqual(["sem-capacidade:consultar-nominal-censo", "nominal-exige-escola-explicita"]);
  });
  it("agregação por padrão: limiar só homologado; grupo pequeno recusa e rebaixa", () => {
    const rede = P(["consultar-ciece"], { network: true });
    expect(decideAccess(rede, { level: "decomposicao", schoolIds: "rede", purpose: null, fields: [], groupSize: 3 }).reasons).toEqual(["limiar-de-divulgacao-nao-homologado"]);
    expect(decideAccess(rede, { level: "decomposicao", schoolIds: "rede", purpose: null, fields: [], groupSize: 3 }, 5)).toMatchObject({ allow: false, level: "agregado" });
    expect(decideAccess(rede, { level: "decomposicao", schoolIds: "rede", purpose: null, fields: [], groupSize: 8 }, 5).allow).toBe(true);
  });
  it("exportação registrada antes, idempotente, autoria da sessão", () => {
    const p = P(["exportar-ciece"]);
    const e = { key: "k", userId: "u1", report: "matriculas", level: "agregado" as const, params: "{}", sha256: H, at: "t" };
    expect(registerExport([], P([]), e)).toMatchObject({ reason: "sem-capacidade:exportar-ciece" });
    expect(registerExport([], p, { ...e, userId: "u2" })).toMatchObject({ reason: "autor-diferente-da-sessao" });
    const r = registerExport([], p, e); expect(r).toMatchObject({ ok: true, reused: false });
    if (!r.ok) return;
    expect(registerExport(r.log, p, e)).toMatchObject({ reused: true });
    expect(registerExport(r.log, p, { ...e, sha256: "d".repeat(64) })).toMatchObject({ reason: "chave-reutilizada-com-conteudo-diferente" });
  });
  it("9 setores integrados, só por rota autorizada, nunca gravando na fonte", () => {
    expect(CIECE_INTEGRATIONS.map((i) => i.sector)).toHaveLength(9);
    expect(offeredIntegrations((r) => r === "/secretaria").map((i) => i.sector)).toEqual(["Secretaria"]);
    const nei = CIECE_INTEGRATIONS.find((i) => i.sector === "NEI")!;
    expect(checkFlow(nei, ["escola", "cid"])).toMatchObject({ ok: false, fields: ["cid"] });
    expect(checkFlow(nei, ["escola"])).toEqual({ ok: true, writesToSource: false });
  });
});
