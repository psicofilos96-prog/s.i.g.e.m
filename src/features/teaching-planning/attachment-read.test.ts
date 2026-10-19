import { afterEach, describe, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({ attachments: vi.fn(), url: vi.fn() }));
vi.mock("./planning-source", () => ({ planAttachments: source.attachments, attachmentUrl: source.url }));
import { ATTACHMENT_READ_TIMEOUT_MS, readAttachmentWithDeadline, readAttachmentUrl, readPlanAttachments } from "./attachment-read";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe("private planning attachment reads", () => {
  it("bounds unresponsive reads to 15 seconds", async () => {
    vi.useFakeTimers();
    const result = readAttachmentWithDeadline(() => new Promise(() => {}));
    const check = expect(result).rejects.toThrow("plan-attachment-timeout");
    expect(ATTACHMENT_READ_TIMEOUT_MS).toBe(15_000); await vi.advanceTimersByTimeAsync(15_000); await check;
  });
  it("rejects missing revocation metadata instead of presenting an active attachment", async () => {
    source.attachments.mockResolvedValue([{ id: "a", label: "File", object_path: "p/file", supersedes_id: null }]);
    await expect(readPlanAttachments("p")).rejects.toThrow();
  });
  it("preserves a genuinely empty list", async () => {
    source.attachments.mockResolvedValue([]); expect(await readPlanAttachments("p")).toEqual([]);
  });
  it.each(["javascript:alert(1)", "http://example.test/file", null])("rejects unsafe or absent signed URLs", async (url) => {
    source.url.mockResolvedValue(url); await expect(readAttachmentUrl("p/file")).rejects.toThrow();
  });
});