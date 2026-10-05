import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  candidateState, expectedSequence, normalizeProfessionalLookup, normalizeStudentLookup,
  reasonRequired, resolveReadingYear, summaryConsistent, transitionError, type Candidate,
} from "./year-transition";

const sql = readFileSync("drizzle/migrations/0113_0113_s2_s4_year_transition_exact_lookup.sql", "utf8");
const base: Candidate = { student_id: "est-1", display_name: "X", decision: null, decision_sequence: null, resulting_enrollment_id: null };

describe("transição anual — modelo", () => {
  it("sem decisão é pendente; nada é inferido", () => {
    expect(candidateState(base)).toBe("pendente");
    expect(expectedSequence(base)).toBe(0);
    expect(reasonRequired(base)).toBe(false);
  });
  it("retificação exige motivo e usa a sequência vigente", () => {
    const c = { ...base, decision: "nao-renovou" as const, decision_sequence: 2 };
    expect(candidateState(c)).toBe("nao-renovou");
    expect(expectedSequence(c)).toBe(2);
    expect(reasonRequired(c)).toBe(true);
  });
  it("indicadores fecham: candidatos = soma das situações", () => {
    expect(summaryConsistent({ candidatos: 4, renovados: 1, transferidos_saidas: 1, nao_renovados: 1, pendentes: 1, novos_alunos: 0, matriculas_ano_destino: 1, turmas_ano_destino: 0, alunos_sem_turma: 1, servidores_lotados_ano_destino: 0, servidores_observados_baseline: 0 })).toBe(true);
  });
  it("nunca há fallback de ano", () => {
    expect(resolveReadingYear(undefined, ["2026", "2027"])).toBeNull();
    expect(resolveReadingYear("2025", ["2026", "2027"])).toBeNull();
    expect(resolveReadingYear("2027", ["2026", "2027"])).toBe("2027");
  });
  it("erros nunca ecoam valores", () => {
    expect(transitionError("ERROR: identity:conflict 12345678901")).not.toMatch(/\d{11}/);
    expect(transitionError("qualquer")).toBe("Não foi possível concluir. Nada foi alterado.");
  });
});

describe("busca ativa exata — sem nome, prefixo ou diretório", () => {
  it("aluno: só CPF completo ou INEP de 12 dígitos", () => {
    expect(normalizeStudentLookup("cpf", "123.456.789-09")).toBe("12345678909");
    expect(normalizeStudentLookup("cpf", "123")).toBeNull();
    expect(normalizeStudentLookup("inep", "123456789012")).toBe("123456789012");
    expect(normalizeStudentLookup("cpf", "Maria")).toBeNull();
    expect(normalizeStudentLookup("inep", "Ana 123456789012")).toBeNull();
  });
  it("servidor: código exato, nunca nome", () => {
    expect(normalizeProfessionalLookup("12345-6")).toBe("12345-6");
    expect(normalizeProfessionalLookup("João Silva")).toBeNull();
    expect(normalizeProfessionalLookup("")).toBeNull();
  });
});

describe("contrato SQL 0113", () => {
  it("busca usa igualdade exata e nunca LIKE/ILIKE/similaridade", () => {
    expect(sql).not.toMatch(/\bI?LIKE\b|similarity|%>|unaccent/i);
  });
  it("trilha de busca não guarda o valor pesquisado", () => {
    const table = sql.slice(sql.indexOf("CREATE TABLE public.exact_lookup_events"), sql.indexOf("COMMENT ON TABLE public.exact_lookup_events"));
    expect(table).not.toMatch(/\bvalue\b/);
  });
  it("writers exigem sessão com pessoa e capability; nada para anon/service_role", () => {
    for (const fn of ["record_year_transition_decision", "enroll_student_in_school_year", "locate_student_exact", "locate_professional_exact", "register_student_with_exact_identity"]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, service_role`));
    }
    expect(sql.match(/session:person-required/g)!.length).toBeGreaterThanOrEqual(5);
  });
  it("transferência nunca é silenciosa e renovação não copia turma", () => {
    expect(sql).toContain("enrollment:active-elsewhere-requires-transfer");
    expect(sql).not.toMatch(/INSERT INTO public\.class_enrollment_episodes/);
  });
  it("conflito de identidade falha fechado; sem merge", () => {
    expect(sql).toContain("identity:conflict");
    expect(sql).not.toMatch(/UPDATE public\.institutional_(persons|students|student_persons)/);
  });
  it("matrícula pela transição não deriva data do calendário", () => {
    expect(sql).not.toMatch(/calendar_/);
  });
  it("decisões são append-only e retificação exige motivo", () => {
    expect(sql).toContain("year_transition_decisions_immutable");
    expect(sql).toContain("transition:rectification-reason-required");
    expect(sql).toContain("transition:stale-base");
  });
  it("baseline profissional 2026 não inventa início, cargo nem regência", () => {
    const f = sql.slice(sql.indexOf("professional_school_observations_2026"));
    expect(f).toContain("false");
    expect(f.slice(0, 1200)).not.toMatch(/valid_from|regencia|position_id/);
  });
  it("anti-enumeração por limite de buscas", () => {
    expect(sql).toContain("lookup:rate-limited");
  });
});
