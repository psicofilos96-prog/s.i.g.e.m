/**
 * B2.6/B2.7 — Projeção pura das linhas de `class_offering_at` / `class_shift_at`.
 * Sem cliente de banco: usada pela fonte da Turma, pelo CIECE/Mapa e pelo Diário,
 * para que todos leiam a mesma resposta bitemporal do reader. Zero linhas =
 * não registrado; mais de uma versão = inconsistência (erro), nunca escolha.
 */
export const SHIFT_SCHEME = "turno" as const;

export type AxisValue = { schemeId: string; valueId: string; valueVersion: number; label: string | null };
export type OfferingState = {
  versionId: string; logicalId: string; version: number; validFrom: string; validUntil: string | null;
  correctionReason: string | null; actRef: string | null; createdAt: string; axes: AxisValue[];
};
export type ShiftState = {
  versionId: string; logicalId: string; version: number; validFrom: string; validUntil: string | null;
  correctionReason: string | null; actRef: string | null; createdAt: string; value: AxisValue;
};

export type OfferingAtRow = {
  offering_version_id: string; logical_id: string; version: number; valid_from: string; valid_until: string | null;
  correction_reason: string | null; originating_act_ref: string | null; created_at: string;
  scheme_id: string; value_id: string; value_version: number; value_label: string | null;
};
export type ShiftAtRow = Omit<OfferingAtRow, "offering_version_id" | "scheme_id"> & { shift_version_id: string };

export function projectOffering(rows: readonly OfferingAtRow[] | null | undefined): OfferingState | null {
  if (!rows || rows.length === 0) return null;
  const ids = new Set(rows.map((r) => r.offering_version_id));
  if (ids.size > 1) throw new Error("offering:ambiguous-temporal-state");
  const h = rows[0]!;
  return {
    versionId: h.offering_version_id, logicalId: h.logical_id, version: h.version, validFrom: h.valid_from, validUntil: h.valid_until,
    correctionReason: h.correction_reason, actRef: h.originating_act_ref, createdAt: h.created_at,
    axes: rows.map((r) => ({ schemeId: r.scheme_id, valueId: r.value_id, valueVersion: r.value_version, label: r.value_label }))
      .sort((a, b) => a.schemeId.localeCompare(b.schemeId)),
  };
}
export function projectShift(rows: readonly ShiftAtRow[] | null | undefined): ShiftState | null {
  if (!rows || rows.length === 0) return null;
  if (rows.length > 1) throw new Error("shift:ambiguous-temporal-state");
  const h = rows[0]!;
  return {
    versionId: h.shift_version_id, logicalId: h.logical_id, version: h.version, validFrom: h.valid_from, validUntil: h.valid_until,
    correctionReason: h.correction_reason, actRef: h.originating_act_ref, createdAt: h.created_at,
    value: { schemeId: SHIFT_SCHEME, valueId: h.value_id, valueVersion: h.value_version, label: h.value_label },
  };
}

/** Contexto temporal explícito da consulta: validOn = quando vale; knownAt = o que se conhecia (nulo ⇒ agora). */
export type BitemporalContext = { validOn: string; knownAt?: string | null };
export const readerArgs = (classId: string, t: BitemporalContext) =>
  ({ _class_id: classId, _valid_on: t.validOn, ...(t.knownAt ? { _known_at: t.knownAt } : {}) });
