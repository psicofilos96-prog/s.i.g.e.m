import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { duplicatedStudents, heads, transportMessage, transportPicture, type TransportFact } from "./transport-model";

const f = (p: Partial<TransportFact>): TransportFact => ({
  id: crypto.randomUUID(), school_id: "A", kind: "rota", logical_id: "r1", version: 1, route_logical_id: null,
  stop_logical_id: null, student_id: null, label: "Rota", valid_from: "2026-01-01", valid_until: null, revoked: false,
  recorded_at: "2026-01-01T00:00:00Z", ...p,
});

describe("transporte escolar", () => {
  const rows = [
    f({}),
    f({ kind: "ponto", logical_id: "p1", route_logical_id: "r1" }),
    f({ kind: "vinculo-estudante", logical_id: "v1", stop_logical_id: "p1", student_id: "s1" }),
    f({ school_id: "B", logical_id: "rb" }),
  ];
  it("isola por escola", () => {
    expect(transportPicture(rows, "A", "2026-03-01").map((p) => p.route.logical_id)).toEqual(["r1"]);
  });
  it("revogação em nova versão retira o vínculo", () => {
    const pic = transportPicture([...rows, f({ kind: "vinculo-estudante", logical_id: "v1", version: 2, stop_logical_id: "p1", student_id: "s1", revoked: true })], "A", "2026-03-01");
    expect(pic[0].stops[0].students).toHaveLength(0);
  });
  it("knownAt ignora versão posterior", () => {
    expect(heads([f({}), f({ version: 2, label: "Nova", recorded_at: "2026-05-01T00:00:00Z" })], "2026-02-01T00:00:00Z")[0].label).toBe("Rota");
  });
  it("fora da vigência não aparece", () => {
    expect(transportPicture(rows, "A", "2025-12-31")).toHaveLength(0);
  });
  it("estudante em dois pontos é inconsistência, não escolha", () => {
    const pic = transportPicture([...rows, f({ kind: "ponto", logical_id: "p2", route_logical_id: "r1" }), f({ kind: "vinculo-estudante", logical_id: "v2", stop_logical_id: "p2", student_id: "s1" })], "A", "2026-03-01");
    expect(duplicatedStudents(pic)).toEqual(["s1"]);
  });
  it("erro do banco vira mensagem sem código", () => {
    expect(transportMessage("ERROR: transporte:sem-autorizacao")).toMatch(/autorização/);
    expect(transportMessage("PGRST 42501 xyz")).not.toMatch(/PGRST/);
  });
  it("writer exige capacidade, escola da rota/ponto e matrícula", () => {
    const file = readdirSync("drizzle/migrations").find((n) => n.includes("school_transport"))!;
    const sql = readFileSync(`drizzle/migrations/${file}`, "utf8");
    expect(sql).toMatch(/has_school_capability\('manter-transporte-escolar', _school\)/);
    expect(sql).toMatch(/rota-de-outra-escola/);
    expect(sql).toMatch(/estudante-sem-matricula-na-escola/);
    expect(sql).toMatch(/FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*school_transport_facts TO authenticated/);
  });
});
