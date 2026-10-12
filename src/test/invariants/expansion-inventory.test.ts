/**
 * Lote 13 Expansão — inventário transversal dos núcleos 01–12.
 * Um núcleo só conta como "conectado" se algum arquivo de rota o importa; caso contrário
 * aparece como pendente, porque teste aceito ou núcleo puro não é entrega de fluxo.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

export const EXPANSION_CORES = [
  ["01", "src/features/data-quality/integrity-catalog"],
  ["02", "src/features/workflows/process-automation"],
  ["03", "src/features/assistant/intelligence-core"],
  ["04", "src/features/document-studio/ged-core"],
  ["05", "src/features/school-secretariat/vacancy-center"],
  ["06", "src/features/school-transport/transport-fleet"],
  ["07", "src/features/school-assets/asset-core"],
  ["08", "src/features/communication/family-messaging"],
  ["09", "src/features/professionals/continuing-education"],
  ["10", "src/features/dashboards/strategic-plan"],
  ["11", "src/lib/offline-queue"],
  ["12", "src/lib/observability/admin-health"],
] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}
const sources = walk("src").map((p) => [p, readFileSync(p, "utf8")] as const);

// "Chega a uma tela" = importado por componente (.tsx); núcleo puro que reaproveita outro núcleo não conta como tela.
function wired(core: string): boolean {
  const name = core.split("/").pop()!;
  return sources.some(([p, s]) => !p.startsWith(core) && p.endsWith(".tsx") && !p.endsWith(".test.tsx") && s.includes(`/${name}"`));
}

describe("inventário da expansão estrutural", () => {
  it.each(EXPANSION_CORES)("lote %s tem núcleo, teste e regra registrada", (_l, core) => {
    expect(existsSync(`${core}.ts`)).toBe(true);
    expect(existsSync(`${core}.test.ts`)).toBe(true);
    const dir = core.slice(0, core.lastIndexOf("/"));
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain(core.split("/").pop()!);
  });

  it("registra quais núcleos ainda não chegam a nenhuma tela", () => {
    const pending = EXPANSION_CORES.filter(([, c]) => !wired(c)).map(([l]) => l);
    // Snapshot honesto do estado: ao conectar um núcleo, remova-o desta lista.
    expect(pending).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]);
  });
});
