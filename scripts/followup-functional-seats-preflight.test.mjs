import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOLLOWUP_SEATS, assertTargetBackend, assessFunctionalSeats, runPreflight,
} from "./followup-functional-seats-preflight.mjs";

const REF = "crfqhyqkujhhlbiyhdbc";
const users = () => FOLLOWUP_SEATS.map(({ seat, email }, i) => ({
  id: `user-${i}`, email,
  email_confirmed_at: null, confirmed_at: null,
  last_sign_in_at: null, invited_at: null,
  app_metadata: { sigem_account: "followup-functional-pending", followup_seat: seat },
}));

test("rejeita backend substituto, URL com prefixo fraudulento e query", () => {
  assert.equal(assertTargetBackend(`https://${REF}.supabase.co`, REF), REF);
  for (const url of [
    `https://${REF}.supabase.co.evil.example`,
    `https://evil-${REF}.supabase.co`,
    `https://${REF}.evil.example`,
    `http://${REF}.supabase.co`,
    `https://${REF}.supabase.co/rest/v1`,
    `https://${REF}.supabase.co/?a=1`,
    `https://${REF}.supabase.co:8443`,
    `https://admin:secret@${REF}.supabase.co`,
    "https://nyupdcodzfmwkpxpourt.supabase.co",
  ]) assert.throws(() => assertTargetBackend(url, REF));
  assert.throws(() => assertTargetBackend(`https://${REF}.supabase.co`, ""));
});

test("identifica exatamente os três postos sem liberar acesso", () => {
  const result = assessFunctionalSeats(users());
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((row) => row.estado), Array(3).fill("PRE_CADASTRADO_PENDENTE"));
  assert.equal(JSON.stringify(result).includes("user-0"), false);
});

test("recusa duplicatas e ausências sem inventar contas", () => {
  const src = users();
  assert.deepEqual(assessFunctionalSeats([src[0], src[0], src[1]]).map(x => x.estado),
    ["CONFLITO_DUPLICADO", "PRE_CADASTRADO_PENDENTE", "AUSENTE"]);
});

test("confirmação de login não equivale a ativação; metadados ou sessões inesperadas exigem revisão", () => {
  const data = users();
  data[0].app_metadata = { followup_seat: "gab" };
  data[1].email_confirmed_at = "2026-11-06T00:00:00Z";
  data[2].invited_at = "2026-11-06T00:00:00Z";
  assert.deepEqual(assessFunctionalSeats(data).map(x=>x.estado), [
    "REVISAR_ANTES_DE_ATIVAR", "CONFIRMADO_SEM_VINCULO", "REVISAR_ANTES_DE_ATIVAR",
  ]);
  const signed = users(); signed[0].last_sign_in_at = "2026-11-06T12:00:00Z";
  assert.equal(assessFunctionalSeats(signed)[0].estado, "REVISAR_ANTES_DE_ATIVAR");
});

test("vínculo humano ou principal setorial é mudança de autorização a revisar", () => {
  const src = users();
  assert.equal(assessFunctionalSeats(src, [{ user_id: "user-0" }])[0].estado, "REVISAR_ANTES_DE_ATIVAR");
  assert.equal(assessFunctionalSeats(src, [], [{ auth_user_id: "user-2" }])[2].estado, "REVISAR_ANTES_DE_ATIVAR");
});

test("execução somente leitura consulta Auth e vínculos sem alterar dados", async () => {
  const invoked = [];
  const src = users();
  const admin = {
    auth: { admin: { listUsers: async (args) => {
      invoked.push(["listUsers", args.page]);
      return { data: { users: src }, error: null };
    } } },
    from: (table) => {
      invoked.push(["from", table]);
      return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
    },
  };
  const report = await runPreflight({
    url: `https://${REF}.supabase.co`, serviceRoleKey: "fixture-never-printed",
    expectedBackend: REF, createClient: () => admin,
  });
  assert.equal(report.tres_pre_cadastros_pendentes, true);
  assert.equal(report.tres_identidades_sem_vinculo, true);
  assert.equal(report.acesso_operacional_liberado, false);
  assert.equal(JSON.stringify(report).includes("fixture-never-printed"), false);
  assert.deepEqual(invoked, [
    ["listUsers", 1],
    ["from", "user_person_links"],
    ["from", "institutional_sector_principals"],
  ]);
});

test("três logins confirmados permanecem sem capacidade enquanto não há vínculos", async () => {
  const confirmed = users().map((u) => ({ ...u, email_confirmed_at: "2026-11-06T11:00:00Z" }));
  assert.deepEqual(assessFunctionalSeats(confirmed).map((u) => u.estado),
    Array(3).fill("CONFIRMADO_SEM_VINCULO"));
  const admin = {
    auth: { admin: { listUsers: async () => ({ data: { users: confirmed }, error: null }) } },
    from: () => ({ select: () => ({ in: async () => ({ data: [], error: null }) }) }),
  };
  const result = await runPreflight({
    url: `https://${REF}.supabase.co`,
    expectedBackend: REF, serviceRoleKey: "fixture", createClient: () => admin,
  });
  assert.equal(result.tres_pre_cadastros_pendentes, false);
  assert.equal(result.tres_identidades_sem_vinculo, true);
  assert.equal(result.acesso_operacional_liberado, false);
});

test("sem segredo ou com servidor errado não cria cliente nem consulta usuário", async () => {
  let called = 0;
  const createClient = () => { called++; throw new Error("não deveria ser chamado"); };
  await assert.rejects(runPreflight({
    url: "https://nyupdcodzfmwkpxpourt.supabase.co", serviceRoleKey: "x",
    expectedBackend: REF, createClient,
  }));
  await assert.rejects(runPreflight({
    url: `https://${REF}.supabase.co`, serviceRoleKey: "",
    expectedBackend: REF, createClient,
  }));
  assert.equal(called, 0);
});
