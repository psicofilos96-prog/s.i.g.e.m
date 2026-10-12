import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { audited, calculationAudit, canAmend, decide, exportColumns, projectLeave, type AuditRecord, type Viewer } from "./people-access";

const D = "2026-03-02";
const sec: Viewer = { personId: "S1", grants: [{ capability: "consultar-registro-funcional", scope: "escola", schoolId: "E1", validFrom: "2026-01-01", validUntil: null }] };
const rf = { kind: "registro-funcional" as const, schoolId: "E1", subjectPersonId: "P1" };

describe("acesso de Gestão de Pessoas", () => {
  it("capacidade × escola × vigência", () => {
    expect(decide(sec, rf, "ler", D).allowed).toBe(true);
    expect(decide(sec, { ...rf, schoolId: "E2" }, "ler", D).reason).toBe("fora-do-escopo");
    expect(decide({ ...sec, grants: [{ ...sec.grants[0]!, validUntil: "2026-02-01" }] }, rf, "ler", D).reason).toBe("fora-da-vigencia");
    expect(decide({ personId: "X", grants: [] }, rf, "ler", D).reason).toBe("sem-capacidade");
  });
  it("própria pessoa lê o próprio registro; operador técnico nunca", () => {
    expect(decide({ personId: "P1", grants: [] }, rf, "ler", D).reason).toBe("proprio-registro");
    expect(decide({ personId: null, grants: sec.grants, technical: true }, rf, "ler", D).reason).toBe("operador-tecnico");
  });
  it("afastamento sem capacidade sai sem documento nem observação", () => {
    const row = { id: "L1", typeId: "licenca", from: "2026-02-01", until: null, impact: "total", documentRef: "doc", notes: "texto", schoolId: "E1", personId: "P1" };
    expect(projectLeave(sec, row, D)).toMatchObject({ documentRef: null, notes: null, impact: "total" });
    expect(projectLeave({ personId: "P1", grants: [] }, row, D).notes).toBe("texto");
  });
  it("exportação exige capacidade própria e omite sensíveis por padrão", () => {
    expect(exportColumns(sec, rf, ["pessoa", "vinculo"], false, D).allowed).toBe(false);
    const exp: Viewer = { personId: "S1", grants: [{ capability: "exportar-registro-funcional", scope: "rede", schoolId: null, validFrom: "2026-01-01", validUntil: null }] };
    expect(exportColumns(exp, rf, ["pessoa", "vinculo"], false, D).columns).toEqual(["pessoa"]);
  });
  it("retificação exige capacidade, motivo e nunca o próprio registro; cálculo não se retifica", () => {
    expect(canAmend(sec, rf, "retificar", null, D)).toEqual(["sem-capacidade", "motivo-ausente"]);
    expect(decide(sec, { ...rf, kind: "calculo" }, "retificar", D).reason).toBe("acao-inexistente");
  });
  it("trilha registra permitidos e negados; cálculo auditado por hash", async () => {
    const t: AuditRecord[] = [];
    audited(sec, rf, "ler", D, "t", t); audited(sec, { ...rf, schoolId: "E2" }, "ler", D, "t", t);
    expect(t.map((x) => x.outcome)).toEqual(["permitido", "negado"]);
    const a = await calculationAudit("NEED_METHODOLOGY", 1, { x: 1 }, "t");
    expect(a.inputsSha256).toHaveLength(64);
    expect(JSON.stringify(a)).not.toContain("\"x\"");
  });
  it("RLS de vínculos funcionais compara com a linha da tabela (0383)", () => {
    const f = readdirSync("drizzle/migrations").find((n) => n.startsWith("0383_"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).toContain("p.functional_link_logical_id = professional_functional_links.logical_id");
  });
});
