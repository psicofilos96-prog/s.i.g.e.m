import { afterEach, describe, expect, it, vi } from "vitest";
import { readLessons } from "./diary-w-source";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
afterEach(() => vi.resetAllMocks());
function setup() { const query = { order: mocks.order, range: mocks.range }; mocks.rpc.mockReturnValue(query); mocks.order.mockReturnValue(query); }
describe("fully paged teacher lessons", () => {
  it("reads beyond the server's 1000-row boundary with stable order and same assignment", async () => {
    setup(); mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: [{ id: 1000 }], error: null });
    const rows = await readLessons({ assignment_id: "own", substitution_id: null });
    expect(rows).toHaveLength(1001); expect(mocks.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(mocks.rpc.mock.calls).toEqual([["my_diary_lessons", { _assignment: "own", _substitution: null }], ["my_diary_lessons", { _assignment: "own", _substitution: null }]]);
    expect(mocks.order.mock.calls[0]).toEqual(["lesson_date", { ascending: false }]); expect(mocks.order.mock.calls[1]).toEqual(["logical_record_id", { ascending: true }]);
  });
  it("refuses incomplete output if a later page fails", async () => {
    setup(); mocks.range.mockResolvedValueOnce({ data: Array(1000).fill({}), error: null }).mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(readLessons({ assignment_id: "own", substitution_id: "sub" })).rejects.toThrow("denied");
  });
  it("refuses truncation instead of silently exporting a partial total", async () => {
    setup(); mocks.range.mockResolvedValue({ data: Array(1000).fill({}), error: null });
    await expect(readLessons({ assignment_id: "own", substitution_id: null })).rejects.toThrow("diary-lessons-incomplete");
  });
});