import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkFingerprint, checkMigrationDrift, checkOrphans, checkVersionChains } from "./integrity-checks";

const ok = [
  { id: "a1", logicalId: "A", version: 1, validFrom: "2026-01-01" },
  { id: "a2", logicalId: "A", version: 2, supersedesId: "a1", validFrom: "2026-02-01", validTo: "2026-12-31" },
];

describe("AW — integridade (fixtures sintéticas)", () => {
  it("cadeia íntegra não gera achado", () => expect(checkVersionChains(ok)).toEqual([]));
  it("detecta duplicata, lacuna, head ambíguo, órfão e vigência impossível", () => {
    const checks = (rows: Parameters<typeof checkVersionChains>[0]) => checkVersionChains(rows).map((f) => f.check);
    expect(checks([...ok, { id: "a3", logicalId: "A", version: 2, supersedesId: "a2" }])).toContain("versao-duplicada");
    expect(checks([ok[0]!, { ...ok[1]!, version: 3 }])).toContain("lacuna-de-versao");
    expect(checks([ok[0]!, { ...ok[1]!, supersedesId: null }])).toContain("head-ambiguo");
    expect(checks([{ ...ok[1]!, supersedesId: "zz", version: 1 }])).toContain("predecessor-orfao");
    expect(checks([{ ...ok[0]!, validTo: "2025-01-01" }])).toContain("vigencia-impossivel");
  });
  it("detecta referência órfã", () => {
    expect(checkOrphans("episodio-sem-turma", [{ key: "e1", parentId: "t9" }], new Set(["t1"]))).toHaveLength(1);
  });
  it("fingerprint divergente falha", async () => {
    const h = createHash("sha256").update("x").digest("hex");
    expect(await checkFingerprint("s", "x", h)).toEqual([]);
    expect(await checkFingerprint("s", "y", h)).toHaveLength(1);
  });
  it("drift: alterada, ausente e não congelada são visíveis", () => {
    const f = checkMigrationDrift({ "0001.sql": "h1", "0002.sql": "h2" }, { "0001.sql": "hX", "0003.sql": "h3" }).map((x) => x.check);
    expect(f).toEqual(["migration-alterada", "migration-ausente", "migration-nao-congelada"]);
  });
  it("repositório real: nenhuma migration congelada foi alterada", () => {
    const manifest = JSON.parse(readFileSync("src/test/invariants/migration-hashes.json", "utf8")) as Record<string, unknown>;
    const entries = Object.entries((manifest["files"] ?? manifest) as Record<string, string>).filter(([, v]) => typeof v === "string");
    expect(entries.length).toBeGreaterThan(0);
    const files = new Set(readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql")));
    for (const [name] of entries) { const base = name.split("/").pop()!; if (base.endsWith(".sql") && base.match(/^\d{4}_/)) expect(files.has(base)).toBe(true); }
  });
});
