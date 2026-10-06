import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BROWSER_STORAGE_ALLOWLIST, DATA_INVENTORY, LIFECYCLE_UNDECIDED, PII_COLUMN_TABLES, PRIVACY_PENDING } from "./data-inventory";

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
const src = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.startsWith("src/integrations/"));

describe("AS — privacidade", () => {
  it("toda tabela com coluna de PII/texto livre está inventariada", () => {
    const inv = new Set(DATA_INVENTORY.flatMap((e) => e.tables));
    expect(PII_COLUMN_TABLES.filter((t) => !inv.has(t))).toEqual([]);
  });
  it("retenção/base legal pendentes e nunca inventadas", () => {
    expect(PRIVACY_PENDING).toContain("DATA_RETENTION_POLICY_PENDING");
    for (const d of LIFECYCLE_UNDECIDED) expect(d.retentionDays).toBeNull();
  });
  it("armazenamento do navegador só nos arquivos autorizados", () => {
    const users = src.filter((f) => /\b(localStorage|sessionStorage)\.(get|set)Item/.test(readFileSync(f, "utf8")));
    expect(users.filter((f) => !BROWSER_STORAGE_ALLOWLIST.some((a) => f.startsWith(a)))).toEqual([]);
  });
  it("nenhum console direto fora da telemetria/infra", () => {
    const ok = ["src/server.ts", "src/lib/error-capture.ts", "src/lib/observability/telemetry.ts", "src/routes/__root.tsx" /* error boundary */, "src/features/student-life/curricular-resolution-source.ts" /* só código de estado, DEV */];
    const bad = src.filter((f) => !ok.includes(f) && /console\.(log|info|debug|warn|error)\(/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it("nenhum CPF real-formatado no código-fonte da aplicação", () => {
    const bad = src.filter((f) => /\b(?!000\.000\.000)\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it("nenhuma eliminação automática agendada", () => {
    const bad = src.filter((f) => /pg_cron|cron\.schedule|DELETE FROM public\.(institutional_students|inclusion_records)/i.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
