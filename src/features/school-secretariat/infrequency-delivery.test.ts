import { describe, expect, it } from "vitest";
import { issuedNoticeRow, readIssuedNotice } from "./infrequency-delivery";
const base = { notice_id: "00000000-0000-4000-8000-000000000001", delivery_status: "configuration-missing", deliveries: 0,
  present: 2, absent: 3, threshold: 75, period_from: "2026-10-01", period_to: "2026-10-17", recorded_on: "2026-10-17" };
describe("issued infrequency facts and delivery truth", () => {
  it("uses issued 2 presences and 3 absences for 40%, preserving the issued 75% threshold", () => {
    expect(issuedNoticeRow({ student_id: "test", student_name: "Synthetic" }, readIssuedNotice(base))).toMatchObject({ present: 2, absent: 3, rate: 40, threshold: 75 });
  });
  it("never treats zero deliveries as availability", () => {
    expect(() => readIssuedNotice({ ...base, delivery_status: "available-in-app", deliveries: 0 })).toThrow();
  });
  it("accepts one canonical delivery without claiming acknowledgement", () => {
    expect(readIssuedNotice({ ...base, delivery_status: "available-in-app", deliveries: 1 }).deliveries).toBe(1);
  });
  it("configuration absence has exactly zero deliveries", () => {
    expect(() => readIssuedNotice({ ...base, deliveries: 1 })).toThrow();
  });
  it("does not calculate without a source", () => {
    expect(() => readIssuedNotice({ ...base, present: 0, absent: 0 })).toThrow();
  });
});
