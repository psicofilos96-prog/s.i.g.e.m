import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITUATIONS } from "./model";

/**
 * Prova estática de barreiras: execução SQL real exige banco efêmero com migrations.
 * A prova SQL negativa separada vive em supabase/tests/0613_school_institutional_followup.sql.
 */
const sql = readFileSync("drizzle/migrations/0613_school_institutional_followup.sql", "utf8");
const negative = readFileSync("supabase/tests/0613_school_institutional_followup.sql", "utf8");

describe("acompanhamento institucional — contrato SQL", () => {
  it("não expõe tabelas do acompanhamento a clientes", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.school_institutional_followup_visits,/);
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated, service_role/);
    for (const table of ["visits", "actions", "updates"]) {
      expect(sql).toContain(`ALTER TABLE public.school_institutional_followup_${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).not.toMatch(new RegExp(`GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON public\\.school_institutional_followup_${table} TO authenticated`));
    }
  });
  it("garante consulta e gravação por capacidades distintas", () => {
    expect(sql).toContain("consultar-acompanhamento-institucional");
    expect(sql).toContain("registrar-acompanhamento-institucional");
    expect(sql).not.toContain("al_supervision_grant(");
    expect(sql).not.toContain("GRANT EXECUTE ON FUNCTION public.school_institutional_followup_grant");
    expect(sql).toMatch(/auth\.uid\(\) IS NULL/);
    expect(sql).toContain("p.actor_nature = 'pessoa-natural'");
  });
  it("fecha o leque de situações no SQL, igual à interface", () => {
    for (const status of SITUATIONS) {
      expect(sql).toContain(`'${status.value}'`);
    }
    expect(sql).toMatch(/situation text NOT NULL CHECK \(situation IN/);
    expect(sql).toContain("followup:situation-invalid");
  });
  it("opera visita e plano atomica e idempotentemente", () => {
    expect(sql).toContain("CREATE FUNCTION public.record_school_institutional_followup_bundle(");
    expect(sql).toContain("pg_catalog.jsonb_array_length(");
    expect(sql).toContain("followup:too-many-actions");
    expect(sql).toContain("followup:action-description-required");
    expect(sql).toContain("ON CONFLICT (request_key) DO NOTHING");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.record_school_institutional_followup_bundle");
  });
  it("preserva autoria autenticada separada de participantes e objetivo declarados", () => {
    expect(sql).toContain("participants_note text CHECK");
    expect(sql).toContain("purpose_note text CHECK");
    expect(sql).toContain("old.participants_note IS NOT DISTINCT FROM");
    expect(sql).toContain("old.purpose_note IS NOT DISTINCT FROM");
    expect(sql).toContain("'participants', nullif(btrim(_participants),'')");
    expect(sql).toContain("v.strengths, v.weaknesses, v.summary, v.participants_note, v.purpose_note");
    expect(sql).toContain("author_user_id uuid NOT NULL");
  });
  it("preserva versões antigas e recusa projeção parcial de histórico", () => {
    expect(sql).toContain("'visit_history', coalesce(");
    expect(sql).toContain("'followup:history-volume-exceeded'");
    expect(sql).toContain("v.correction_reason, v.supersedes_id");
    expect(sql).toContain("v.author_user_id = auth.uid()");
    expect(sql).toContain("followup:date-after-plan-deadline");
  });
  it("a assinatura da transação também cobre a lista de medidas", () => {
    expect(sql).toContain("CREATE TABLE public.school_institutional_followup_bundles (");
    expect(sql).toContain("public.school_institutional_followup_bundles ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("'actions', coalesce(_actions, '[]'::jsonb)");
    expect(sql).toContain("_saved.payload_hash IS DISTINCT FROM _fingerprint");
    expect(sql).toContain("followup_bundle_immutable");
  });
  it("rejeita reutilização de chaves de idempotência com payload diferente", () => {
    expect(sql).toContain("old.diagnosis IS NOT DISTINCT FROM btrim(_diagnosis)");
    expect(sql).toContain("old.description IS NOT DISTINCT FROM btrim(_description)");
    expect(sql).toContain("old.situation IS NOT DISTINCT FROM btrim(_situation)");
    expect(sql).toContain("followup:request-conflict");
  });
  it("preserva cronologia entre visitas, evoluções e suas retificações", () => {
    expect(sql).toContain("followup:update-before-origin-visit");
    expect(sql).toContain("followup:update-before-linked-visit");
    expect(sql).toContain("followup:date-after-action-update");
    expect(sql).toContain("followup:date-after-linked-update");
    expect(sql).toContain("u.visit_logical_id = _base_row.logical_id");
    expect(sql).toContain("WHERE fv.logical_id = a.visit_logical_id");
  });
  it("quadro de providências filtra escopo e recusa consulta incompleta", () => {
    expect(sql).toContain("CREATE FUNCTION public.school_institutional_followup_pending()");
    expect(sql).toContain("public.school_institutional_followup_can_read(a.school_id)");
    expect(sql).toContain("followup:network-pending-volume-exceeded");
    expect(sql).toContain("jsonb_build_object('pending', _rows)");
    expect(sql).toContain("latest.situation IS DISTINCT FROM 'concluída'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.school_institutional_followup_pending()");
  });
  it("separa agregações mensais e situação vigente por autorização escolar", () => {
    expect(sql).toContain("CREATE FUNCTION public.school_institutional_followup_monthly(");
    expect(sql).toContain("CREATE FUNCTION public.school_institutional_followup_statuses()");
    expect(sql).toContain("public.school_institutional_followup_can_read(v.school_id)");
    expect(sql).toContain("public.school_institutional_followup_can_read(a.school_id)");
  });
  it("possui prova de negação e rollback em banco isolado", () => {
    expect(negative).toMatch(/^BEGIN;/m);
    expect(negative.trimEnd().endsWith("ROLLBACK;")).toBe(true);
    expect(negative).toContain("followup-test:reader-failed-open");
    expect(negative).toContain("followup-test:writer-failed-open");
    expect(negative).toContain("followup-test:ghost-read-network");
  });
});
