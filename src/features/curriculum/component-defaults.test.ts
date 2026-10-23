import { describe, expect, it } from "vitest";
import { unversionedComponentDefaults } from "./component-defaults";

const portuguese = { component_id: "comp-lingua-portuguesa", display_name: "Língua Portuguesa", valid_from: "2026-10-23", source_ref: "decisão do proprietário" };
describe("owner-authorized component defaults", () => {
  it("preserves the existing component ID instead of creating a duplicate", () => {
    expect(unversionedComponentDefaults([portuguese], [])).toEqual([portuguese]);
  });
  it("never replaces an institutional version with a system default", () => {
    expect(unversionedComponentDefaults([portuguese], ["comp-lingua-portuguesa"])).toEqual([]);
  });
  it("does not hide unrelated defaults", () => {
    expect(unversionedComponentDefaults([portuguese], ["comp-matematica"])).toEqual([portuguese]);
  });
});