// Lote 18 — toda rota que monta o console operacional (lê tabelas ao montar) precisa estar no portão de sessão,
// porque a auditoria achou 3 rotas novas lendo sem sessão (lista manual esquecida).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { requiresSessionBeforeRead } from "@/features/authority/session-read-gate";

const DIR = "src/routes";

describe("portão de sessão × console operacional", () => {
  const consoleRoutes = readdirSync(DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
    .filter((src) => src.includes("<OperationsConsole"))
    .map((src) => /createFileRoute\("([^"]+)"\)/.exec(src)?.[1]?.replace(/_(?=\/|$)/g, ""))
    .filter((p): p is string => !!p);

  it("encontra as rotas do console", () => {
    expect(consoleRoutes.length).toBeGreaterThanOrEqual(6);
  });

  it.each(["/matriculas/parametros", "/tecnologia/cadastros", "/tecnologia/decisoes"])("%s não lê antes da sessão", (p) => {
    expect(requiresSessionBeforeRead(p)).toBe(true);
  });

  it("todas as rotas do console exigem sessão antes de ler", () => {
    expect(consoleRoutes.filter((p) => !requiresSessionBeforeRead(p))).toEqual([]);
  });
});
