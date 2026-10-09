import { describe, expect, it } from "vitest";
import { infrastructureQueue } from "./infrastructure-network-queue";

const attr = (id: string) => ({ id, attribute_id: id, version_number: 1, label: id, value_type: "boolean", catalog_values: null, unit_label: null, source_field: null });
const obs = (school: string, a: string, from = "2026-01-01") => ({ id: `${school}${a}`, school_id: school, attribute_id: a, value_boolean: false, value_integer: null, value_decimal: null, value_text: null, value_catalog: null, valid_from: from, known_at: "2026-01-01T00:00:00Z", source_hash: "h", source_ref: "r", source_locator: null, technical_operation_id: null, author_user_id: null });

describe("fila de infraestrutura da rede", () => {
  const attrs = [attr("agua"), attr("rampa")];
  it("valor false conta como informado; ausência não", () => {
    const q = infrastructureQueue(["A", "B"], attrs, [obs("A", "agua"), obs("A", "rampa"), obs("B", "agua")], "2026-03-01");
    expect(q[0]).toMatchObject({ schoolId: "B", informed: 1, missing: ["rampa"] });
    expect(q[1]).toMatchObject({ schoolId: "A", informed: 2, missing: [] });
  });
  it("observação futura ainda não vale", () => {
    expect(infrastructureQueue(["A"], attrs, [obs("A", "agua", "2027-01-01")], "2026-03-01")[0]!.informed).toBe(0);
  });
});

import { infrastructureQueueFromCoverage } from "./infrastructure-network-queue";
describe("PERF.LOADING.3 — fila pela cobertura agregada no servidor", () => {
  it("dá o mesmo resultado que a projeção sobre todas as observações", () => {
    const attrs = [attr("agua"), attr("rampa"), attr("luz")];
    const all = [obs("A", "agua"), obs("A", "rampa"), obs("B", "agua"), obs("C", "luz", "2027-01-01")];
    const on = "2026-03-01";
    const coverage = ["A", "B", "C"].map((s) => ({ school_id: s, informed_attribute_ids: [...new Set(all.filter((o) => o.school_id === s && o.valid_from <= on).map((o) => o.attribute_id))] }));
    expect(infrastructureQueueFromCoverage(["A", "B", "C", "D"], attrs, coverage)).toEqual(infrastructureQueue(["A", "B", "C", "D"], attrs, all, on));
  });
});
