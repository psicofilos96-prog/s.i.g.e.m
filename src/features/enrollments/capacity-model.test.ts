import { describe, expect, it } from "vitest";
import { authorizedOn, installedCapacity, operationalCapacity, recordAuthorization, vacanciesFrom,
  type AuthActor, type CapacityAuthorization, type Environment } from "./capacity-model";

const env: Environment = { envId: "sala-1", schoolId: "esc-A", kind: "sala", installed: 35, accessible: true, shiftIds: ["man", "tar"] };
const restr = [{ envId: "sala-1", shiftId: "tar", reduction: 5, reason: "cadeirante: espaço de circulação", from: "2027-01-01", to: null }];
const criteria = [{ criterionId: "c1", version: 1, basis: "Decisão da Secretaria 2026-10", homologated: true, description: "1,2 m² por estudante" },
  { criterionId: "c2", version: 1, basis: "", homologated: false, description: "rascunho" }];
const rede: AuthActor = { personId: "p-rede", isHuman: true, capabilities: ["autorizar-capacidade"], schoolIds: "rede" };
const draft = { authId: "a1", schoolId: "esc-A", envId: "sala-1", shiftId: "tar", authorized: 28, criterionId: "c1", criterionVersion: 1,
  actRef: "ato-cap-1", validFrom: "2027-02-01", validTo: null, kind: "registro" as const, reason: "abertura 2027" };
const ctx = (expectedSeq = 0) => ({ requiredCapability: "autorizar-capacidade", criteria, env, restrictions: restr, expectedSeq });

describe("Capacidade L03", () => {
  it("instalada, operacional e autorizada são distintas", () => {
    expect(installedCapacity(env).value).toBe(35);
    expect(operationalCapacity(env, "tar", restr, "2027-03-01").value).toBe(30);
    expect(operationalCapacity(env, "man", restr, "2027-03-01").value).toBe(35);
    expect(operationalCapacity(env, "noi", restr, "2027-03-01").value).toBeNull();
    expect(operationalCapacity({ ...env, installed: null }, "man", [], "2027-03-01").value).toBeNull();
  });
  it("sala física sem autorização não gera vaga", () => {
    expect(authorizedOn([], "sala-1", "man", "2027-03-01").value).toBeNull();
    expect(vacanciesFrom(authorizedOn([], "sala-1", "man", "2027-03-01"), 0).value).toBeNull();
  });
  it("autorização exige pessoa, competência, critério homologado com fundamento, ato e respeita a operacional", () => {
    expect(recordAuthorization([], draft, { ...rede, isTechnicalExecutor: true }, ctx()).ok).toBe(false);
    expect(recordAuthorization([], draft, rede, { ...ctx(), requiredCapability: null }).ok).toBe(false);
    expect(recordAuthorization([], draft, { ...rede, capabilities: [] }, ctx()).ok).toBe(false);
    expect(recordAuthorization([], { ...draft, criterionId: "c2" }, rede, ctx()).ok).toBe(false);
    expect(recordAuthorization([], { ...draft, actRef: "" }, rede, ctx()).ok).toBe(false);
    expect(recordAuthorization([], { ...draft, authorized: 31 }, rede, ctx()).ok).toBe(false);
    const d = recordAuthorization([], draft, rede, ctx());
    expect(d.ok && d.record.responsiblePersonId).toBe("p-rede");
  });
  it("vagas derivam da autorizada vigente; ocupação não lida ⇒ null", () => {
    const d = recordAuthorization([], draft, rede, ctx()); if (!d.ok) throw new Error(d.reason);
    const a = authorizedOn([d.record], "sala-1", "tar", "2027-03-01");
    expect(a.value).toBe(28);
    expect(vacanciesFrom(a, 20).value).toBe(8);
    expect(vacanciesFrom(a, null).value).toBeNull();
    expect(authorizedOn([d.record], "sala-1", "tar", "2027-01-15").value).toBeNull();
  });
  it("retificação e revogação preservam a cadeia", () => {
    const chain: CapacityAuthorization[] = [];
    const r1 = recordAuthorization(chain, draft, rede, ctx()); if (!r1.ok) throw 0; chain.push(r1.record);
    expect(recordAuthorization(chain, draft, rede, ctx(1)).ok).toBe(false);
    const r2 = recordAuthorization(chain, { ...draft, kind: "retificacao", authorized: 25, actRef: "ato-cap-2" }, rede, ctx(1)); if (!r2.ok) throw 0; chain.push(r2.record);
    expect(authorizedOn(chain, "sala-1", "tar", "2027-03-01").value).toBe(25);
    const r3 = recordAuthorization(chain, { ...draft, kind: "revogacao", actRef: "ato-cap-3" }, rede, ctx(2)); if (!r3.ok) throw 0; chain.push(r3.record);
    expect(authorizedOn(chain, "sala-1", "tar", "2027-03-01").value).toBeNull();
    expect(chain.map((c) => c.seq)).toEqual([1, 2, 3]);
  });
});
