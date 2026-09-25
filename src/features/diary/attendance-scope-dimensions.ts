/**
 * Dimensões de apuração da frequência (refinamentos 1, 2 e 6).
 *
 * Cada dimensão declara apenas COMO sua identidade é resolvida no contexto
 * corrente. Acrescentar uma dimensão é acrescentar um registro de dados: não
 * existe nem pode existir condicional do tipo `if (scopeKind === "componente")`
 * nem qualquer lógica por etapa, modalidade ou segmento.
 */
import {
  attendanceScopeLabel,
  type AttendanceAccountingScopeKind,
  type AttendanceAccountingUnitRef,
} from "./attendance-closing-types";

/** Identidades disponíveis no contexto. O que não existir fica indefinido. */
export type AttendanceScopeResolutionContext = {
  classId?: string;
  classLabel?: string;
  curriculumUnitId?: string;
  curriculumUnitLabel?: string;
  blockId?: string;
  blockLabel?: string;
  shiftId?: string;
  shiftLabel?: string;
  schoolDayId?: string;
  schoolDayLabel?: string;
  /** Dimensões futuras entram aqui por identificador, sem alterar o motor. */
  extra?: Readonly<Record<string, { id: string; label: string }>>;
};

export type AttendanceScopeDimension = {
  id: AttendanceAccountingScopeKind;
  label: string;
  resolve: (
    context: AttendanceScopeResolutionContext,
  ) => { id: string; label: string } | null;
};

const pair = (id?: string, label?: string) => (id ? { id, label: label ?? id } : null);

export const ATTENDANCE_SCOPE_DIMENSIONS: AttendanceScopeDimension[] = [
  {
    id: "componente-ou-campo",
    label: attendanceScopeLabel("componente-ou-campo"),
    resolve: (c) => pair(c.curriculumUnitId, c.curriculumUnitLabel),
  },
  {
    id: "turma-integrada",
    label: attendanceScopeLabel("turma-integrada"),
    resolve: (c) => pair(c.classId, c.classLabel),
  },
  { id: "bloco", label: attendanceScopeLabel("bloco"), resolve: (c) => pair(c.blockId, c.blockLabel) },
  { id: "turno", label: attendanceScopeLabel("turno"), resolve: (c) => pair(c.shiftId, c.shiftLabel) },
  {
    id: "dia-escolar",
    label: attendanceScopeLabel("dia-escolar"),
    resolve: (c) => pair(c.schoolDayId, c.schoolDayLabel),
  },
];

export const scopeDimensionById = (id: AttendanceAccountingScopeKind) =>
  ATTENDANCE_SCOPE_DIMENSIONS.find((dimension) => dimension.id === id);

/**
 * Resolve a unidade de apuração declarada pela política. Retorna `null` quando
 * a dimensão não está cadastrada ou o contexto não possui aquela identidade —
 * nunca substitui por outra dimensão nem presume identidade.
 */
export function resolveAttendanceAccountingUnit(args: {
  scopeKind: AttendanceAccountingScopeKind;
  context: AttendanceScopeResolutionContext;
  /** Registro de dimensões aplicável (permite dimensões cadastradas pela rede). */
  dimensions?: readonly AttendanceScopeDimension[];
}): AttendanceAccountingUnitRef | null {
  const registry = args.dimensions ?? ATTENDANCE_SCOPE_DIMENSIONS;
  const dimension = registry.find((item) => item.id === args.scopeKind);
  const resolved =
    dimension?.resolve(args.context) ?? args.context.extra?.[args.scopeKind] ?? null;
  if (!resolved) return null;
  return { kind: args.scopeKind, id: resolved.id, label: resolved.label };
}

