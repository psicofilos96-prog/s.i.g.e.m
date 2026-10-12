import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// NSEC.ENV.1 — o `.env` versionado só pode conter valores públicos. Nunca imprime valores.
const ALLOWED = ["SUPABASE_PROJECT_ID", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_URL", "VITE_SUPABASE_PROJECT_ID", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_URL"];
const parse = (f: string) => readFileSync(f, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")] as const; });

describe("NSEC.ENV.1 — .env só com valores públicos", () => {
  it("só chaves da allowlist e nenhum valor com forma de segredo", () => {
    if (!existsSync(".env")) return;
    const rows = parse(".env");
    expect(rows.map(([k]) => k).filter((k) => !ALLOWED.includes(k))).toEqual([]);
    const bad = rows.filter(([k, v]) => /^sb_secret_|service_role/i.test(v) || /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v) && !/PUBLISHABLE/.test(k)).map(([k]) => k);
    expect(bad).toEqual([]);
    for (const [k, v] of rows) if (/PUBLISHABLE_KEY$/.test(k)) expect(/^sb_publishable_|^eyJ/.test(v), k).toBe(true);
  });
  it("modelo .env.example existe e não tem valores", () => {
    const rows = parse(".env.example");
    expect(rows.map(([k]) => k).sort()).toEqual([...ALLOWED].sort());
    expect(rows.filter(([, v]) => v !== "")).toEqual([]);
  });
});
