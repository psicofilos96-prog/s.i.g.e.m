import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { accessState, canRecord, reviewStatus } from "./access-requests";

const req = { requesterPerson: "r", beneficiaryPerson: "b" };
const e = (seq: number, kind: any, at = "2026-01-10") => ({ seq, kind, personId: "x", at });

describe("L16 pedidos de acesso", () => {
  it("fluxo análise → aprovação → revisão → revogação", () => {
    expect(canRecord(req, [], "aprovacao", "x")).toBe("transicao-invalida");
    expect(canRecord(req, [e(1, "analise")], "aprovacao", "x")).toBeNull();
    expect(accessState([e(1, "analise"), e(2, "aprovacao"), e(3, "revisao-manter")])).toBe("ativo");
    expect(canRecord(req, [e(1, "analise"), e(2, "indeferimento")], "aprovacao", "x")).toBe("transicao-invalida");
  });
  it("solicitante e beneficiário não aprovam nem revogam", () => {
    expect(canRecord(req, [e(1, "analise")], "aprovacao", "r")).toBe("conflito-de-interesse");
    expect(canRecord(req, [e(1, "analise"), e(2, "aprovacao")], "revogacao", "b")).toBe("conflito-de-interesse");
  });
  it("revisão só vence com periodicidade declarada", () => {
    const ev = [e(1, "analise"), e(2, "aprovacao", "2026-01-10")];
    expect(reviewStatus(ev, null, "2027-01-01")).toMatch(/não declarada/);
    expect(reviewStatus(ev, 90, "2026-05-01")).toBe("revisão vencida desde 2026-04-10");
  });
  it("banco: serviço vigente, conflito, transições e sem capability do SIGEM", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0489"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    for (const s of ["servico-nao-vigente", "conflito-de-interesse", "transicao-invalida", "atuacao-nao-vigente"]) expect(sql).toContain(s);
    expect(sql).not.toMatch(/INSERT INTO public\.(capability|institutional_engagement)/);
    expect(sql.match(/FROM PUBLIC, anon/g)).toHaveLength(3);
  });
});
