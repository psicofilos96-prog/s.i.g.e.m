import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { canRecordSec } from "./security-incidents";

const e = (seq: number, kind: any, personalData: boolean | null = null) => ({ seq, kind, personalData, personId: "t" });

describe("L17 incidentes de segurança", () => {
  it("começa por triagem; relator não decide", () => {
    expect(canRecordSec("r", [], "contencao", "t")).toBe("transicao-invalida");
    expect(canRecordSec("r", [], "triagem", "r")).toBe("relator-nao-decide");
  });
  it("encerrar exige contenção e, com dado pessoal, decisão de comunicação", () => {
    const base = [e(1, "triagem", true)];
    expect(canRecordSec("r", base, "encerramento", "t")).toBe("sem-contencao");
    expect(canRecordSec("r", [...base, e(2, "contencao")], "encerramento", "t")).toBe("sem-decisao-de-comunicacao");
    expect(canRecordSec("r", [...base, e(2, "contencao"), e(3, "decisao-comunicacao")], "encerramento", "t")).toBeNull();
    expect(canRecordSec("r", [e(1, "triagem", false), e(2, "contencao")], "encerramento", "t")).toBeNull();
  });
  it("encerrado não recebe eventos", () => {
    expect(canRecordSec("r", [e(1, "descarte")], "triagem", "t")).toBe("encerrado");
  });
  it("banco: leitura só com capability da rede, documento oculto, relator só vê fase", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0490"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql.match(/USING \(public\.has_network_capability\('tratar-incidentes-de-seguranca'\)\)/g)).toHaveLength(2);
    expect(sql).toMatch(/GRANT SELECT \(incident_id, seq, kind, severity, personal_data, communicate, note, person_id, created_at\)/);
    expect(sql).toMatch(/RETURNS TABLE\(code text, created_at timestamptz, phase text\)/);
    expect(sql).not.toMatch(/(FROM|INTO|JOIN) public\.ops_requests/);
    expect(sql.match(/FROM PUBLIC, anon/g)).toHaveLength(3);
  });
});
