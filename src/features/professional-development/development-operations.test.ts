// Lote 19 — telas operacionais do Desenvolvimento: só writers existentes, frequência derivada, certificado só após validação.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEVELOPMENT_STAGES } from "./development-operations.gen";
import { certificatePdfOffered, issueProblems } from "./certificates";
import { requiresSessionBeforeRead } from "@/features/authority/session-read-gate";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const actions = DEVELOPMENT_STAGES.flatMap((s) => s.actions);

describe("operação do Desenvolvimento", () => {
  it("cobre as 12 áreas pedidas", () => {
    expect(DEVELOPMENT_STAGES.map((s) => s.id)).toEqual(["catalogo", "inscricoes", "turmas", "formadores", "frequencia", "avaliacoes",
      "conclusao", "certificados", "externa", "pdi", "questionarios", "indicadores"]);
  });
  it("toda ação aponta para writer que existe no banco", () => {
    for (const a of actions) expect(types.includes(`      ${a.rpc}: {`), a.rpc).toBe(true);
  });
  // _min_pct é mínimo configurado (norma aprovada), não frequência medida.
  it("nenhum campo de percentual digitado; participação manda _pct nulo", () => {
    for (const a of actions) expect(a.fields.some((f) => !f.arg.startsWith("_min_") && /pct|percent/i.test(f.arg)), a.rpc).toBe(false);
    expect(actions.find((a) => a.rpc === "record_dev_participation")?.fixed).toEqual({ _pct: null });
  });
  it("banco recusa percentual informado (0505)", () => {
    const sql = readFileSync("drizzle/migrations/0505_dev19_participation_pct_derived_only.sql", "utf8");
    expect(sql).toContain("IF _pct IS NOT NULL THEN RAISE EXCEPTION 'dev:pct-derived-only'");
  });
  it("conclusão é apurada pelo banco, nunca gravada pela tela", () => {
    expect(actions.map((a) => a.rpc)).toContain("assess_dev_completion");
    expect(actions.map((a) => a.rpc)).not.toContain("issue_dev_certification");
  });
  it("certificado: sem validação não emite e PDF só vale emitido e vigente", () => {
    expect(issueProblems({ validated: false, isLatest: true, pdfShaNow: "a", pdfShaVersion: "a", hasPrevious: false, reason: null }))
      .toContain("Sem validação humana: não emite");
    expect(certificatePdfOffered("valido")).toBe(true);
    for (const s of ["revogado", "substituido", "nao-encontrado"] as const) expect(certificatePdfOffered(s)).toBe(false);
  });
  it("tela não lê antes da sessão", () => {
    expect(requiresSessionBeforeRead("/sigem-desenvolvimento/operacao")).toBe(true);
  });
});
