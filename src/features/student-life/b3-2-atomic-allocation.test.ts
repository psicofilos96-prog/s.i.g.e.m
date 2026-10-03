import { describe, expect, it, vi } from "vitest";
import { allocationEndInputState, recordClassAllocation } from "./cycle-enrollment-source";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: async () => ({ data: null, error: null }) },
}));

function client() {
  return {
    rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
      data: "allocation-id",
      error: null,
    })),
  };
}

describe("B3.2 — constituição atômica da alocação", () => {
  it("exige data final explícita na UI apenas quando a participação está delimitada", () => {
    expect(allocationEndInputState("2026-02-01", null, "").canSubmit).toBe(true);
    expect(allocationEndInputState("2026-02-01", "2026-12-20", "").canSubmit).toBe(false);
    expect(allocationEndInputState("2026-02-01", "2026-12-20", "2026-12-20").canSubmit).toBe(true);
    expect(allocationEndInputState("2026-03-01", "2026-12-20", "2026-06-30").canSubmit).toBe(true);
    expect(allocationEndInputState("2026-03-01", "2026-12-20", "2026-02-28").canSubmit).toBe(false);
    expect(allocationEndInputState("2026-03-01", "2026-12-20", "2026-12-21").canSubmit).toBe(false);
  });

  it("envia o término explícito no mesmo RPC que cria a alocação", async () => {
    const c = client();
    await recordClassAllocation(
      {
        id: "a-1",
        participationLogicalId: "p-1",
        classId: "t-1",
        validFrom: "2026-03-01",
        validUntil: "2026-06-30",
        actRef: "ato-1",
      },
      c as never,
    );
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith("record_class_allocation", {
      _id: "a-1",
      _participation_logical: "p-1",
      _class: "t-1",
      _valid_from: "2026-03-01",
      _act_ref: "ato-1",
      _supersedes: null,
      _correction_reason: null,
      _ended_on: "2026-06-30",
    });
  });

  it("não inventa uma data final quando ela não foi fornecida", async () => {
    const c = client();
    await recordClassAllocation(
      { id: "a-2", participationLogicalId: "p-2", classId: "t-1", validFrom: "2026-02-01" },
      c as never,
    );
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc.mock.calls[0]?.[1]).not.toHaveProperty("_ended_on");
  });
});
