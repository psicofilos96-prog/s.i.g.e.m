import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LessonReportButton } from "./lesson-report-button";
import type { MyDiary, LessonRow } from "./diary-w-source";
const mock = vi.hoisted(() => ({ export: vi.fn(), download: vi.fn() }));
vi.mock("./lesson-report-export", () => ({ exportLessonReport: mock.export }));
vi.mock("@/features/reports/report-engine", () => ({ downloadBlob: mock.download }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const diary = { assignment_id: "a" } as MyDiary; const lessons = [{}] as LessonRow[];
describe("lesson PDF action", () => {
  it.each([null, []])("does not export an unavailable or empty source", (rows) => {
    render(<LessonReportButton diary={diary} lessons={rows} />);
    expect(screen.getByRole("button")).toBeDisabled(); expect(mock.export).not.toHaveBeenCalled();
  });
  it("downloads only after the emission succeeds", async () => {
    mock.export.mockResolvedValue({ blob: new Blob(), name: "a.pdf", code: "ABCDEF0123456789ABCD" });
    render(<LessonReportButton diary={diary} lessons={lessons} />); fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mock.download).toHaveBeenCalledTimes(1));
    expect(mock.export.mock.calls[0]?.[1]).toBe(lessons);
  });
  it("does not download after account/selection unmount", async () => {
    let resolve: (v: unknown) => void = () => {};
    mock.export.mockReturnValue(new Promise((r) => { resolve = r; }));
    const view = render(<LessonReportButton diary={diary} lessons={lessons} />);
    fireEvent.click(screen.getByRole("button")); view.unmount();
    await act(async () => { resolve({ blob: new Blob(), name: "a.pdf", code: "code" }); });
    expect(mock.download).not.toHaveBeenCalled(); expect(mock.export.mock.calls[0]?.[3]()).toBe(false);
  });
  it("does not download when the emission fails", async () => {
    mock.export.mockRejectedValue(new Error("denied")); render(<LessonReportButton diary={diary} lessons={lessons} />);
    fireEvent.click(screen.getByRole("button")); await screen.findByRole("status"); expect(mock.download).not.toHaveBeenCalled();
  });
});