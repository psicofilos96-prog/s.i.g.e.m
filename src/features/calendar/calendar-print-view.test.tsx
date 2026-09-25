import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CalendarPrintView } from "./calendar-print-view";
import { createCalendarFixtures } from "./calendar-fixtures";

describe("view de impressão do calendário", () => {
  it("renderiza só o documento, fora da aplicação, sem controles", () => {
    const [cal] = createCalendarFixtures();
    const { container } = render(<CalendarPrintView cal={cal!} notice="RASCUNHO" />);
    expect(container.querySelector(".cd-print-root")).toBeNull();
    const root = document.body.querySelector(":scope > .cd-print-root")!;
    expect(root).toBeTruthy();
    expect(root.querySelector(".cd-a4 .cd-folha")).toBeTruthy();
    expect(root.querySelectorAll("button, input, select, a")).toHaveLength(0);
    expect(root.textContent).toContain("RASCUNHO");
  });
});
