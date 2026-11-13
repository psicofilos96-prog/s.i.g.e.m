import { describe, expect, it } from "vitest";
import { currentYearFor } from "./active-year";
const ys = [
  { id: "a26", label: "Ano letivo 2026", state: null, startsOn: "2026-01-01", endsOn: "2026-12-31" },
  { id: "a27", label: "Ano letivo 2027", state: null, startsOn: "2027-01-01", endsOn: "2027-12-31" },
];
describe("ano letivo corrente", () => {
  it("em 2026 mostra 2026", () => expect(currentYearFor(ys, "2026-11-13")).toEqual({ id: "a26", fallback: false }));
  it("em 2027 mostra 2027", () => expect(currentYearFor(ys, "2027-03-01")).toEqual({ id: "a27", fallback: false }));
  it("ano não cadastrado usa o mais recente, marcado", () => expect(currentYearFor(ys, "2028-02-01")).toEqual({ id: "a27", fallback: true }));
  it("sem anos não inventa", () => expect(currentYearFor([], "2026-05-05")).toBeNull());
});
