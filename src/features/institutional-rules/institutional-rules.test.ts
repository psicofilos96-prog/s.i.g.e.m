import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categorize } from "@/lib/observability/governed-errors";
import { RULE_DOMAINS, classifyReadError, domainSummary, expectedHead, stateLabel } from "./institutional-rules-model";

const sql = readFileSync("drizzle/migrations/0203_bt_institutional_rule_writers.sql", "utf8") + readFileSync("drizzle/migrations/0204_bt_institutional_rule_core_split.sql", "utf8");

describe("BT — regras institucionais", () => {
  it("cobre exatamente os seis domínios com writers próprios", () => {
    expect(RULE_DOMAINS.map((d) => d.id).sort()).toEqual(["calculo-frequencia", "configuracao-colegiado", "correcao-avaliacao", "correcao-diario", "fechamento-ciclo", "tipo-ocorrencia-frequencia"]);
    for (const d of RULE_DOMAINS) {
      expect(sql).toContain(`FUNCTION public.${d.draftRpc}(`);
      expect(sql).toContain(`FUNCTION public.${d.homologateRpc}(`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${d.draftRpc}(`);
    }
  });
  it("reutiliza as capacidades já usadas por colegiado e encerramento", () => {
    expect(RULE_DOMAINS.find((d) => d.id === "configuracao-colegiado")?.homologateCapability).toBe("homologar-colegiado");
    expect(RULE_DOMAINS.find((d) => d.id === "fechamento-ciclo")?.configureCapability).toBe("configurar-encerramento");
  });
  it("não concede capacidade, não cria policy nem DML direto para app", () => {
    expect(sql).not.toMatch(/INSERT INTO public\.capability_polic/i);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated)/i);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*_core\(/);
    expect(sql).not.toMatch(/SECURITY DEFINER SET search_path = 'public'/);
  });
  it("acesso negado e falha nunca viram 'não configurado'", () => {
    expect(domainSummary(classifyReadError("institutional-rule:access-denied"))).toMatch(/Acesso negado/);
    expect(domainSummary(classifyReadError("session:required"))).toMatch(/Entre/);
    expect(domainSummary(classifyReadError("boom"))).toMatch(/Não foi possível/);
    expect(domainSummary({ kind: "lido", rows: [] })).toMatch(/Não configurado/);
  });
  it("estado desconhecido aparece por extenso", () => {
    expect(stateLabel("vigente")).toBe("Homologada e vigente");
    expect(stateLabel("xyz")).toMatch(/não reconhecido/);
  });
  it("base esperada = maior versão do identificador", () => {
    const row = (logicalId: string, version: number) => ({ logicalId, version, state: "rascunho", validFrom: null, validUntil: null, payload: {}, reason: "m", recordedAt: "", homologatedAt: null });
    expect(expectedHead([row("a", 1), row("a", 3), row("b", 9)], "a")).toBe(3);
    expect(expectedHead([], "a")).toBe(0);
  });
  it("erros do banco viram mensagens governadas específicas", () => {
    expect(categorize(new Error("institutional-rule:capability-missing:configurar-colegiado"))).toBe("autorizacao");
    expect(categorize(new Error("institutional-rule:stale-head"))).toBe("conflito");
    expect(categorize(new Error("policy-not-homologated"))).toBe("dependencia-normativa");
  });
});
