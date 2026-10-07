import { describe, it, expect } from "vitest";
import { functionalTimeline, type PersonPicture } from "./functional-life";
const link = { logical_id: "l1", version: 1, person_id: "p", functional_registration: "123", link_nature_id: "n", position_id: null, valid_from: "2020-01-01", valid_until: null } as never;
describe("functionalTimeline", () => {
  it("orders by date and keeps undated facts last without inventing a date", () => {
    const p = { personId: "p", qualifications: [], engagements: [], exerciseWithoutPosting: [], links: [{ link, validity: "vigente", postings: [], exercises: [],
      events: [{ event_kind_id: "ferias", occurred_on: null }, { event_kind_id: "licenca", occurred_on: "2022-03-01" }] as never, processes: [] }] } as unknown as PersonPicture;
    const t = functionalTimeline(p);
    expect(t.map((e) => e.date)).toEqual(["2020-01-01", "2022-03-01", null]);
    expect(t.some((e) => /salário|previd/i.test(e.label))).toBe(false);
  });
});
