import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stationAllowsPath } from "@/features/authority/station-navigation";
// @ts-expect-error módulo .mjs sem tipos
import { ACK, resolveHarness } from "../../../scripts/harness-gate.mjs";
import { STATION_SCENARIOS } from "./station-scenarios";

const ok = { SIGEM_TEST_HARNESS: "1", SIGEM_HARNESS_ACK: ACK };

describe("NTEST.1 — porta fail-closed", () => {
  it("recusa sem opt-in explícito", () => expect(() => resolveHarness({})).toThrow(/recusado/));
  it("recusa em produção mesmo com opt-in", () => expect(() => resolveHarness({ ...ok, NODE_ENV: "production" })).toThrow(/production/));
  it("recusa variável VITE_ de harness", () => expect(() => resolveHarness({ ...ok, VITE_SIGEM_HARNESS: "1" })).toThrow(/VITE_/));
  it("recusa banco não canônico", () =>
    expect(() => resolveHarness({ ...ok, SUPABASE_URL: "https://vwhvqtdvzbnfffkgoaen.supabase.co", SUPABASE_PUBLISHABLE_KEY: "x", SUPABASE_SERVICE_ROLE_KEY: "y" })).toThrow(/canônico/));
  it("sem credencial técnica cai para a camada estática, declarada", () => expect(resolveHarness(ok).layer).toBe("static"));
  it("sem navegador aprovado usa camada autenticada equivalente, declarada", () => {
    const r = resolveHarness({ ...ok, SUPABASE_URL: "https://crfqhyqkujhhlbiyhdbc.supabase.co", SUPABASE_PUBLISHABLE_KEY: "x", SUPABASE_SERVICE_ROLE_KEY: "y" });
    expect(r.layer).toBe("authenticated-layer"); expect(r.note).toMatch(/indisponível/);
  });
});

describe("NTEST.1 — cenários por estação (camada estática)", () => {
  for (const s of STATION_SCENARIOS.filter((x) => x.station !== "pedagogico")) {
    it(`${s.label}: alcança o que deve e não alcança o resto`, () => {
      for (const p of s.mustReach) expect(stationAllowsPath(s.station, p), p).toBe(true);
      for (const p of s.mustNotReach) expect(stationAllowsPath(s.station, p), p).toBe(false);
    });
  }
  it("estação desconhecida é recusada", () => expect(stationAllowsPath("inventada", "/")).toBe(false));
  it("perfis dos cenários existem no manifesto do harness BO", () => {
    const src = readFileSync("scripts/bo-fixture-harness.mjs", "utf8");
    for (const p of STATION_SCENARIOS.flatMap((s) => s.profiles)) expect(src).toContain(`"${p}"`);
  });
});

describe("NTEST.1 — o harness nunca entra no app", () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const app = walk("src").filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.|src\/test\//.test(p));
  it("nenhum código do app importa harness/fixtures", () =>
    expect(app.filter((p) => /harness-gate|bo-fixture|test\/harness/.test(readFileSync(p, "utf8")))).toEqual([]));
  it("scripts de harness não contêm senha literal", () => {
    for (const f of ["scripts/harness-gate.mjs", "scripts/bo-fixture-harness.mjs", "scripts/institutional-harness.mjs"])
      expect(readFileSync(f, "utf8")).not.toMatch(/password\s*[:=]\s*["'][^"']+["']|Teste@\d|signInWithOtp|generateLink/);
  });
});
