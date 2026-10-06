import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isCanonicalAssignmentId, LEGACY_LESSON_WRITE_RETIRED } from "./diary-cloud";

describe("W.1 — contrato TS ↔ RPC do Diário", () => {
  it("só regência canônica (ta-…) é aceita para gravação", () => {
    expect(isCanonicalAssignmentId("ta-1")).toBe(true);
    expect(isCanonicalAssignmentId("atuacao:x")).toBe(false);
    expect(isCanonicalAssignmentId(undefined)).toBe(false);
    expect(LEGACY_LESSON_WRITE_RETIRED.ok).toBe(false);
  });
  it("nenhum consumidor chama writer v1", () => {
    for (const f of ["src/features/diary/diary-cloud.ts", "src/features/teacher-diary/diary-w-source.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/["']record_lesson_version["']/);
      expect(s).not.toMatch(/["']record_attendance_version["']/);
    }
  });
});
