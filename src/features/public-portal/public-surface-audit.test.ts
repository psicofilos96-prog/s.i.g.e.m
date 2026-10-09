import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { isPublicPath } from "./public-paths";
import { CARD_STATUS_LABEL } from "@/features/family-portal/card-public-code";

/** NPUB.2 — auditoria das superfícies públicas (estática, sem publicar nada). */
const publicFiles = readdirSync("src/routes").filter((f) => f.startsWith("publico.") || f.startsWith("verificar."));
const src = (f: string) => readFileSync(`src/routes/${f}`, "utf8");

describe("NPUB.2 superfícies públicas", () => {
  it("inventário fechado: só portal publicado e verificações", () => {
    expect(publicFiles.sort()).toEqual(["publico.$slug.tsx", "publico.index.tsx", "verificar.$codigo.tsx", "verificar.carteirinha.$codigo.tsx", "verificar.documento.$codigo.tsx"]);
  });
  it("todas usam o layout público, nunca o AppShell", () => {
    for (const f of publicFiles) { expect(src(f), f).toMatch(/PublicLayout/); expect(src(f), f).not.toMatch(/AppShell/); }
  });
  it("verificações são noindex e não leem tabelas diretamente", () => {
    for (const f of publicFiles.filter((x) => x.startsWith("verificar."))) {
      expect(src(f), f).toMatch(/noindex/);
      expect(src(f), f).not.toMatch(/\.from\(/);
    }
  });
  it("estado desconhecido do servidor cai em 'não encontrado', sem detalhes", () => {
    for (const f of ["verificar.$codigo.tsx", "verificar.documento.$codigo.tsx"]) expect(src(f), f).toMatch(/STATUS\[r\.status\] \?\? STATUS\["nao-encontrado"\]/);
  });
  it("carteirinha cobre válida/expirada/cancelada/substituída/indisponível", () => {
    expect(Object.keys(CARD_STATUS_LABEL).sort()).toEqual(["cancelada", "expirada", "indisponivel", "substituida", "valida"]);
  });
  it("calendário não é público por padrão", () => {
    for (const p of ["/calendario-escolar", "/calendario", "/publico-calendario"]) expect(isPublicPath(p)).toBe(false);
  });
});
