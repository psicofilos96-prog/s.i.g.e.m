import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeResult, validResultInput } from "./individual-result";

const sql = readFileSync("drizzle/migrations/0471_enr18_individual_results.sql", "utf8");
const fn = sql.slice(sql.indexOf("FUNCTION public.enr_public_application_result"));

describe("L18 resultado individual", () => {
  it("entrada inválida e situação desconhecida caem em indisponível", () => {
    expect(validResultInput("INS-0123456789", "abcdefabcdef")).toBe(true);
    expect(validResultInput("Maria", "x")).toBe(false);
    expect(normalizeResult({ status: "ok", situation: "aprovado-secreto" as never }).status).toBe("indisponivel");
    expect(normalizeResult(null).status).toBe("indisponivel");
  });
  it("devolve uma linha mínima: sem nome, CPF, posição de terceiros ou lista", () => {
    expect(fn.match(/RETURNS TABLE\(([^)]*)\)/)![1]).toBe("status text, situation text, cell text, deadline timestamptz, justification text, next_step text");
    expect(fn).not.toMatch(/requester_name|student_name|cpf_hmac|RETURN QUERY SELECT[^;]*FROM jsonb_array_elements/);
    expect((fn.match(/'indisponivel'/g) ?? []).length).toBe(2);
  });
  it("justificativa só de texto aprovado; texto-modelo não carrega dado individual", () => {
    expect(fn).toMatch(/JOIN public\.enr_result_notice_approvals ap ON ap\.notice_id = n\.id/);
    expect(fn).toMatch(/'texto-nao-autorizado'/);
    expect(sql).toMatch(/'texto-com-dado-individual'/);
    expect(sql).toMatch(/_n\.author_person = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'/);
  });
  it("situação só de fontes canônicas: distribuição publicada, reservas e itens do motor", () => {
    expect(fn).toMatch(/ORDER BY e\.seq DESC LIMIT 1\) = 'publicar'/);
    expect(fn).toMatch(/FROM public\.enr_seat_events r JOIN public\.enr_seat_pools p/);
    expect(sql).not.toMatch(/CREATE TABLE public\.enr_results\b/);
  });
  it("anon só executa a consulta individual", () => {
    expect((sql.match(/TO anon/g) ?? []).length).toBe(1);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.enr_public_application_result\(text,text\) TO anon, authenticated;/);
  });
});
