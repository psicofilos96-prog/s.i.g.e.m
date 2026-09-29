import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CalendarDocument } from "./calendar-document";
import { createCalendarFixtures } from "./calendar-fixtures";
import { DAY_TYPES } from "./calendar-catalog";

describe("simbologia oficial do calendário", () => {
  it("EBV sem retângulo; CC, CF e C com retângulo na grade e na legenda", () => {
    expect(DAY_TYPES.ENCONTRO.mark).toBe("EBV");
    for (const cal of createCalendarFixtures()) {
      const { container, unmount } = render(<CalendarDocument cal={cal} />);
      const boxed = [...container.querySelectorAll(".cd-sigla-caixa")].map((e) => e.textContent);
      expect(boxed.every((t) => ["CC", "CF", "C"].includes(t!))).toBe(true);
      expect(container.textContent).not.toContain("*");
      unmount();
    }
  });
});
