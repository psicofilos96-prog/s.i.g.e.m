import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { knownLabel, statusLabel, ACTION, STATE_TEXT, UNRECOGNIZED_STATUS } from "./ui-vocabulary";
import { ACTION_LABEL, STATE_LABEL } from "@/components/sigem/ui-vocabulary";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") && !p.includes(".test.") && !p.includes("components/ui/") ? [p] : []; });

describe("NUI.3 vocabulário aplicado às telas", () => {
  it("status desconhecido fica explícito, nunca vira o código cru", () => {
    const m = { rascunho: "Rascunho" };
    expect(knownLabel(m, "rascunho")).toBe("Rascunho");
    expect(knownLabel(m, "xpto")).toBe(UNRECOGNIZED_STATUS);
    expect(knownLabel(m, "constructor")).toBe(UNRECOGNIZED_STATUS);
    expect(knownLabel(m, null)).toBe("Sem situação registrada");
    expect(statusLabel("xpto")).toBe(UNRECOGNIZED_STATUS);
  });
  it("catálogo das primitivas é fachada do registro único", () => {
    expect(ACTION_LABEL.tentarNovamente).toBe(ACTION.tentarNovamente);
    expect(STATE_LABEL.vazio).toBe(STATE_TEXT.nenhumResultado);
    expect(STATE_LABEL.carregando).toBe(STATE_TEXT.carregando);
  });
  it("nenhuma tela devolve o código cru de status como rótulo", () => {
    const re = /(STATE|STATUS|CYCLE)[A-Z_]*\[([^\]]+?)( as \w+)?\]\s*\?\?\s*([a-zA-Z_.]+)/g;
    const hits: string[] = [];
    for (const f of walk("src")) for (const m of readFileSync(f, "utf8").matchAll(re)) if ((m[2] ?? "").trim() === (m[4] ?? "").trim()) hits.push(`${f}: ${m[0]}`);
    expect(hits).toEqual([]);
  });
  it("títulos de vazio usam a forma canônica", () => {
    const hits = walk("src").filter((f) => /title="(Nada encontrado|Sem resultados)\.?"/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
