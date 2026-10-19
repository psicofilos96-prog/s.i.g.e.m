import { afterEach, describe, expect, it, vi } from "vitest";
import { exportLessonReport } from "./lesson-report-export";
import type { MyDiary } from "./diary-w-source";
const mock = vi.hoisted(() => ({ pdf: vi.fn(), emission: vi.fn() }));
vi.mock("@/features/reports/report-engine", async (load) => ({ ...await load<typeof import("@/features/reports/report-engine")>(), toPdfFile: mock.pdf }));
vi.mock("@/features/reports/report-emissions", () => ({ recordEmission: mock.emission, isReportCode: (s: string) => /^[A-F0-9]{20}$/.test(s) }));
afterEach(() => vi.resetAllMocks());
const diary = { assignment_id: "own", substitution_id: null, school_id: "school", class_id: "class", component_label: "Math" } as MyDiary;
describe("teacher PDF emission", () => {
  it("records the exact PDF hash before returning the file", async () => {
    const file = new Blob(["exact PDF bytes"], { type: "application/pdf" }); mock.pdf.mockResolvedValue(file);
    mock.emission.mockResolvedValue({ verification_code: "ABCDEF0123456789ABCD" });
    const result = await exportLessonReport(diary, [], "attempt", () => true);
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(mock.emission.mock.calls[0]?.[0].sha256).toBe(hash); expect(mock.emission.mock.calls[0]?.[0].key).toBe("attempt"); expect(result.blob).toBe(file);
  });
  it("does not emit after the originating context is lost", async () => {
    mock.pdf.mockResolvedValue(new Blob(["pdf"]));
    await expect(exportLessonReport(diary, [], "attempt", () => false)).rejects.toThrow(); expect(mock.emission).not.toHaveBeenCalled();
  });
  it("does not return a file when registration is denied", async () => {
    mock.pdf.mockResolvedValue(new Blob(["pdf"])); mock.emission.mockRejectedValue(new Error("denied"));
    await expect(exportLessonReport(diary, [], "attempt", () => true)).rejects.toThrow("denied");
  });
});