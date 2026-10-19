import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { supervisionReadKey, canRecordSupervision } from "./supervision-read";
import type { SessionAuthority } from "@/features/authority/session-authority";
import type { User } from "@supabase/supabase-js";

const base: Extract<SessionAuthority, { status: "signed-in" }> = {
  status: "signed-in", user: { id: "account-a" } as User, sessionRevision: 1,
  person: { id: "person-a", displayName: "Pessoa" }, capabilities: [{ capabilityId: "registrar-acompanhamento-da-supervisao", engagementId: "engagement", policyId: "policy", policyVersion: 1, schoolId: "school-a", classId: null, componentId: null, periodId: null }],
};
const cap = { capabilityId: "registrar-acompanhamento-da-supervisao", engagementId: "engagement", policyId: "policy", policyVersion: 1, schoolId: "school-a", classId: null, componentId: null, periodId: null };

describe("Supervision confirmed read and writer controls", () => {
  it("does not read while session is loading or signed out", () => {
    expect(supervisionReadKey({ status: "loading" })).toBeNull();
    expect(supervisionReadKey({ status: "signed-out" })).toBeNull();
  });
  it("requires a confirmed person or institutional principal", () => {
    expect(supervisionReadKey({ ...base, person: null })).toBeNull();
    expect(supervisionReadKey(base)).toBe("account-a#1");
  });
  it("isolates reads across accounts and session revisions", () => {
    expect(supervisionReadKey({ ...base, sessionRevision: 2 })).toBe("account-a#2");
    expect(supervisionReadKey({ ...base, user: { id: "account-b" } as User })).toBe("account-b#1");
  });
  it("does not show recording authority for another school", () => {
    expect(canRecordSupervision({ ...base, capabilities: [cap] }, "school-a")).toBe(true);
    expect(canRecordSupervision({ ...base, capabilities: [cap] }, "school-b")).toBe(false);
  });
  it("does not infer human authorship from an institutional account", () => {
    expect(canRecordSupervision({ ...base, person: null, capabilities: [cap] }, "school-a")).toBe(false);
  });
});