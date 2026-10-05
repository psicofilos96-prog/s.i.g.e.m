// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import axe from "axe-core";
import { ConcurrencyConflictNotice, ErrorState, FactValue, LoadingState, ProvenanceLine, VersionStateBadge, WarningNote } from "./states";

describe("primitivas de estado do design system", () => {
  it("ausência nunca vira zero e zero continua zero", () => {
    const { container } = render(<div><FactValue value={null} /><FactValue value={0} /></div>);
    expect(container.querySelector("[data-absent]")?.textContent).toBe("Não informado");
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("proveniência ausente é declarada, não inventada", () => {
    render(<ProvenanceLine />);
    expect(screen.getByText("Proveniência não informada")).toBeTruthy();
  });

  it("estados versionados, erro, conflito e carregamento sem violações axe", async () => {
    const { container } = render(
      <div>
        <VersionStateBadge state="efetivo" version={3} /><VersionStateBadge state="revogado" />
        <LoadingState /><ErrorState description="Falha de leitura." onRetry={() => {}} />
        <ConcurrencyConflictNotice onReload={() => {}} /><WarningNote>Atenção.</WarningNote>
      </div>,
    );
    const r = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  it("componentes genéricos não embutem localidade nem emblema institucional", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
    const offenders = walk("src/components").filter((p) => /itaperuna|cristo/i.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("nenhuma tela usa cor crua do Tailwind no lugar de tokens semânticos", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && !/\.test\./.test(f) && !p.includes("components/ui") ? [p] : []; });
    const raw = /\b(?:text|bg|border)-(?:red|green|yellow|amber|emerald|blue|orange|rose|sky|lime)-\d{2,3}\b/;
    expect(walk("src").filter((p) => raw.test(readFileSync(p, "utf8")))).toEqual([]);
  });
});
