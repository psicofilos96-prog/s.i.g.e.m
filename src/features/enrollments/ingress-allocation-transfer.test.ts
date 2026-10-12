import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0473_enr20_allocation_transfer.sql", "utf8");
const alloc = sql.slice(sql.indexOf("FUNCTION public.enr_allocate_formalized"), sql.indexOf("FUNCTION public.record_enr_transfer_event"));
const tr = sql.slice(sql.indexOf("FUNCTION public.record_enr_transfer_event"));

describe("L20 enturmação e transferência do ingresso", () => {
  it("enturmação só pelo writer canônico, após matrícula formalizada, uma por reserva", () => {
    expect(alloc).toMatch(/public\.secretariat_allocate_to_class\(_enr, _class, _valid_from, _reason\)/);
    expect(alloc).toMatch(/'matricula-nao-formalizada'/);
    expect(alloc).toMatch(/'ja-enturmado-pelo-ingresso'/);
  });
  it("nada é inserido/alterado direto nas tabelas acadêmicas canônicas", () => {
    expect(sql).not.toMatch(/(INSERT INTO|UPDATE|DELETE FROM) public\.(school_enrollments|school_enrollment_endings|class_enrollment_episodes|class_enrollment_episode_endings|cycle_participations)/);
  });
  it("transferência: análise → autorização (≠ analista, ato, vaga validada) → efetivação pelo writer da Secretaria", () => {
    expect(tr).toMatch(/'autorizar-exige-analise'/);
    expect(tr).toMatch(/_last\.person_id = _p THEN RAISE EXCEPTION 'autorizador-igual-analista'/);
    expect(tr).toMatch(/'vaga-de-destino-nao-validada'/);
    expect(tr).toMatch(/'efetivar-exige-autorizacao'/);
    expect(tr).toMatch(/public\.secretariat_record_exit\(_origin, _effective_on, _movement_type, _type_version, _school/);
    expect(sql).toMatch(/CHECK \(action <> 'efetivar' OR exit_ref IS NOT NULL\)/);
  });
  it("origem: matrícula vigente do estudante reconciliado, em outra escola; concorrência por seq e lock", () => {
    expect(tr).toMatch(/'estudante-nao-reconciliado'/);
    expect(tr).toMatch(/'origem-de-outro-estudante'/);
    expect(tr).toMatch(/'origem-igual-destino'/);
    expect(tr).toMatch(/'origem-nao-vigente'/);
    expect(tr).toMatch(/FROM public\.enr_applications a WHERE a\.id = _app FOR UPDATE/);
    expect(tr).toMatch(/'sequencia-desatualizada'/);
  });
  it("sem acesso anônimo; ledger append-only sem DML direta", () => {
    expect(sql).not.toMatch(/TO anon/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_allocation_links, public\.enr_transfer_events FROM authenticated, anon/);
    expect(sql).toMatch(/enr_transfer_append_only BEFORE UPDATE OR DELETE/);
  });
});
