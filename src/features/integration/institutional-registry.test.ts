import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dryRunMapping, heads, runHealth, validateConfig, validateMapping, validateSecretRef, type Adapter, type IntegrationVersion } from "./institutional-registry";

const base: IntegrationVersion = { key: "email-rede", version: 1, slot: "importador-censo", provider: "teste", state: "ativa", config: { host: "x" }, secret_ref: "TESTE_API_KEY", mapping: [{ from: "inep", to: "codigo_inep" }], reason: "r", recorded_at: "t" };
const env = (v: Record<string, string>) => (n: string) => v[n];
const adapter = (fn: Adapter["health"]): Adapter[] => [{ slot: "importador-censo", provider: "teste", health: fn }];

describe("segredos", () => {
  it("config recusa campo ou valor de credencial e referência precisa ser nome", () => {
    expect(validateConfig({ apiKey: "x" })).toHaveLength(1);
    expect(validateConfig({ nested: { password: "x" } })).toHaveLength(1);
    expect(validateConfig({ url: "sk_live_abc" })).toHaveLength(1);
    expect(validateConfig({ url: "https://x" })).toEqual([]);
    expect(validateSecretRef("sk_live_123")).toHaveLength(1);
    expect(validateSecretRef("PROVEDOR_API_KEY")).toEqual([]);
  });
  it("health nunca devolve o valor do segredo e falha fechado sem ele", async () => {
    const r = await runHealth(base, env({}), adapter(async () => ({ ok: true, code: "ok" })));
    expect(r).toMatchObject({ outcome: "recusado", code: "segredo-ausente" });
    const ok = await runHealth(base, env({ TESTE_API_KEY: "valor-secreto" }), adapter(async () => ({ ok: true, code: "ok" })));
    expect(JSON.stringify(ok)).not.toContain("valor-secreto");
  });
  it("migration guarda só nome do segredo e recusa segredo na configuração", () => {
    const sql = readFileSync("drizzle/migrations/0092_institutional_integrations_registry.sql", "utf8");
    expect(sql).toMatch(/secret_ref ~ '\^\[A-Z\]/);
    expect(sql).toMatch(/integration:secret-in-config/);
    expect(sql).toMatch(/REVOKE ALL ON public\.institutional_integration_versions, public\.institutional_integration_runs FROM PUBLIC, anon, authenticated/);
  });
});

describe("provedor, retry, desativação", () => {
  it("sem adaptador registrado ⇒ recusado (nenhum provedor real vem conectado)", async () => {
    expect((await runHealth(base, env({ TESTE_API_KEY: "s" }))).code).toBe("sem-adaptador");
  });
  it("provedor indisponível tenta no máximo 3 vezes e termina em falha", async () => {
    let n = 0;
    const r = await runHealth(base, env({ TESTE_API_KEY: "s" }), adapter(async () => { n++; throw new Error("down"); }));
    expect(r).toEqual({ outcome: "falha", code: "provedor-indisponivel", attempts: 3 });
    expect(n).toBe(3);
  });
  it("falha transitória seguida de sucesso; falha não retentável para na primeira", async () => {
    let n = 0;
    expect((await runHealth(base, env({ TESTE_API_KEY: "s" }), adapter(async () => (++n < 2 ? { ok: false, code: "503", retryable: true } : { ok: true, code: "ok" })))).attempts).toBe(2);
    expect(await runHealth(base, env({ TESTE_API_KEY: "s" }), adapter(async () => ({ ok: false, code: "401" })))).toEqual({ outcome: "falha", code: "401", attempts: 1 });
  });
  it("integração desativada não chama o provedor", async () => {
    let called = false;
    const r = await runHealth({ ...base, state: "inativa" }, env({ TESTE_API_KEY: "s" }), adapter(async () => { called = true; return { ok: true, code: "ok" }; }));
    expect(r.code).toBe("integracao-inativa");
    expect(called).toBe(false);
  });
  it("versão mais recente governa", () => {
    expect(heads([base, { ...base, version: 2, state: "inativa" }])[0]!.state).toBe("inativa");
  });
});

describe("mapeamento", () => {
  it("destino inexistente, repetido ou origem vazia são inválidos e bloqueiam health", async () => {
    expect(validateMapping("importador-censo", [{ from: "a", to: "inventado" }])).toHaveLength(1);
    expect(validateMapping("importador-censo", [{ from: "a", to: "codigo_inep" }, { from: "b", to: "codigo_inep" }])).toHaveLength(1);
    expect(validateMapping("importador-censo", [{ from: " ", to: "codigo_inep" }])).toHaveLength(1);
    expect(validateMapping("email", [{ from: "a", to: "codigo_inep" }])).toHaveLength(1);
    const r = await runHealth({ ...base, mapping: [{ from: "a", to: "x" }] }, env({ TESTE_API_KEY: "s" }), adapter(async () => ({ ok: true, code: "ok" })));
    expect(r.code).toBe("configuracao-invalida");
  });
  it("dry-run não grava e ausência continua ausência", () => {
    expect(dryRunMapping([{ from: "inep", to: "codigo_inep" }, { from: "nasc", to: "data_nascimento" }], { inep: "123", nasc: "" })).toEqual({ preview: { codigo_inep: "123", data_nascimento: null }, missing: ["nasc"], writes: 0 });
  });
});
