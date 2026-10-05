import { describe, expect, it } from "vitest";
import {
  buildInfrastructurePreview,
  coerceCell,
  schoolInfrastructureAt,
  type InfraAttributeDecl,
  type InfraObservationRow,
} from "./school-infrastructure";

const H = "a".repeat(64);
const attrs: InfraAttributeDecl[] = [
  { attribute_id: "agua-potavel", label: "Água potável", value_type: "boolean" },
  { attribute_id: "salas-utilizadas", label: "Salas utilizadas", value_type: "integer" },
  { attribute_id: "abastecimento", label: "Abastecimento", value_type: "catalog", catalog_values: ["Rede pública", "Poço"] },
];
const known = new Set(["33094756", "33100012"]);

describe("infraestrutura — preparação do payload (fixtures sintéticas)", () => {
  it("false e 0 são valores; vazio é não informado", () => {
    expect(coerceCell(attrs[0], "0").value).toBe(false);
    expect(coerceCell(attrs[1], 0).value).toBe(0);
    expect(coerceCell(attrs[0], "").value).toBeNull();
    expect(coerceCell(attrs[1], undefined).value).toBeNull();
  });
  it("recusa escola inexistente, INEP duplicado, atributo desconhecido e valor fora do catálogo", () => {
    const p = buildInfrastructurePreview({
      sourceHash: H, sourceRef: "s.xlsx", attributes: attrs, knownIneps: known,
      rows: [
        { inep: "33094756", locator: "l2", values: { "agua-potavel": "0", "salas-utilizadas": 0 } },
        { inep: "33094756", locator: "l3", values: {} },
        { inep: "99999999", locator: "l4", values: {} },
        { inep: "33100012", locator: "l5", values: { abastecimento: "Cisterna", extra: 1 } },
      ],
    });
    const codes = p.issues.map((i) => i.code).sort();
    expect(codes).toEqual(["atributo-desconhecido", "escola-inexistente", "inep-duplicado", "valor-fora-do-catalogo"]);
    expect(p.payload.observations).toHaveLength(2);
    expect(p.payload.manifest).toMatchObject({ observation_count: 2, school_count: 1, attribute_count: 3 });
    expect(p.byAttribute["agua-potavel"].informed).toBe(1);
  });
  it("hash inválido é sinalizado", () => {
    const p = buildInfrastructurePreview({ sourceHash: "x", sourceRef: "s", attributes: attrs, rows: [], knownIneps: known });
    expect(p.issues[0].code).toBe("hash-invalido");
  });
  it("payload é determinístico (reimportação idempotente usa o mesmo fingerprint)", () => {
    const args = { sourceHash: H, sourceRef: "s", attributes: attrs, knownIneps: known, rows: [{ inep: "33100012", locator: "l2", values: { "salas-utilizadas": 7 } }] };
    expect(JSON.stringify(buildInfrastructurePreview(args).payload)).toBe(JSON.stringify(buildInfrastructurePreview(args).payload));
  });
});

describe("infraestrutura — projeção de leitura", () => {
  const ob = (p: Partial<InfraObservationRow>): InfraObservationRow => ({
    id: Math.random().toString(), school_id: "inep-1", attribute_id: "salas-utilizadas", value_boolean: null, value_integer: null,
    value_decimal: null, value_text: null, value_catalog: null, valid_from: "2026-08-31", known_at: "2026-10-05T00:00:00Z",
    source_hash: H, source_ref: "s", source_locator: null, technical_operation_id: null, author_user_id: null, ...p,
  });
  const ar = [
    { id: "a", attribute_id: "salas-utilizadas", version_number: 1, label: "Salas", value_type: "integer", catalog_values: null, unit_label: null, source_field: null },
    { id: "b", attribute_id: "agua-potavel", version_number: 1, label: "Água", value_type: "boolean", catalog_values: null, unit_label: null, source_field: null },
  ];
  it("ausente ≠ zero ≠ false; mudança entre snapshots preserva histórico", () => {
    const obs = [ob({ value_integer: 0 }), ob({ value_integer: 9, valid_from: "2026-09-30" })];
    const v = schoolInfrastructureAt("inep-1", ar, obs, "2026-09-01");
    const salas = v.find((f) => f.attributeId === "salas-utilizadas")!;
    expect(salas.display).toBe("0");
    expect(salas.history).toHaveLength(2);
    expect(v.find((f) => f.attributeId === "agua-potavel")!.display).toBe("não informado");
    expect(schoolInfrastructureAt("inep-1", ar, obs, "2026-10-01").find((f) => f.attributeId === "salas-utilizadas")!.display).toBe("9");
    expect(schoolInfrastructureAt("inep-1", ar, [ob({ attribute_id: "agua-potavel", value_boolean: false })], "2026-09-01")
      .find((f) => f.attributeId === "agua-potavel")!.display).toBe("não");
  });
});
