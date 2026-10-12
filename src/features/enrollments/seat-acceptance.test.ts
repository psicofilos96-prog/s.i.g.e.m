import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0472_enr19_confirmation_validation.sql", "utf8");
const val = sql.slice(sql.indexOf("FUNCTION public.record_enr_admin_validation"), sql.indexOf("FUNCTION public.enr_link_formalized_enrollment"));
const link = sql.slice(sql.indexOf("FUNCTION public.enr_link_formalized_enrollment"));

describe("L19 confirmação e formalização", () => {
  it("aceite só de reserva ativa, sob lock do quadro, idempotente por reserva, falha uniforme", () => {
    expect(sql).toMatch(/hold_id uuid PRIMARY KEY,\n  application_id uuid NOT NULL REFERENCES public\.enr_applications/);
    expect(sql).toMatch(/FROM public\.enr_seat_pools sp WHERE sp\.id = _r\.pool_id FOR UPDATE/);
    expect(sql).toMatch(/_r\.expires_at <= now\(\) THEN\n    RETURN QUERY SELECT 'reserva-nao-ativa'/);
  });
  it("validação exige aceite, motivo e confirma pelo writer canônico na mesma transação", () => {
    expect(val).toMatch(/'sem-aceite-da-familia'/);
    expect(val).toMatch(/public\.enr_seat_close\(_hold, 'confirmar'/);
    expect(val).toMatch(/receipt_hash/);
    expect(sql).toMatch(/enr_admin_validations_one_ok ON public\.enr_admin_validations\(hold_id\) WHERE outcome = 'validado'/);
  });
  it("nenhuma matrícula é criada aqui; só vínculo à matrícula vigente da Secretaria, posterior à validação, na escola da vaga", () => {
    expect(sql).not.toMatch(/INSERT INTO public\.school_enrollments|INSERT INTO public\.class_enrollment_episodes|INSERT INTO public\.institutional_students/);
    expect(link).toMatch(/'vaga-nao-validada'/);
    expect(link).toMatch(/'matricula-de-outra-escola'/);
    expect(link).toMatch(/'matricula-nao-vigente'/);
    expect(link).toMatch(/'matricula-anterior-a-validacao'/);
    expect(link).toMatch(/school_capability_schools\('formalizar-matricula-de-ingresso'\)/);
    expect(sql).toMatch(/enrollment_id text NOT NULL UNIQUE REFERENCES public\.school_enrollments\(id\)/);
  });
  it("anon só registra o aceite; tabelas sem DML direta", () => {
    expect((sql.match(/TO anon/g) ?? []).length).toBe(1);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_family_acceptances, public\.enr_admin_validations, public\.enr_formalization_links FROM authenticated, anon/);
  });
});
