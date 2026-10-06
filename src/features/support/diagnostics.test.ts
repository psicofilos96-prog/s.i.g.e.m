import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categorize, governError, newCorrelationId } from "@/lib/observability/governed-errors";
import { BLOCKED_DEPENDENCIES, CANONICAL_PROJECT_REF, actorKind, environmentCheck, migrationsCheck, recentTechFailures, recordTechFailure } from "./diagnostics-model";
// @ts-expect-error módulo .mjs sem tipos
import { CANONICAL_PROJECT_REF as GATE_REF } from "../../../scripts/environment-gate.mjs";

describe("AV — erros governados", () => {
  it("categorias distintas", () => {
    expect(categorize(new Error("class:base-superseded"))).toBe("conflito");
    expect(categorize({ code: "42501", message: "permission denied" })).toBe("autorizacao");
    expect(categorize(new Error("regra-institucional-pendente"))).toBe("dependencia-normativa");
    expect(categorize(new Error("BLOCKED_BY_SOURCE layout-missing"))).toBe("fonte-ausente");
    expect(categorize({ code: "23505", message: "x" })).toBe("validacao");
    expect(categorize(new Error("boom"))).toBe("falha-tecnica");
  });
  it("mensagem uniforme: negado e inexistente iguais, sem detalhe interno", () => {
    const a = governError(new Error("family:not-authorized"));
    const b = governError(new Error("access-denied: student 123 not found"));
    expect(a.userMessage).toBe(b.userMessage);
    expect(a.userMessage).not.toMatch(/123|student|sql|select/i);
  });
  it("technical é sanitizado (CPF, e-mail, token)", () => {
    const g = governError(new Error("cpf 529.982.247-25 ana@x.gov.br Bearer abc.def"));
    for (const leak of ["529.982.247-25", "ana@x.gov.br", "abc.def"]) expect(g.technical).not.toContain(leak);
  });
  it("correlation id aleatório e sem conteúdo", () => {
    const a = newCorrelationId(), b = newCorrelationId();
    expect(a).toMatch(/^op-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe("AV — diagnóstico", () => {
  it("ambiente canônico coincide com o gate de scripts", () => {
    expect(CANONICAL_PROJECT_REF).toBe(GATE_REF);
    expect(environmentCheck(CANONICAL_PROJECT_REF).state).toBe("ok");
    expect(environmentCheck("vwhvqtdvzbnfffkgoaen").state).toBe("falha");
    expect(environmentCheck(undefined).state).toBe("falha");
  });
  it("migrations: aplicação nunca é afirmada pela tela", () => {
    expect(migrationsCheck(["/drizzle/migrations/0001_a.sql", "/drizzle/migrations/0178_b.sql"]).state).toBe("nao-verificavel");
  });
  it("falhas guardam só fonte/categoria/horário/código", () => {
    recordTechFailure({ at: "t", source: "s", category: "falha-tecnica", correlationId: "op-1", ...({ message: "cpf 1" } as object) });
    expect(Object.keys(recentTechFailures()[0]!).sort()).toEqual(["at", "category", "correlationId", "source"]);
  });
  it("executor técnico nunca é pessoa", () => {
    expect(actorKind({ technicalOperationId: "x" })).toBe("executor-tecnico");
    expect(actorKind({})).toBe("desconhecido");
  });
  it("monitoramento externo declarado pendente", () => {
    expect(BLOCKED_DEPENDENCIES.map((b) => b.id)).toContain("EXTERNAL_MONITORING_PROVIDER_PENDING");
  });
  it("página exige Administrador Geral e não tem SQL/escrita", () => {
    const src = readFileSync("src/features/support/support-page.tsx", "utf8");
    expect(src).toContain('admin.status !== "general-admin"');
    expect(src).not.toMatch(/\.(insert|update|delete|upsert)\(|execute_sql|service_role|client\.server/);
  });
});
