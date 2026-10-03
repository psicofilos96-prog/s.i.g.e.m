import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapPositionRow, positionDraftProblems, positionWriterArgs } from "./allocation-curricular-position-source";

const base = {
  allocation_id: "a1", allocation_logical_id: "a1", student_id: "e1", school_id: "s1", class_id: "c1",
  position_version_id: null, position_logical_id: null, position_version: null, valid_from: null, valid_until: null,
  axes: null, originating_act_ref: null, change_reason: null, recorded_at: null,
};

describe("B3.3 posição curricular da alocação", () => {
  it("ausência de posição permanece null, nunca inferida da turma", () => {
    expect(mapPositionRow(base).position).toBeNull();
  });
  it("mapeia posição com eixos abertos", () => {
    const r = mapPositionRow({ ...base, position_version_id: "v", position_logical_id: "p", position_version: 2, valid_from: "2026-02-01",
      axes: [{ scheme: "x", value: "y", version: 1 }], recorded_at: "t" });
    expect(r.position).toMatchObject({ logicalId: "p", version: 2, axes: [{ scheme: "x", value: "y", version: 1 }] });
  });
  it("valida forma: eixo obrigatório, esquema único, motivo na correção", () => {
    expect(positionDraftProblems({ validFrom: "2026-02-01", validUntil: null, axes: [], baseVersionId: null, reason: "" })).toHaveLength(1);
    const ax = [{ scheme: "x", value: "a", version: 1 }, { scheme: "x", value: "b", version: 1 }];
    expect(positionDraftProblems({ validFrom: "2026-02-01", validUntil: "2026-01-01", axes: ax, baseVersionId: "b", reason: "" })).toHaveLength(3);
  });
  it("anulação não envia datas nem eixos", () => {
    const a = positionWriterArgs({ logicalId: "p", baseVersionId: "v", allocationLogicalId: "a", validFrom: "2026-01-01", validUntil: null,
      axes: [{ scheme: "x", value: "y", version: 1 }], actRef: null, reason: "m", annul: true });
    expect(a).toMatchObject({ _valid_from: null, _axes: null, _annul: true });
  });
  it("módulo não fixa esquemas de etapa/ano nem lê legados", () => {
    const src = readFileSync("src/features/student-life/allocation-curricular-position-source.ts", "utf8");
    expect(src).not.toMatch(/stageId|offerId|stage_id|offer_id|class_label_snapshot/);
    expect(src).not.toMatch(/SCHEME\s*=\s*"/);
  });
  it("migration B3.3 é aditiva e não semeia valores", () => {
    const sql = readFileSync("drizzle/migrations/0008_b3_3_allocation_curricular_position.sql", "utf8");
    expect(sql).not.toMatch(/INSERT INTO public\.attribute_value_definitions/i);
    expect(sql).not.toMatch(/ALTER TABLE public\.class_enrollment_episodes/i);
    expect(sql).not.toMatch(/capability_policy_rules/i);
  });
});
