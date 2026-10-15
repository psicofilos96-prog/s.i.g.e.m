import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { it } from "vitest";
import { InstitutionalPrintSheet } from "./institutional-calendar-print";
it("debug", () => {
  const presentation = JSON.parse(readFileSync("/tmp/pres.json", "utf8"));
  const days = Array.from({ length: 31 }, (_, i) => {
    const on = `2027-01-${String(i + 1).padStart(2, "0")}`;
    return { on, label: null, typeLabel: "Férias", symbolCode: i < 3 ? "FDS" : "FERIAS", extraCodes: [], effect: "nao-letivo", markMismatch: false };
  });
  const model = { title: "x", months: [{ key: "2027-01", days, total: { schoolDays: 0, reason: null } }], periods: [], total: { schoolDays: 0, reason: null }, signatures: [], unmappedTypes: [], holidays: [], legendCodes: [], mismatches: [] };
  const { container } = render(<InstitutionalPrintSheet model={model as never} presentation={presentation} />);
  console.log("bands", container.querySelectorAll("td.cd-ferias").length, container.querySelectorAll("tbody td").length);
});
