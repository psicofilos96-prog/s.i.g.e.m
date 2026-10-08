import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ABSENCE_TEXT, AbsenceState, FactValue } from "./states";

describe("NEMPTY.3 — estados de ausência", () => {
  it("zero observado aparece como zero; ausência nunca vira zero", () => {
    const { container: z } = render(<FactValue value={0} />);
    expect(z.textContent).toBe("0");
    const { container: a } = render(<FactValue value={undefined} absentLabel="Não calculado" />);
    expect(a.textContent).toBe("Não calculado");
  });
  it("cada tipo de ausência tem frase distinta e nenhum afirma ausência como zero", () => {
    const titles = Object.values(ABSENCE_TEXT).map((t) => t.title);
    expect(new Set(titles).size).toBe(5);
    render(<AbsenceState kind="sem-permissao" />);
    expect(screen.getByText("Sem permissão")).toBeTruthy();
  });
  it("telas corrigidas não usam zero como ausência", () => {
    expect(readFileSync("src/features/calendar/calendar-pages.tsx", "utf8")).not.toContain("schoolDays ?? 0");
    const map = readFileSync("src/features/statistical-map/network-projection-page.tsx", "utf8");
    expect(map).not.toContain("official.length ?? 0");
    expect(map).toContain("Cobertura oficial não consultada.");
    expect(readFileSync("src/features/year-transition/year-preparation-page.tsx", "utf8")).not.toContain("logical_ids?.length ?? 0");
  });
});
