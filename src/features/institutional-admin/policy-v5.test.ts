import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0096_capability_policy_v5_advanced_layers.sql", "utf8");
const ADVANCED = [
  "administrar-integracoes", "consultar-banco-de-itens", "consultar-instrumento-docente", "consultar-planejamento-docente",
  "gerir-base-de-conhecimento", "gerir-tarefas-operacionais", "homologar-definicoes-de-workflow", "manter-definicoes-de-workflow",
  "publicar-conteudo-publico", "revisar-qualidade-dos-dados",
];
const delta = [...sql.matchAll(/\('([a-z-]+)','([a-z-]+)',ARRAY\['(\w+)'\]\)/g)].map((m) => ({ kind: m[1]!, cap: m[2]!, dim: m[3]! }));

describe("política v5 (0096)", () => {
  it("delta = 26 regras explícitas, v4+delta = 239/95, sem curinga nem cargo textual", () => {
    expect(delta).toHaveLength(26);
    expect(sql).toMatch(/<> 239/); expect(sql).toMatch(/<> 95/); expect(sql).toMatch(/<> 213/);
    expect(delta.every((d) => !/[*%]/.test(d.kind + d.cap))).toBe(true);
    expect(sql).not.toMatch(/position_label/);
  });
  it("Administrador Geral recebe as 10 capabilities em rede", () => {
    const a = delta.filter((d) => d.kind === "administrador-geral-do-sigem");
    expect(a.map((d) => d.cap).sort()).toEqual([...ADVANCED].sort());
    expect(a.every((d) => d.dim === "network")).toBe(true);
  });
  it("workflow/integrações/base de conhecimento ficam só no mestre, por reserva explícita", () => {
    for (const c of ["manter-definicoes-de-workflow", "homologar-definicoes-de-workflow", "administrar-integracoes", "gerir-base-de-conhecimento"]) {
      expect(delta.filter((d) => d.cap === c).map((d) => d.kind)).toEqual(["administrador-geral-do-sigem"]);
      expect(sql).toMatch(new RegExp(`\\('${c}','decisao-do-proprietario'`));
    }
  });
  it("homologação canônica: issues checadas, decisão do proprietário, sem ato, vigência 2026-10-05, nenhuma perda da v4", () => {
    expect(sql).toMatch(/capability_policy_homologation_issues\(_v5, DATE '2026-10-05'\)/);
    expect(sql).toMatch(/homologation_act_ref = NULL/);
    expect(sql).toMatch(/homologation_origin = 'decisao-do-proprietario', valid_from = DATE '2026-10-05'/);
    expect(sql).toMatch(/a\.policy_id = _v4 AND NOT EXISTS/);
  });
});
