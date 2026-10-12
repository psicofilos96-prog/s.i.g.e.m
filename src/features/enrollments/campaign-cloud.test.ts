import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { nextState, TRANSITIONS } from "./campaign-cloud";

const m0455 = readFileSync("drizzle/migrations/0455_enr03_campaigns_persisted.sql", "utf8");
const m0456 = readFileSync("drizzle/migrations/0456_enr03_campaign_school_keys.sql", "utf8");

describe("Matrículas L03 — campanhas persistidas", () => {
  it("publicação só a partir de autorizada; rascunho nunca publica direto", () => {
    expect(nextState("rascunho", "publicar")).toBeNull();
    expect(nextState("revisao", "publicar")).toBeNull();
    expect(nextState("autorizada", "publicar")).toBe("publicada");
    expect(nextState("encerrada", "retomar")).toBeNull();
  });
  it("cada transição do TS existe no writer com a mesma capacidade", () => {
    for (const [a, t] of Object.entries(TRANSITIONS)) {
      expect(m0455).toContain(`_action='${a}'`);
      expect(m0455).toContain(t.capability);
    }
  });
  it("autorização exige pessoa ≠ autor/remetente e edital assinado do SIGEM Documentos", () => {
    expect(m0455).toContain("enr:self-authorization");
    expect(m0455).toContain("enr:edital-required");
    expect(m0455).toMatch(/admin_act_signatures s WHERE s\.act_version_id = _v\.edital_act_version_id/);
    expect(m0455).toContain("enr:not-authorized-version");
  });
  it("tabelas append-only, sem DML direta, sem anon; escola vem do cadastro canônico", () => {
    expect(m0455.match(/doc_numbering_append_only\(\)/g)?.length).toBe(3);
    expect(m0455).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_campaigns.*FROM authenticated, anon/);
    expect(m0455).not.toMatch(/TO anon/);
    expect(m0456).toContain("institutional_school_record_versions x WHERE x.school_id = s");
    expect(m0455).toContain("enr:stale-seq");
  });
});
