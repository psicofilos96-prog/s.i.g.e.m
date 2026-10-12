import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPS_EXECUTOR_WRITES, capabilityFor, linksOn, opsEventKey, projectRequest, validateEvent, type OpsEvent } from "./shared-requests";

const ev = (seq: number, kind: OpsEvent["kind"], x: Partial<OpsEvent> = {}): OpsEvent => ({ seq, kind, actorPerson: "p1", at: "2026-10-12", ...x });
const SQL = readFileSync("drizzle/migrations/0403_ops02_shared_requests.sql", "utf8");

describe("Centro de Operações L02 — núcleo de solicitações", () => {
  it("estado e responsável são projeção dos eventos", () => {
    const p = projectRequest([ev(1, "atribuicao", { responsibleEngagement: "e1" }), ev(2, "inicio"), ev(3, "atribuicao", { responsibleEngagement: "e2" }), ev(4, "conclusao")]);
    expect(p).toMatchObject({ state: "concluida", responsible: "e2", issues: [] });
  });
  it("transição inválida e sequência quebrada são denunciadas, nunca aplicadas", () => {
    const p = projectRequest([ev(1, "conclusao"), ev(3, "atribuicao", { responsibleEngagement: "e1" })]);
    expect(p.state).toBe("atribuida");
    expect(p.issues.join(" ")).toMatch(/conclusao inválido/);
    expect(p.issues.join(" ")).toMatch(/sequência quebrada/);
  });
  it("vínculos temporais: vigência [início, fim) e sem duplicar vínculo aberto", () => {
    const p = projectRequest([
      ev(1, "vinculo-objeto", { objectKind: "bem", objectRef: "b1", validFrom: "2026-03-01" }),
      ev(2, "vinculo-objeto", { objectKind: "bem", objectRef: "b1", validFrom: "2026-04-01" }),
      ev(3, "fim-vinculo-objeto", { objectKind: "bem", objectRef: "b1", validFrom: "2026-05-01" }),
    ]);
    expect(linksOn(p, "2026-04-30")).toHaveLength(1);
    expect(linksOn(p, "2026-05-01")).toHaveLength(0);
    expect(p.issues).toHaveLength(1);
  });
  it("cancelar/reabrir exigem justificativa; atribuição exige atuação", () => {
    expect(validateEvent("aberta", { kind: "cancelamento", note: "curta" })).not.toEqual([]);
    expect(validateEvent("aberta", { kind: "atribuicao" })).not.toEqual([]);
    expect(validateEvent("concluida", { kind: "reabertura", note: "Defeito voltou após o reparo." })).toEqual([]);
  });
  it("banco: append-only, sem DML direto, capacidade por setor, seq esperado, anexo oculto, idempotência", () => {
    expect(SQL).toMatch(/opsr_immutable BEFORE UPDATE OR DELETE/);
    expect(SQL).toMatch(/opse_immutable BEFORE UPDATE OR DELETE/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(SQL).toMatch(/'atender-' \|\| _r\.sector/);
    expect(SQL).toMatch(/ops:conflict/);
    expect(SQL).toMatch(/REVOKE SELECT \(case_event_ref\)/);
    expect(SQL).toMatch(/idempotency_key text NOT NULL UNIQUE/);
    expect(SQL).toMatch(/current_person_id\(\)/);
    expect(capabilityFor("atender", "patrimonio")).toBe("atender-patrimonio");
    expect(opsEventKey("r", 2, "inicio")).toBe("ops-ev|r|2|inicio");
    expect(OPS_EXECUTOR_WRITES).toEqual([]);
  });
});
