import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { ACT_CAPABILITY, actProblems, currentVersion } from "./case-acts";

const sql = readFileSync(`drizzle/migrations/${readdirSync("drizzle/migrations").find((n) => n.includes("doc10_case_acts"))}`, "utf8");

describe("L10 atos do processo", () => {
  it("competência por espécie", () => {
    expect(ACT_CAPABILITY.decisao).toBe("decidir-processos");
    expect(ACT_CAPABILITY.parecer).toBe("emitir-pareceres");
    expect(sql).toMatch(/WHEN 'decisao' THEN 'decidir-processos'/);
  });
  it("decisão exige dispositivo e referência; nova versão exige motivo", () => {
    expect(actProblems("decisao", { body: "texto suficiente", refs: [] }, false)).toHaveLength(2);
    expect(actProblems("despacho", { body: "texto suficiente", refs: [] }, true)).toEqual(["Nova versão exige motivo."]);
  });
  it("versão vigente é a maior; histórico preservado", () => {
    const v = currentVersion([{ version: 1, body: "a", outcome: null, authorPerson: "p", changeReason: null, refs: [] },
      { version: 2, body: "b", outcome: null, authorPerson: "q", changeReason: "corrige", refs: [] }]);
    expect(v?.version).toBe(2);
  });
  it("banco segrega parecer e decisão, base esperada, hash e append-only", () => {
    expect(sql).toMatch(/act:decision-on-own-opinion/);
    expect(sql).toMatch(/act:opinion-by-decider/);
    expect(sql).toMatch(/act:stale-base/);
    expect(sql).toMatch(/content_sha256/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
