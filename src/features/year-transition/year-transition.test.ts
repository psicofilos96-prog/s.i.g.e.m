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

describe("contrato SQL 0115–0117 (fechamento S.1)", () => {
  const s115 = readFileSync("drizzle/migrations/0115_0115_s1_close_policy_v6_school_writers.sql", "utf8");
  const s117 = readFileSync("drizzle/migrations/0117_0117_s_tables_acl_hardening.sql", "utf8");
  const dbt = readFileSync("supabase/tests/s_year_transition_exact_lookup.sql", "utf8");
  it("cadastro de aluno nasce de capability escolar, não de rede", () => {
    const f = s115.slice(s115.indexOf("FUNCTION public.register_student_for_school"), s115.indexOf("REVOKE ALL ON FUNCTION public.register_student_for_school"));
    expect(f).toContain("has_school_capability('cadastrar-estudante-na-escola', _school)");
    expect(f).not.toContain("has_network_capability");
    expect(s115).toContain("REVOKE ALL ON FUNCTION public.register_student_with_exact_identity(text, text, text) FROM authenticated");
  });
  it("lotação escolar não toca registro funcional nem regência", () => {
    const f = s115.slice(s115.indexOf("FUNCTION public.record_school_staff_presence"), s115.indexOf("REVOKE ALL ON FUNCTION public.record_school_staff_presence"));
    expect(f).not.toMatch(/INSERT INTO public\.(professional_functional_links|professional_postings|teaching_assignment)/);
  });
  it("v6 é delta explícito sem curinga e sem poder central para a escola", () => {
    expect(s115).toMatch(/_delta <> 10/);
    expect(s115).not.toMatch(/'secretaria-escolar','(manter-registro-funcional|preparar-ano-letivo|cadastrar-estudante-na-rede)'/);
    expect(s115).toContain("('administrador-geral-do-sigem','preparar-ano-letivo',ARRAY['network'])");
  });
  it("tabelas novas sem privilégio herdado", () => {
    for (const t of ["year_transition_decisions", "school_staff_presence", "student_registration_events", "exact_lookup_events"])
      expect(s117).toContain(`REVOKE ALL ON public.${t} FROM anon, authenticated, service_role`);
  });
  it("teste DB termina em RAISE (sem resíduo) e usa só dados sintéticos", () => {
    expect(dbt).toContain("RAISE EXCEPTION 's-tests-ok: %'");
    expect(dbt).not.toMatch(/inep-33\d{6}/);
  });
});
