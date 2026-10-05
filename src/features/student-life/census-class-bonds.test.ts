import { describe, expect, it, vi } from "vitest";

const rows = [{ id: "o1", enrollment_code: "M1", stage_literal: null, multi_stage_literal: null, valid_from: null, known_at: "2026-07-31T10:00:00-03:00", institutional_students: null }];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }) },
}));

import { censusClassBonds } from "./census-class-bonds";

describe("vínculos censitários observados", () => {
  it("ausência continua ausência: início, etapa e nome não viram valor padrão", async () => {
    const [b] = await censusClassBonds("turma-x");
    expect(b).toMatchObject({ validFrom: null, stage: null, studentName: null, knownAt: "2026-07-31T10:00:00-03:00" });
  });
});
