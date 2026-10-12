import { describe, it, expect } from "vitest";
import { projectOpDesignations, decideOpAccess, aggregateForCentral, type OpDesignationEvent, type OpAccessRequest } from "./op-designations";

const ev = (o: Partial<OpDesignationEvent> & Pick<OpDesignationEvent, "id" | "logicalId" | "seq">): OpDesignationEvent => ({
  kind: "designar", role: "orientador-da-unidade", personId: "o1", engagementId: "g1", schoolIds: ["sA"], classIds: null,
  from: "2026-02-01", to: null, substituteOf: null, reason: null, actorPersonId: "dir", ...o,
});
const events: OpDesignationEvent[] = [
  ev({ id: "1", logicalId: "A", seq: 1 }),
  ev({ id: "2", logicalId: "A", seq: 2, kind: "encerrar", to: "2026-05-31", reason: "mudança de lotação" }),
  ev({ id: "3", logicalId: "B", seq: 1, schoolIds: ["sB"], from: "2026-06-01", engagementId: "g2" }),
  ev({ id: "4", logicalId: "C", seq: 1, role: "coordenacao-central-op", personId: "c1", schoolIds: "rede" }),
  ev({ id: "5", logicalId: "S", seq: 1, personId: "o2", substituteOf: "B", schoolIds: ["sB"], from: "2026-07-01", to: "2026-07-31", kind: "substituir" }),
  ev({ id: "6", logicalId: "X", seq: 1, personId: "o3", actorPersonId: "o3" }), // autodesignação
  ev({ id: "7", logicalId: "Y", seq: 1, personId: "o4", substituteOf: "A", from: "2026-05-01", to: "2026-06-30" }), // excede titular
];
const { list, rejected } = projectOpDesignations(events);
const capsUnit = (s: string) => [{ id: "consultar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: s }, { id: "registrar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: s }];
const req = (o: Partial<OpAccessRequest>): OpAccessRequest => ({
  personNatural: true, personId: "o1", date: "2026-03-10", schoolId: "sA", classId: "5A", granularity: "individual", action: "consultar",
  purpose: "acompanhamento", designations: list, capabilities: capsUnit("sA"), ...o,
});
const ok = (o: Partial<OpAccessRequest>) => decideOpAccess(req(o)).ok;

describe("OP L02 — designações e permissões", () => {
  it("recusa autodesignação e substituição fora do período do titular", () => expect(rejected.sort()).toEqual(["X", "Y"]));
  it("escola A não acessa B", () => {
    expect(ok({})).toBe(true);
    expect(ok({ schoolId: "sB", capabilities: capsUnit("sB") })).toBe(false);
  });
  it("mudança de lotação: acesso segue a data; histórico preservado", () => {
    expect(ok({ date: "2026-06-10" })).toBe(false);
    expect(ok({ date: "2026-06-10", schoolId: "sB", capabilities: capsUnit("sB") })).toBe(true);
    expect(list.find((d) => d.logicalId === "A")!.history.map((h) => h.kind)).toEqual(["designar", "encerrar"]);
  });
  it("substituto só no próprio período, e sem capacidade não age", () => {
    const s = { personId: "o2", schoolId: "sB", capabilities: capsUnit("sB") };
    expect(ok({ ...s, date: "2026-07-15" })).toBe(true);
    expect(ok({ ...s, date: "2026-08-01" })).toBe(false);
    expect(ok({ ...s, date: "2026-07-15", capabilities: [] })).toBe(false);
  });
  it("designação por turma restringe a turma", () => {
    const { list: l } = projectOpDesignations([ev({ id: "t", logicalId: "T", seq: 1, personId: "o5", classIds: ["5A"] })]);
    expect(ok({ personId: "o5", designations: l })).toBe(true);
    expect(ok({ personId: "o5", designations: l, classId: "6B" })).toBe(false);
  });
  it("central: agregado por padrão, individual só com competência de rede, nunca registra", () => {
    const c = { personId: "c1", schoolId: "sB", capabilities: [] };
    expect(ok({ ...c, granularity: "agregado" })).toBe(true);
    expect(ok({ ...c })).toBe(false);
    expect(ok({ ...c, capabilities: [{ id: "consultar-acompanhamento-pedagogico", scope: "rede", schoolId: null }] })).toBe(true);
    expect(ok({ ...c, action: "registrar", capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "rede", schoolId: null }] })).toBe(false);
  });
  it("finalidade obrigatória; executor técnico negado", () => {
    expect(ok({ purpose: null })).toBe(false);
    expect(ok({ personNatural: false })).toBe(false);
  });
  it("agregado suprime 1–4 e não lido ≠ zero", () => {
    expect(aggregateForCentral({ a: 0, b: 3, c: 12, d: null })).toEqual({ a: 0, b: "suprimido", c: 12, d: "não disponível" });
  });
});
