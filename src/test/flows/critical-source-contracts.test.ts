/**
 * Cobertura por fluxo — lacunas reais: adaptadores de gravação/leitura sem teste
 * (Nova turma, Vagas/Livro, Importações). Garante writer canônico, cabeça esperada
 * repassada e que falha de leitura vira erro, nunca lista vazia.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
let rpcResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let tableResult: Record<string, { data: unknown; error: { message: string } | null }> = {};

vi.mock("@/integrations/supabase/client", () => {
  const query = (table: string) => {
    const q = { select: () => q, eq: () => q, then: (r: (v: unknown) => unknown) => Promise.resolve(tableResult[table] ?? { data: [], error: null }).then(r) };
    return q;
  };
  return {
    supabase: {
      rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve(rpcResult); },
      from: (t: string) => query(t),
    },
  };
});

const { createClassWithSetup, recordComposition } = await import("@/features/classes/class-wizard-source");
const { readVacancies, readEnrollmentBook, inepOf } = await import("@/features/school-secretariat/vacancies-book-source");
const { canonicalRecordsFor, stageBatch } = await import("@/features/data-import/import-source");

beforeEach(() => { calls.length = 0; rpcResult = { data: null, error: null }; tableResult = {}; });

describe("Turmas — Nova turma", () => {
  it("cria só pelo writer transacional e devolve o ID do banco", async () => {
    rpcResult = { data: { class_id: "cls-1" }, error: null };
    await expect(createClassWithSetup({ _school: "s" })).resolves.toEqual({ class_id: "cls-1" });
    expect(calls.map((c) => c.fn)).toEqual(["secretariat_create_class_with_journey"]);
  });
  it("recusa do banco chega à tela, nunca sucesso silencioso", async () => {
    rpcResult = { data: null, error: { message: "secretariat:year-not-open" } };
    await expect(createClassWithSetup({})).rejects.toThrow("secretariat:year-not-open");
  });
  it("composição envia a cabeça esperada lida (concorrência)", async () => {
    await recordComposition("cls-1", "head-7", [{ scheme: "ano", value: "1", version: 2, label: "1º" }], "2027-02-01", "ajuste");
    expect(calls[0]).toMatchObject({ fn: "record_class_composition", args: { _expected_head: "head-7", _positions: [{ scheme: "ano", value: "1", version: 2 }] } });
  });
});

describe("Matrícula — Vagas e Livro", () => {
  it("lê pelos readers canônicos com escola, ano e data", async () => {
    rpcResult = { data: [], error: null };
    await readVacancies("sch", "2027", "2027-03-01");
    await readEnrollmentBook("sch", "2027", null);
    expect(calls).toEqual([
      { fn: "secretariat_class_vacancies_at", args: { _school: "sch", _year: "2027", _on: "2027-03-01" } },
      { fn: "secretariat_enrollment_book_at", args: { _school: "sch", _year: "2027", _known_at: null } },
    ]);
  });
  it("erro de leitura não vira 'sem vagas'", async () => {
    rpcResult = { data: null, error: { message: "permission denied" } };
    await expect(readVacancies("sch", "2027", "2027-03-01")).rejects.toThrow("permission denied");
  });
  it("INEP só do identificador curado de 8 dígitos", () => {
    expect(inepOf("inep-29123456")).toBe("29123456");
    expect(inepOf("inep-123")).toBeNull();
    expect(inepOf("escola-29123456")).toBeNull();
  });
});

describe("Importações — staging e matching", () => {
  it("staging envia o hash da fonte e devolve se já existia (reenvio idempotente)", async () => {
    rpcResult = { data: { id: "b1", already_staged: true }, error: null };
    const r = await stageBatch({ adapterId: "a", adapterVersion: 1, sourceName: "f.csv", sourceSha256: "abc", rows: [], reprocessesId: null, sourceRef: null });
    expect(r.already_staged).toBe(true);
    expect(calls[0]).toMatchObject({ fn: "stage_import_batch", args: { _source_sha256: "abc", _adapter_version: 1 } });
  });
  it("falha de leitura do cadastro canônico é erro, nunca 'tudo novo'", async () => {
    tableResult = { institutional_school_identifiers: { data: null, error: { message: "permission denied" } } };
    await expect(canonicalRecordsFor("censo-matriz-escolas")).rejects.toThrow("permission denied");
  });
  it("matching compara com o nome da versão cadastral mais recente", async () => {
    tableResult = {
      institutional_school_identifiers: { data: [{ school_id: "s1", value: "29.123.456" }], error: null },
      institutional_school_record_versions: { data: [
        { school_id: "s1", official_name: "Antigo", version_number: 1 },
        { school_id: "s1", official_name: " Escola  Nova ", version_number: 2 },
      ], error: null },
    };
    await expect(canonicalRecordsFor("censo-matriz-escolas")).resolves.toEqual([{ identityKey: "inep:29123456", canonicalRef: "escola s1", values: { nome: "Escola Nova" } }]);
  });
});
