/**
 * 14.1.1 — Cadastro Institucional de Unidades Escolares.
 *
 * Identidade permanente = `schoolId` (institutional_schools.id), nunca nome nem INEP.
 * Atributos cadastrais mudam por VERSÃO encadeada (institutional_school_record_versions);
 * INEP e código de rede são identificadores imutáveis e únicos (institutional_school_identifiers).
 * A unidade não carrega contagens, taxas, frequência nem visitas: isso é fato/indicador.
 * Nada é inferido: campo não cadastrado permanece ausente (`null`).
 */

export type SchoolLocationKind = "urbana" | "rural";

export type SchoolRecordVersion = {
  id: string;
  schoolId: string;
  versionNumber: number;
  supersedesVersionId: string | null;
  officialName: string;
  address: string | null;
  district: string | null;
  locationKind: SchoolLocationKind | null;
  active: boolean;
  validFrom: string;
  originatingActRef: string | null;
  /** 14.11.1 — contato (cadastral) e infraestrutura (temporal pela própria versão). Ausente ≠ falso/zero. */
  phone?: string | null;
  institutionalEmail?: string | null;
  ownBuilding?: boolean | null;
  hardAccess?: boolean | null;
  classroomCount?: number | null;
  /** 0099 — classificação administrativa como na fonte (valores abertos). */
  administrativeDependency?: string | null;
  privateSchoolCategory?: string | null;
  partnershipPublicAuthority?: string | null;
};

export type SchoolIdentifier = { schoolId: string; kind: "inep" | "codigo-rede" | string; value: string };

export type SchoolUnit = {
  schoolId: string;
  identifiers: readonly SchoolIdentifier[];
  versions: readonly SchoolRecordVersion[];
};

/** Versão vigente numa data (maior versão com validFrom ≤ data). Ausente ⇒ null. */
export function schoolVersionAt(unit: SchoolUnit, on: string): SchoolRecordVersion | null {
  const eligible = unit.versions.filter((v) => v.validFrom <= on);
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a));
}

export function currentSchoolVersion(unit: SchoolUnit): SchoolRecordVersion | null {
  if (unit.versions.length === 0) return null;
  return unit.versions.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a));
}

export function schoolIdentifier(unit: SchoolUnit, kind: string): string | null {
  return unit.identifiers.find((i) => i.kind === kind)?.value ?? null;
}

/** Resolução só por identidade ou identificador exato; nunca por nome. */
export function resolveSchool(
  units: readonly SchoolUnit[],
  ref: { schoolId?: string; inep?: string; networkCode?: string; name?: string },
): SchoolUnit | null {
  if (ref.schoolId) return units.find((u) => u.schoolId === ref.schoolId) ?? null;
  if (ref.inep) return units.find((u) => schoolIdentifier(u, "inep") === ref.inep) ?? null;
  if (ref.networkCode) return units.find((u) => schoolIdentifier(u, "codigo-rede") === ref.networkCode) ?? null;
  return null; // nome não é identidade
}

export type RegistryViolation = { code: "duplicate-identifier" | "divergent-identifier" | "stale-base" | "missing-name"; detail: string };

/** Espelha as guardas do banco para validação antes do envio. */
export function validateIdentifiers(units: readonly SchoolUnit[]): RegistryViolation[] {
  const seen = new Map<string, string>();
  const out: RegistryViolation[] = [];
  for (const u of units)
    for (const i of u.identifiers) {
      const key = `${i.kind}:${i.value}`;
      const owner = seen.get(key);
      if (owner && owner !== u.schoolId) out.push({ code: "duplicate-identifier", detail: key });
      else seen.set(key, u.schoolId);
    }
  return out;
}

export function appendSchoolVersion(
  unit: SchoolUnit,
  baseVersionId: string | null,
  next: Omit<SchoolRecordVersion, "id" | "schoolId" | "versionNumber" | "supersedesVersionId">,
  id: string,
): { unit: SchoolUnit } | { violation: RegistryViolation } {
  if (!next.officialName.trim()) return { violation: { code: "missing-name", detail: "Nome oficial obrigatório" } };
  const cur = currentSchoolVersion(unit);
  if ((cur?.id ?? null) !== baseVersionId) return { violation: { code: "stale-base", detail: "Versão base superada" } };
  const v: SchoolRecordVersion = {
    ...next,
    id,
    schoolId: unit.schoolId,
    versionNumber: (cur?.versionNumber ?? 0) + 1,
    supersedesVersionId: cur?.id ?? null,
  };
  return { unit: { ...unit, versions: [...unit.versions, v] } };
}

// ---- Linhas do banco → domínio -------------------------------------------------
export type SchoolRow = { id: string };
export type SchoolIdentifierRow = { school_id: string; identifier_kind: string; value: string };
export type SchoolVersionRow = {
  id: string; school_id: string; version_number: number; supersedes_version_id: string | null;
  official_name: string; address: string | null; district: string | null; location_kind: string | null;
  active: boolean; valid_from: string; originating_act_ref: string | null;
  phone?: string | null; institutional_email?: string | null; own_building?: boolean | null; hard_access?: boolean | null; classroom_count?: number | null;
  administrative_dependency?: string | null; private_school_category?: string | null; partnership_public_authority?: string | null;
};

export function unitsFromRows(
  schools: readonly SchoolRow[], ids: readonly SchoolIdentifierRow[], versions: readonly SchoolVersionRow[],
): SchoolUnit[] {
  return schools.map((s) => ({
    schoolId: s.id,
    identifiers: ids.filter((i) => i.school_id === s.id).map((i) => ({ schoolId: s.id, kind: i.identifier_kind, value: i.value })),
    versions: versions.filter((v) => v.school_id === s.id).map((v) => ({
      id: v.id, schoolId: v.school_id, versionNumber: v.version_number, supersedesVersionId: v.supersedes_version_id,
      officialName: v.official_name, address: v.address, district: v.district,
      locationKind: v.location_kind === "urbana" || v.location_kind === "rural" ? v.location_kind : null,
      active: v.active, validFrom: v.valid_from, originatingActRef: v.originating_act_ref,
      phone: v.phone ?? null, institutionalEmail: v.institutional_email ?? null, ownBuilding: v.own_building ?? null,
      hardAccess: v.hard_access ?? null, classroomCount: v.classroom_count ?? null,
      administrativeDependency: v.administrative_dependency ?? null, privateSchoolCategory: v.private_school_category ?? null,
      partnershipPublicAuthority: v.partnership_public_authority ?? null,
    })),
  }));
}
