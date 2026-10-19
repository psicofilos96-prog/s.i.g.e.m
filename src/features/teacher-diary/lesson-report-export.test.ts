import { afterEach, describe, expect, it, vi } from "vitest";
import { createLessonReportAttempt, exportLessonReport } from "./lesson-report-export";
import type { MyDiary } from "./diary-w-source";
const mock = vi.hoisted(() => ({ pdf: vi.fn(), emission: vi.fn() }));
vi.mock("@/features/reports/report-engine", async (load) => ({ ...await load<typeof import("@/features/reports/report-engine")>(), toPdfFile: mock.pdf }));
vi.mock("@/features/reports/report-emissions", () => ({ recordEmission: mock.emission, isReportCode: (s: string) => /^[A-F0-9]{20}$/.test(s) }));
afterEach(() => vi.resetAllMocks());
const diary = { assignment_id: "own", substitution_id: null, school_id: "school", class_id: "class", component_label: "Math" } as MyDiary;
describe("teacher PDF emission", () => {
  it("retries uncertain registration with identical bytes, hash and identity", async () => {
    const file = new Blob(["frozen PDF bytes"]);
    mock.pdf.mockResolvedValue(file);
    mock.emission.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ verification_code: "ABCDEF0123456789ABCD" });
    const retry = createLessonReportAttempt(diary, [], "same-attempt", () => true);
    await expect(retry()).rejects.toThrow("network");
    const result = await retry();
    expect(mock.pdf).toHaveBeenCalledTimes(1);
    expect(mock.emission).toHaveBeenCalledTimes(2);
    expect(mock.emission.mock.calls[1]?.[0]).toEqual(mock.emission.mock.calls[0]?.[0]);
    expect(result.blob).toBe(file);
  });
  it("does not repeat confirmed registration for another download", async () => {
    mock.pdf.mockResolvedValue(new Blob(["pdf"]));
    mock.emission.mockResolvedValue({ verification_code: "ABCDEF0123456789ABCD" });
    const retry = createLessonReportAttempt(diary, [], "attempt", () => true);
    expect(await retry()).toEqual(await retry());
    expect(mock.emission).toHaveBeenCalledTimes(1);
  });
  it("discards an uncertain retry after losing its session", async () => {
    let current = true;
    mock.pdf.mockResolvedValue(new Blob(["pdf"])); mock.emission.mockRejectedValue(new Error("network"));
    const retry = createLessonReportAttempt(diary, [], "attempt", () => current);
    await expect(retry()).rejects.toThrow("network"); current = false;
    await expect(retry()).rejects.toThrow("mudança de contexto");
    expect(mock.emission).toHaveBeenCalledTimes(1);
  });
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