import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ response: { data: [] as unknown[], error: null as { message: string } | null }, calls: [] as unknown[], held: false }));
vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const chain = {
      select: () => chain, not: (...args: unknown[]) => { state.calls.push(args); return chain; },
      order: (key: string) => { state.calls.push(key); return chain; },
      range: (from: number, to: number) => { state.calls.push([from, to]); return chain; },
      abortSignal: (s: AbortSignal) => { state.calls.push(s); return chain; },
      then: (ok: (v: typeof state.response) => unknown, fail: (e: unknown) => unknown) =>
        (state.held ? new Promise<typeof state.response>(() => {}) : Promise.resolve(state.response)).then(ok, fail),
    };
    return chain;
  };
  return { supabase: { from: (name: string) => { state.calls.push(name); return builder(); }, rpc: (name: string) => { state.calls.push(name); return builder(); } } };
});
import { readAdminList } from "./admin-list-read";
import { ListTimeoutError } from "@/lib/server-page";
const signal = () => new AbortController().signal;
afterEach(() => { state.response = { data: [], error: null }; state.calls = []; state.held = false; vi.useRealTimers(); });
describe("Bounded canonical administration pages", () => {
  it("reads account page 21 past 1000 without reading credential events or all links", async () => {
    state.response.data = Array.from({ length: 51 }, (_, i) => ({ user_id: `u${i}`, person_id: `p${i}`, login: null, password_change_required: i === 0 }));
    const r = await readAdminList("accounts", 21, signal());
    expect(state.calls).toContain("admin_account_overview");
    expect(state.calls).toContainEqual([1000, 1050]);
    expect(state.calls).toContainEqual(["person_id", "is", null]);
    expect(state.calls).toContain("login"); expect(state.calls).toContain("user_id");
    expect(state.calls).not.toContain("account_credential_events");
    expect(r.accounts).toHaveLength(50); expect(r.hasNext).toBe(true);
    expect(r.accounts[0]?.passwordChangeRequired).toBe(true);
  });
  it("last page does not falsely offer continuation", async () => {
    const r = await readAdminList("engagements", 33, signal());
    expect(state.calls).toContainEqual([1600, 1650]);
    expect(r.hasNext).toBe(false); expect(r.engagements).toEqual([]);
  });
  it("read denial is an error, never an empty successful account list", async () => {
    state.response.error = { message: "denied" };
    await expect(readAdminList("accounts", 1, signal())).rejects.toEqual({ message: "denied" });
  });
  it("malformed rows fail closed", async () => {
    state.response.data = [{ user_id: "u" }];
    await expect(readAdminList("accounts", 1, signal())).rejects.toThrow("shape:invalid");
  });
  it("expires at 15s and a subsequent attempt succeeds", async () => {
    vi.useFakeTimers(); state.held = true;
    const expired = expect(readAdminList("accounts", 1, signal())).rejects.toBeInstanceOf(ListTimeoutError);
    await vi.advanceTimersByTimeAsync(15_000); await expired;
    state.held = false;
    await expect(readAdminList("accounts", 1, signal())).resolves.toMatchObject({ accounts: [], hasNext: false });
  });
  it("cancels a replaced page even if its request never answers", async () => {
    state.held = true; const ctl = new AbortController();
    const cancelled = expect(readAdminList("engagements", 1, ctl.signal)).rejects.toMatchObject({ name: "AbortError" });
    ctl.abort(); await cancelled;
  });
});