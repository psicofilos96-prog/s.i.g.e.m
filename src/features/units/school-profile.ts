/**
 * AQ — Ficha institucional da unidade: projeção pura das versões cadastrais canônicas
 * (institutional_school_record_versions) e das observações de infraestrutura (0105).
 * Nenhuma cópia: tudo é derivado das linhas lidas com a sessão.
 */
import type { SchoolRecordVersion, SchoolUnit } from "@/features/schools/school-registry";
import type { InfraFactView, InfraObservationRow } from "@/features/schools/school-infrastructure";

/** Versão vigente em asOf conforme o que o SIGEM sabia em knownAt (registered_at ≤ knownAt). */
export function schoolVersionAsOf(unit: SchoolUnit, asOf: string, knownAt?: string | null): SchoolRecordVersion | null {
  const known = unit.versions.filter((v) => !knownAt || !v.registeredAt || v.registeredAt <= knownAt);
  const eligible = known.filter((v) => v.validFrom <= asOf);
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a));
}

/** Observações conhecidas em knownAt; o filtro nunca transforma ausência em "não possui". */
export function observationsKnownAt<T extends Pick<InfraObservationRow, "known_at">>(rows: readonly T[], knownAt?: string | null): T[] {
  return knownAt ? rows.filter((o) => o.known_at <= knownAt) : [...rows];
}

/** Estado de um fato: SIM/NÃO só quando há valor; sem valor na fonte ⇒ NOT_REPORTED (nunca "não"). */
export type FactState = "YES" | "NO" | "VALUE" | "NOT_REPORTED";
export function factState(v: boolean | number | string | null | undefined): FactState {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return "NOT_REPORTED";
  if (typeof v === "boolean") return v ? "YES" : "NO";
  return "VALUE";
}

export type ProfilePendency = { kind: "cadastral-nao-informado" | "infraestrutura-nao-informada" | "sem-versao-na-data"; field: string; detail: string };

const CADASTRAL: [keyof SchoolRecordVersion, string][] = [
  ["address", "Endereço"], ["district", "Distrito"], ["locationKind", "Localização"], ["phone", "Telefone"],
  ["institutionalEmail", "E-mail institucional"], ["ownBuilding", "Prédio próprio"], ["hardAccess", "Acesso difícil"],
  ["classroomCount", "Salas de aula"], ["administrativeDependency", "Dependência administrativa"],
];

/** Pendências de qualidade: só ausência de dado, sem nota, ranking nem presunção de valor. */
export function profilePendencies(v: SchoolRecordVersion | null, infra: readonly InfraFactView[]): ProfilePendency[] {
  if (!v) return [{ kind: "sem-versao-na-data", field: "cadastro", detail: "Nenhuma versão cadastral vigente na data/conhecimento escolhidos." }];
  const out: ProfilePendency[] = [];
  for (const [k, label] of CADASTRAL)
    if (factState(v[k] as never) === "NOT_REPORTED") out.push({ kind: "cadastral-nao-informado", field: label, detail: `${label}: não informado na versão ${v.versionNumber}.` });
  for (const f of infra)
    if (f.current === null) out.push({ kind: "infraestrutura-nao-informada", field: f.label, detail: `${f.label}: sem observação na fonte (não informado, não significa "não possui").` });
  return out;
}
