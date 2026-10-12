import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bytesFromMb, groupAccess, policyDraftProblems, type AccessRow } from "./archive-core";

const sql = readFileSync("drizzle/migrations/0499_acv02_members_policy_cleanup.sql", "utf8");
const row = (p: Partial<AccessRow>): AccessRow => ({ acl_id: "a", node_id: "n", inherited: false, person_id: "p", principal_id: null, display_name: "X", role: "visualizar", granted_at: "", ...p });

describe("ACV.2 acervo — membros, herança, política, limpeza", () => {
  it("herança: diretos separados; por pessoa vale o maior papel herdado", () => {
    const g = groupAccess([row({ acl_id: "1" }), row({ acl_id: "2", inherited: true, role: "visualizar" }), row({ acl_id: "3", inherited: true, role: "editar" })]);
    expect(g.direct.map((r) => r.acl_id)).toEqual(["1"]);
    expect(g.inherited.map((r) => r.acl_id)).toEqual(["3"]);
  });
  it("política: cota em MB, fonte e justificativa obrigatórias", () => {
    expect(bytesFromMb("10")).toBe(10485760);
    expect(bytesFromMb("")).toBeNull();
    expect(policyDraftProblems({ quotaMb: "0", retention: "x", source: "", reason: "" })).toHaveLength(4);
    expect(policyDraftProblems({ quotaMb: "", retention: "", source: "Decisão 1", reason: "Cota da secretaria" })).toEqual([]);
  });
  it("aprovação exige permissão da rede e pessoa diferente do autor; só a última versão", () => {
    expect(sql).toMatch(/has_network_capability\('aprovar-politica-do-acervo'\)/);
    expect(sql).toMatch(/aprovador-igual-autor/);
    expect(sql).toMatch(/versao-superada/);
  });
  it("retenção nunca elimina: nenhum DELETE de nó, versão ou evento", () => {
    expect(sql).not.toMatch(/DELETE FROM public\.acv_/i);
  });
  it("cota direta sem aprovação deixa de ser caminho", () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.acv_set_quota\(uuid, bigint, text\) FROM authenticated/);
  });
  it("limpeza remove só objeto de reserva expirada nunca confirmada, pelo administrador do espaço", () => {
    expect(sql).toMatch(/interval '24 hours'/);
    expect(sql).toMatch(/FOR DELETE TO authenticated\s+USING \(bucket_id = 'acervo-documental' AND public\.acv_orphan_removable\(name\)\)/);
    const fn = sql.slice(sql.indexOf("FUNCTION public.acv_orphan_removable"));
    expect(fn).toMatch(/status = 'expirado'/);
    expect(fn).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.acv_file_versions/);
    expect(fn).toMatch(/acv_space_rank\(u\.space_id\) >= 7/);
  });
  it("busca de pessoas só para quem compartilha, com mínimo de 3 letras e limite", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION public.acv_eligible_people"), sql.indexOf("FUNCTION public.acv_node_access"));
    expect(fn).toMatch(/acv_space_rank\(_space\) < 6 OR length\(_q\) < 3/);
    expect(fn).toMatch(/LIMIT 20/);
  });
  it("provisionamento exige permissão da rede e conta de setor não revogada", () => {
    expect(sql).toMatch(/has_network_capability\('provisionar-acervo-documental'\)/);
    expect(sql).toMatch(/institutional_sector_principal_revocations/);
  });
});
