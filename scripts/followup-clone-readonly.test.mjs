import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCloneConnection, buildPgEnvironment, sqlFileForPhase,
} from "./followup-clone-readonly.mjs";

const env = {
  SIGEM_CLONE_CONFIRMATION: "CONFIRMO_CLONE_LOCAL_ISOLADO",
  SIGEM_CLONE_EXPECTED_DATABASE: "sigem_followup_clone",
  SIGEM_CLONE_DATABASE_URL: "postgresql://tester:sample-secret@127.0.0.1:54322/sigem_followup_clone",
};
const parse = (overrides = {}) => parseCloneConnection({ ...env, ...overrides });

describe("runner de homologação de clone (somente leitura)", () => {
  it("aceita uma conexão local com nome de banco explicitamente confirmado", () => {
    const actual = parse();
    assert.equal(actual.database, "sigem_followup_clone");
    assert.equal(actual.host, "127.0.0.1");
    assert.equal(actual.port, "54322");
    assert.equal(actual.password, "sample-secret");
    assert.equal(actual.user, "tester");
  });

  it("rejeita o endpoint oficial e qualquer endpoint remoto", () => {
    for (const host of ["db.vwhvqtdvzbnfffkgoaen.supabase.co", "db.crfqhyqkujhhlbiyhdbc.supabase.co",
      "pgpooler.supabase.com", "example.org"]) {
      assert.throws(() => parse({
        SIGEM_CLONE_DATABASE_URL: "postgresql://tester:secret@" + host + ":5432/sigem_followup_clone",
      }), /Conexões remotas foram bloqueadas/);
    }
  });

  it("exige confirmação e identidade exata de um banco isolado", () => {
    assert.throws(() => parse({ SIGEM_CLONE_CONFIRMATION: "" }), /Confirme/);
    assert.throws(() => parse({ SIGEM_CLONE_EXPECTED_DATABASE: "outra_base" }), /não corresponde/);
    assert.throws(() => parse({
      SIGEM_CLONE_EXPECTED_DATABASE: "postgres",
      SIGEM_CLONE_DATABASE_URL: "postgresql://tester:secret@localhost:5432/postgres",
    }), /nome isolado/);
  });

  it("não aceita opções de conexão arbitrárias ou protocolo diferente", () => {
    assert.throws(() => parse({
      SIGEM_CLONE_DATABASE_URL: "https://tester:secret@localhost:5432/sigem_followup_clone",
    }), /protocolo/);
    assert.throws(() => parse({
      SIGEM_CLONE_DATABASE_URL: "postgresql://tester:secret@localhost:5432/sigem_followup_clone?options=-c%20search_path%3Dpublic",
    }), /opções não autorizadas/);
  });

  it("elimina parâmetros PG herdados que poderiam mudar a conexão", () => {
    const actual = buildPgEnvironment({
      PGHOST: "db.production.example",
      PGSERVICE: "production",
      PGPASSWORD: "old-password",
      PGOPTIONS: "-c search_path=public",
      KEEP_ME: "value",
    }, parse());
    assert.equal(actual.PGHOST, "127.0.0.1");
    assert.equal(actual.PGDATABASE, "sigem_followup_clone");
    assert.equal(actual.PGPASSWORD, "sample-secret");
    assert.equal(actual.PGSERVICE, undefined);
    assert.equal(actual.PGOPTIONS, undefined);
    assert.equal(actual.KEEP_ME, "value");
  });

  it("seleciona exclusivamente SQL de pré ou pós-checagem, nunca uma migration de escrita", () => {
    assert.equal(sqlFileForPhase("--pre"), "0613_followup_clone_preflight_readonly.sql");
    assert.equal(sqlFileForPhase("--post"), "0613_followup_clone_postflight_readonly.sql");
    assert.throws(() => sqlFileForPhase("--apply"), /Uso:/);
  });
});
