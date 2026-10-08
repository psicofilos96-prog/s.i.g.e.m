// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { FieldMessage } from "@/components/sigem/human-workflow";

describe("NFORM.2 — transferência e enturmação: erro ligado ao campo", () => {
  it("FieldMessage expõe id para aria-describedby", () => {
    render(<FieldMessage id="tr-err-x">Informe a data.</FieldMessage>);
    expect(screen.getByRole("alert").id).toBe("tr-err-x");
  });
  it.each([["src/features/transfers/transfer-workspace-page.tsx", "tr"], ["src/features/allocations/allocation-workspace-page.tsx", "al"]])("%s: cada FieldError tem id e controle com fieldA11y", (f, p) => {
    const s = readFileSync(f, "utf8");
    const fields = [...s.matchAll(/<FieldError issue=\{issueOf\("(\w+)"\)\}( id="([\w-]+)")? \/>/g)];
    expect(fields.length).toBeGreaterThan(0);
    for (const m of fields) {
      expect(m[3]).toBe(`${p}-err-${m[1]}`);
      expect(s).toContain(`fieldA11y(issueOf("${m[1]}"), "${p}-err-${m[1]}")`);
    }
  });
});
