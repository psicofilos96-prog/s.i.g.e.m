import { describe, expect, it } from "vitest";
import { GUIA_2026 } from "./layout/layout-schema";
import { buildConferenceFile, parseReturnFile, record00Values, validateLines } from "./export-builder";
import { projectIdentity } from "./school-identity";
import type { SchoolUnit } from "@/features/schools/school-registry";

const unit: SchoolUnit = { schoolId: "s1", identifiers: [{ schoolId: "s1", kind: "inep", value: "33094756" }],
  versions: [{ id: "v", schoolId: "s1", versionNumber: 1, supersedesVersionId: null, officialName: "E M AGUAS CLARAS", address: null, district: null, locationKind: "urbana", active: true, validFrom: "2026-01-01", originatingActRef: null, administrativeDependency: "municipal" }] };
const id = projectIdentity(unit, "2026-05-27", null, 1);

describe("arquivo de conferência Educacenso", () => {
  it("registro 00 tem a contagem do catálogo e só valores com fonte", () => {
    const v = record00Values(GUIA_2026, id);
    expect(v).toHaveLength(53);
    expect(v[1]).toBe("33094756");
    expect(v[6]).toBe("");
  });
  it("obrigatório vazio é impeditivo e bloqueia a geração", async () => {
    const r = await buildConferenceFile(GUIA_2026, [id], "sem-pipe");
    expect(r.issues.some((i) => i.impeditive && i.field === 7)).toBe(true);
    expect(r.text).toBeNull();
    expect(r.manifest.fileSha256).toBeNull();
    expect(r.manifest.official).toBe(false);
  });
  it("manifesto lista bloqueios oficiais enquanto o leiaute não for confrontado", async () => {
    const r = await buildConferenceFile(GUIA_2026, [id], "pipe");
    expect(r.manifest.blockers).toContain("fonte-nao-confrontada");
  });
  it("condicional vazio é alerta, não impeditivo", () => {
    const v = validateLines(GUIA_2026, [{ record: "00", values: record00Values(GUIA_2026, id) }]);
    expect(v.find((i) => i.field === 4)?.impeditive).toBe(false);
  });
  it("retorno do INEP nunca é aceito sem leiaute documentado", () => {
    expect(parseReturnFile("x")).toEqual({ accepted: false, reason: "leiaute-de-retorno-ausente" });
  });
});
