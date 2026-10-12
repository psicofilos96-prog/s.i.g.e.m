import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { operationalCapacity } from "../enrollments/capacity-model";
import { aptCapacity, canRecord, schedule, toNetworkRestrictions, workState, WORKS_BRIDGE_WRITES, type UseRestrictionEvent, type WorkEvent } from "./works-restrictions";

const SQL = readFileSync("drizzle/migrations/0412_ops08_works_restrictions.sql", "utf8");
const R = (x: Partial<UseRestrictionEvent>): UseRestrictionEvent => ({ seq: 1, action: "impor", key: "r", severity: "uso-restrito", capacityLimit: 20, shiftIds: [], from: "2026-10-01", to: null, reason: "Rampa em obra no acesso", ...x });
const S = { capacity: 35, capacitySource: "Medição 2026", availability: "disponivel" as const };

describe("Centro de Operações L08 — obras e capacidade apta", () => {
  it("início exige responsável técnico; recebimento por outra pessoa com documento", () => {
    expect(canRecord([], "inicio", "a").ok).toBe(false);
    const ev: WorkEvent[] = [{ seq: 1, kind: "responsavel-tecnico", actorPerson: "g", responsiblePerson: "eng", registry: "CREA 123" }, { seq: 2, kind: "inicio", actorPerson: "g" }, { seq: 3, kind: "conclusao-declarada", actorPerson: "g" }];
    expect(workState(ev)).toBe("conclusao-declarada");
    expect(canRecord(ev, "recebimento", "eng", { hasDoc: true }).ok).toBe(false);
    expect(canRecord(ev, "recebimento", "g", { hasDoc: true }).ok).toBe(false);
    expect(canRecord(ev, "recebimento", "dir", {}).ok).toBe(false);
    expect(canRecord(ev, "recebimento", "dir", { hasDoc: true }).ok).toBe(true);
  });
  it("cronograma: sem marco = não informado; atraso só por marco previsto vencido", () => {
    expect(schedule([], "2026-10-12")).toBe("nao-informado");
    const s = schedule([{ seq: 1, kind: "marco-previsto", actorPerson: "g", milestoneKey: "m1", onDate: "2026-09-01" }], "2026-10-12");
    expect(s).toEqual([{ key: "m1", label: "m1", planned: "2026-09-01", done: null, state: "atrasado" }]);
  });
  it("capacidade apta: sala sem fonte não é apta; interdição zera; restrição sem limite indetermina", () => {
    expect(aptCapacity({ ...S, capacitySource: null }, [], "t", "2026-10-12").value).toBeNull();
    expect(aptCapacity({ ...S, availability: "nao-informada" }, [], "t", "2026-10-12").value).toBeNull();
    expect(aptCapacity(S, [R({})], "t", "2026-10-12").value).toBe(20);
    expect(aptCapacity(S, [R({ severity: "interdicao", capacityLimit: null })], "t", "2026-10-12").value).toBe(0);
    expect(aptCapacity(S, [R({ capacityLimit: null })], "t", "2026-10-12").value).toBeNull();
    expect(aptCapacity(S, [R({}), R({ seq: 2, action: "levantar", from: "2026-10-05" })], "t", "2026-10-12").value).toBe(35);
  });
  it("ponte com a Organização da Rede reduz a operacional sem escrever lá", () => {
    const env = { envId: "e", schoolId: "s", kind: "sala", installed: 35, accessible: null, shiftIds: ["t"] };
    expect(operationalCapacity(env, "t", toNetworkRestrictions("e", 35, [R({})], "2026-10-12"), "2026-10-12")).toMatchObject({ value: 20 });
    expect(WORKS_BRIDGE_WRITES).toEqual([]);
  });
  it("banco: contrato/recebimento com documento, recebimento ≠ responsável, sem DML direto", () => {
    expect(SQL).toMatch(/kind NOT IN \('contrato','recebimento'\) OR doc_ref IS NOT NULL/);
    expect(SQL).toMatch(/opsw:self-receipt/);
    expect(SQL).toMatch(/opsw:no-technical-responsible/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
