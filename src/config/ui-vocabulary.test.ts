import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FORBIDDEN_VARIANTS, statusLabel } from "./ui-vocabulary";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") && !p.includes(".test.") && !p.includes("components/ui/") ? [p] : []; });

describe("NUI.2 vocabulário", () => {
  it("nenhuma tela usa variação proibida ou inglês residual em texto visível", () => {
    const hits: string[] = [];
    for (const f of walk("src")) { const s = readFileSync(f, "utf8"); for (const [re, canon] of FORBIDDEN_VARIANTS) if (re.test(s)) hits.push(`${f} → ${canon}`); }
    expect(hits).toEqual([]);
  });
  it("status equivalentes têm o mesmo rótulo; desconhecido não é adivinhado", () => {
    expect(statusLabel("draft")).toBe(statusLabel("rascunho"));
    expect(statusLabel("Homologated")).toBe("Homologado");
    expect(statusLabel("xpto")).toBe("Situação não reconhecida");
    expect(statusLabel(null)).toBe("Sem situação registrada");
  });
});
