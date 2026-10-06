import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { findConversion, hasSensitive, isOperational, pendingReview, summarize, PLANNING_TABS, type MasterRow } from "./planning-model";

const dir = "drizzle/migrations";
const sql = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.startsWith("0182_"))}`, "utf8");
const writer = sql.slice(sql.indexOf("CREATE FUNCTION public.record_meal_master"), sql.indexOf("-- 5 —"));
const row = (o: Partial<MasterRow>): MasterRow => ({ logical_id: "x", version: 1, status: "rascunho", school_id: null, valid_from: "2027-01-01", valid_to: null, payload: {}, author_person_id: "p", recorded_at: "", functional_validation: null, ...o });

describe("NAE.1 — SQL governado", () => {
  it("versão/retificação/stale e cadeia rascunho→conferida→homologada com segregação", () => {
    expect(writer).toContain("'meal:stale'");
    expect(writer).toContain("head.status <> 'rascunho'");
    expect(writer).toContain("head.status <> 'conferida'");
    expect((writer.match(/self-review-not-allowed/g) ?? []).length).toBe(2);
    expect(writer).toContain("'conferir-conteudo-tecnico-alimentar'");
    expect(writer).toContain("'homologar-conteudo-tecnico-alimentar'");
    expect(writer).toContain("af_natural_person()");
  });
  it("item sem unidade homologada e conversão ausente são recusados; nada presumido", () => {
    expect(sql).toMatch(/'apresentacao-embalagem'.*unidade_ref:unidade-de-medida/);
    expect(sql).toMatch(/'parametro-per-capita'.*unidade_ref:unidade-de-medida/);
    expect(writer).toContain("reference-not-homologated");
    expect(writer).toContain("conversion-same-unit");
    expect(sql).not.toMatch(/DEFAULT\s+\d/);
    expect(sql).not.toMatch(/INSERT INTO public\.meal_master_records\(kind[^;]*VALUES \('/);
  });
  it("cardápio especial não aceita identificação nem diagnóstico; instrução sensível tem trilha", () => {
    expect(writer).toContain("sensitive-field-not-allowed");
    expect(sql).toMatch(/dietary_restriction_instructions[\s\S]*INSERT INTO public\.meal_sensitive_access_events/);
  });
  it("leitura: rascunho só para quem mantém/confere/homologa; escola não edita catálogo", () => {
    expect(sql).toContain("h.status = 'homologada' OR (coalesce(_include_drafts,false) AND maint)");
    expect(sql).toMatch(/meal_network_grant_on\(sp\.capability, _from\)/);
    expect(writer).not.toContain("meal_grant_on(");
  });
  it("staging idempotente por hash/contexto, conflito fail-closed, aplicação só cria rascunho", () => {
    expect(sql).toContain("UNIQUE (kind, context_key, sha256)");
    expect(sql).toContain("'meal:staging-conflict'");
    expect(sql).toContain("'meal:staging-not-reviewed'");
    expect(sql).toMatch(/record_meal_master\(st\.kind, NULL, NULL, 'registro'/);
  });
  it("tabelas append-only, sem DML para app roles", () => {
    for (const t of ["meal_master_records", "meal_content_stagings", "meal_content_staging_events", "meal_sensitive_access_events"]) {
      expect(sql).toContain(`${t}_append_only`);
    }
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON\s+(TABLE\s+)?public\./i);
    expect(sql).not.toMatch(/TO (anon|PUBLIC)/);
  });
});

describe("NAE.1 — modelo", () => {
  it("rascunho não é operacional/publicado", () => {
    expect(isOperational(row({ status: "rascunho" }))).toBe(false);
    expect(isOperational(row({ status: "conferida" }))).toBe(false);
    expect(isOperational(row({ status: "homologada" }))).toBe(true);
  });
  it("conversão ausente, não homologada ou inversa não é presumida", () => {
    const c = row({ status: "homologada", payload: { de_unidade_ref: "kg", para_unidade_ref: "g", fator: 1000 } });
    expect(findConversion([c], "kg", "g")).toBe(1000);
    expect(findConversion([c], "g", "kg")).toBe("BLOCKED_BY_HOMOLOGATED_RULE");
    expect(findConversion([{ ...c, status: "conferida" }], "kg", "g")).toBe("BLOCKED_BY_HOMOLOGATED_RULE");
  });
  it("resumo nunca expõe JSON nem campo sensível; pendências", () => {
    expect(summarize(row({ payload: { diagnostico: "x" } }))).toBe("Sem rótulo declarado");
    expect(hasSensitive({ diagnostico: "x" })).toBe(true);
    expect(pendingReview([row({}), row({ status: "homologada" })]).length).toBe(1);
    expect(PLANNING_TABS.map((t) => t.label)).toEqual(["Catálogos", "Cardápios", "Fichas Técnicas", "Parâmetros", "Especiais", "Inspetores", "Documentos", "Pendências de Homologação"]);
  });
});
