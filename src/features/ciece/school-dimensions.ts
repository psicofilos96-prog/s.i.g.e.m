/**
 * 14.1.1 — Adaptador de dimensões escolares para o CIECE.
 * O cadastro de unidades é a FONTE; a 14.1 é o contrato. Nada é copiado nem
 * persistido pelo CIECE: as dimensões são resolvidas por `schoolId` na leitura,
 * na versão vigente na data do fato (mudança posterior não reescreve fato antigo).
 */
import { schoolIdentifier, schoolVersionAt, type SchoolUnit } from "@/features/schools/school-registry";

export type SchoolDimensionValue = { value: string | null; availability: "disponivel" | "ausente" };

export type SchoolDimensions = {
  schoolId: string;
  sourceVersionId: string | null;
  schoolInep: SchoolDimensionValue;
  schoolRedeCode: SchoolDimensionValue;
  schoolAddress: SchoolDimensionValue;
  schoolDistrict: SchoolDimensionValue;
  schoolLocation: SchoolDimensionValue;
  schoolActive: boolean | null;
};

const dim = (v: string | null): SchoolDimensionValue => ({ value: v, availability: v == null ? "ausente" : "disponivel" });

export function projectSchoolDimensions(
  units: readonly SchoolUnit[], schoolId: string, on: string,
): SchoolDimensions | null {
  const unit = units.find((u) => u.schoolId === schoolId);
  if (!unit) return null;
  const v = schoolVersionAt(unit, on);
  return {
    schoolId,
    sourceVersionId: v?.id ?? null,
    schoolInep: dim(schoolIdentifier(unit, "inep")),
    schoolRedeCode: dim(schoolIdentifier(unit, "codigo-rede")),
    schoolAddress: dim(v?.address ?? null),
    schoolDistrict: dim(v?.district ?? null),
    schoolLocation: dim(v?.locationKind ?? null),
    schoolActive: v ? v.active : null,
  };
}
