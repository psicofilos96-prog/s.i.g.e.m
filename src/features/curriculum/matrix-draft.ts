import { formatAcademicDate } from "@/lib/academic-date";
/**
 * RASCUNHO DE MATRIZ CURRICULAR — MODELO DE UX, NÃO MODELO DE BANCO.
 *
 * Este módulo contém apenas estado local e funções puras para demonstrar a
 * experiência de criação, edição e versionamento de matrizes curriculares.
 * Nada aqui é persistido, nem constitui schema, enumeração oficial, regra
 * acadêmica ou fluxo de aprovação normativa.
 *
 * Princípio central representado: uma matriz possui identidade e versões.
 * Editar um rascunho NUNCA altera a estrutura de uma versão anterior — os
 * fixtures de origem são copiados de forma profunda antes de qualquer edição.
 */

import type {
  CurriculumMatrix,
  CurriculumStructure,
  DemoMatrixSegment,
  ExperienceFieldsStructure,
  ExtendedTimeStructure,
  MatrixGridStructure,
} from "./curriculum-data";

/** Converte data ISO para leitura institucional (delegado à camada canônica). */
export function formatIsoDate(value: string) {
  return formatAcademicDate(value);
}

export type MatrixDraftOrigin = {
  matrixId: string;
  versionLabel: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  structure: CurriculumStructure;
};

export type MatrixDraft = {
  /** Versão que serviu de origem; null quando a matriz é criada do zero. */
  origin: MatrixDraftOrigin | null;
  name: string;
  code: string;
  segment: DemoMatrixSegment | "";
  organization: string;
  versionLabel: string;
  normativeReference: string;
  /** Vigência demonstrativa em ISO para permitir validação de intervalo. */
  effectiveFrom: string;
  effectiveUntil: string;
  summary: string;
  structure: CurriculumStructure;
};

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nextVersionLabel(label: string) {
  const match = /(\d+)\s*$/.exec(label);
  if (!match) return `${label} (nova versão)`;
  return label.replace(/(\d+)\s*$/, String(Number(match[1]) + 1));
}

function nextCode(code: string) {
  const match = /(\d+)\s*$/.exec(code);
  if (!match) return `${code}-NOVA`;
  const digits = match[1]!;
  return code.replace(/(\d+)\s*$/, String(Number(digits) + 1).padStart(digits.length, "0"));
}

/** Nova versão a partir de matriz existente: cópia independente da estrutura. */
export function createDraftFromMatrix(matrix: CurriculumMatrix, copyStructure = true): MatrixDraft {
  return {
    origin: {
      matrixId: matrix.id,
      versionLabel: matrix.version,
      effectiveFrom: matrix.effectiveFrom,
      effectiveUntil: matrix.effectiveUntil,
      structure: deepCopy(matrix.structure),
    },
    name: matrix.name,
    code: nextCode(matrix.code),
    segment: matrix.segment,
    organization: matrix.organization,
    versionLabel: nextVersionLabel(matrix.version),
    normativeReference: "",
    effectiveFrom: "",
    effectiveUntil: "",
    summary: matrix.summary,
    structure: copyStructure ? deepCopy(matrix.structure) : emptyStructureLike(matrix.structure),
  };
}

/** Estrutura vazia do mesmo tipo, para iniciar sem partir de cópia. */
export function emptyStructureLike(structure: CurriculumStructure): CurriculumStructure {
  if (structure.kind === "grid") {
    return {
      ...deepCopy(structure),
      groups: [{ id: "elementos", rows: [] }],
    };
  }
  if (structure.kind === "experience-fields") {
    return { ...deepCopy(structure), fields: [] };
  }
  return { ...deepCopy(structure), axes: [] };
}

export function createBlankGridDraft(): MatrixDraft {
  return {
    origin: null,
    name: "",
    code: "",
    segment: "",
    organization: "",
    versionLabel: "Versão 1",
    normativeReference: "",
    effectiveFrom: "",
    effectiveUntil: "",
    summary: "",
    structure: {
      kind: "grid",
      organizationLabel: "",
      rowsHeader: "Elementos curriculares",
      unitLabel: "horas semanais",
      columns: [
        { id: "col-1", label: "1ª coluna" },
        { id: "col-2", label: "2ª coluna" },
      ],
      groups: [{ id: "elementos", rows: [] }],
      totals: [null, null],
      totalsLabel: "Referência documentada",
      legend: ["Estrutura em rascunho demonstrativo; nenhum valor é oficial."],
    },
  };
}

/* ------------------------------ estrutura: grid ----------------------------- */

function withGrid(
  draft: MatrixDraft,
  update: (structure: MatrixGridStructure) => MatrixGridStructure,
): MatrixDraft {
  if (draft.structure.kind !== "grid") return draft;
  return { ...draft, structure: update(deepCopy(draft.structure)) };
}

/** Terminologia neutra: "elemento curricular" cobre componente, campo e afins. */
export function addGridElement(draft: MatrixDraft, label = ""): MatrixDraft {
  return withGrid(draft, (structure) => {
    const group = structure.groups[0] ?? { id: "elementos", rows: [] };
    group.rows = [
      ...group.rows,
      {
        id: `el-${Date.now()}-${group.rows.length}`,
        label,
        values: structure.columns.map(() => null),
      },
    ];
    structure.groups = [group, ...structure.groups.slice(1)];
    return structure;
  });
}

export function removeGridElement(draft: MatrixDraft, rowId: string): MatrixDraft {
  return withGrid(draft, (structure) => {
    structure.groups = structure.groups.map((group) => ({
      ...group,
      rows: group.rows.filter((row) => row.id !== rowId),
    }));
    return structure;
  });
}

export function moveGridElement(
  draft: MatrixDraft,
  rowId: string,
  direction: "up" | "down",
): MatrixDraft {
  return withGrid(draft, (structure) => {
    structure.groups = structure.groups.map((group) => {
      const index = group.rows.findIndex((row) => row.id === rowId);
      if (index < 0) return group;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= group.rows.length) return group;
      const rows = [...group.rows];
      const moved = rows[index]!;
      rows[index] = rows[target]!;
      rows[target] = moved;
      return { ...group, rows };
    });
    return structure;
  });
}

export function setGridElementLabel(draft: MatrixDraft, rowId: string, label: string): MatrixDraft {
  return withGrid(draft, (structure) => {
    structure.groups = structure.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => (row.id === rowId ? { ...row, label } : row)),
    }));
    return structure;
  });
}

export function setGridValue(
  draft: MatrixDraft,
  rowId: string,
  columnIndex: number,
  raw: string,
): MatrixDraft {
  const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
  const value = parsed === null || Number.isNaN(parsed) ? null : parsed;
  return withGrid(draft, (structure) => {
    structure.groups = structure.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => {
        if (row.id !== rowId) return row;
        const values = [...row.values];
        values[columnIndex] = value;
        return { ...row, values };
      }),
    }));
    return structure;
  });
}

/** Total demonstrativo calculado a partir da estrutura editada. */
export function computeGridTotals(structure: MatrixGridStructure): Array<number | null> {
  return structure.columns.map((_, index) => {
    const values = structure.groups
      .flatMap((group) => group.rows)
      .map((row) => row.values[index] ?? null)
      .filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  });
}

export function gridRows(structure: MatrixGridStructure) {
  return structure.groups.flatMap((group) => group.rows);
}

/* -------------------- estrutura: campos de experiências --------------------- */

function withFields(
  draft: MatrixDraft,
  update: (structure: ExperienceFieldsStructure) => ExperienceFieldsStructure,
): MatrixDraft {
  if (draft.structure.kind !== "experience-fields") return draft;
  return { ...draft, structure: update(deepCopy(draft.structure)) };
}

export function addExperienceField(draft: MatrixDraft, label = ""): MatrixDraft {
  return withFields(draft, (structure) => {
    structure.fields = [
      ...structure.fields,
      {
        id: `campo-${Date.now()}-${structure.fields.length}`,
        label,
        description: "Descrição demonstrativa a definir.",
      },
    ];
    return structure;
  });
}

export function removeExperienceField(draft: MatrixDraft, fieldId: string): MatrixDraft {
  return withFields(draft, (structure) => {
    structure.fields = structure.fields.filter((field) => field.id !== fieldId);
    return structure;
  });
}

export function moveExperienceField(
  draft: MatrixDraft,
  fieldId: string,
  direction: "up" | "down",
): MatrixDraft {
  return withFields(draft, (structure) => {
    const index = structure.fields.findIndex((field) => field.id === fieldId);
    if (index < 0) return structure;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= structure.fields.length) return structure;
    const fields = [...structure.fields];
    const moved = fields[index]!;
    fields[index] = fields[target]!;
    fields[target] = moved;
    structure.fields = fields;
    return structure;
  });
}

export function setExperienceFieldLabel(
  draft: MatrixDraft,
  fieldId: string,
  label: string,
): MatrixDraft {
  return withFields(draft, (structure) => {
    structure.fields = structure.fields.map((field) =>
      field.id === fieldId ? { ...field, label } : field,
    );
    return structure;
  });
}

export function setJourneyWeekly(draft: MatrixDraft, journeyId: string, weekly: string) {
  return withFields(draft, (structure) => {
    structure.journeys = structure.journeys.map((journey) =>
      journey.id === journeyId ? { ...journey, weekly } : journey,
    );
    return structure;
  });
}

/* ------------------------ estrutura: ampliação curricular ------------------- */

export function setExtendedAxisLabel(
  draft: MatrixDraft,
  axisId: string,
  label: string,
): MatrixDraft {
  if (draft.structure.kind !== "extended-time") return draft;
  const structure = deepCopy(draft.structure) as ExtendedTimeStructure;
  structure.axes = structure.axes.map((axis) => (axis.id === axisId ? { ...axis, label } : axis));
  return { ...draft, structure };
}

/* -------------------------------- validações -------------------------------- */

export type DraftIssue = {
  id: string;
  severity: "erro" | "aviso";
  message: string;
  /** Campo do formulário ao qual a mensagem se associa, quando aplicável. */
  field?: string;
};

/**
 * Validações de EXPERIÊNCIA. Não decidem qual carga é legal nem aplicam regra
 * acadêmica oficial: apenas apontam ausências e divergências para revisão.
 */
export function validateDraft(draft: MatrixDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (!draft.name.trim()) {
    issues.push({
      id: "name",
      severity: "erro",
      field: "name",
      message: "Informe o nome da matriz curricular.",
    });
  }
  if (!draft.code.trim()) {
    issues.push({
      id: "code",
      severity: "erro",
      field: "code",
      message: "Informe o código demonstrativo da matriz.",
    });
  }
  if (!draft.segment) {
    issues.push({
      id: "segment",
      severity: "erro",
      field: "segment",
      message: "Selecione o segmento/organização de aplicabilidade.",
    });
  }
  if (!draft.effectiveFrom) {
    issues.push({
      id: "effectiveFrom",
      severity: "erro",
      field: "effectiveFrom",
      message: "Informe o início da vigência demonstrativa.",
    });
  }
  if (draft.effectiveFrom && draft.effectiveUntil && draft.effectiveUntil <= draft.effectiveFrom) {
    issues.push({
      id: "effectiveRange",
      severity: "erro",
      field: "effectiveUntil",
      message: "Vigência inválida: o término deve ser posterior ao início.",
    });
  }
  if (
    draft.origin &&
    draft.effectiveFrom &&
    draft.origin.effectiveUntil === null &&
    draft.effectiveFrom <= "1900-01-01"
  ) {
    // Guarda defensiva; nenhuma regra normativa é inferida aqui.
  }
  if (!draft.normativeReference.trim()) {
    issues.push({
      id: "normativeReference",
      severity: "aviso",
      field: "normativeReference",
      message: "Referência documental ausente: registre o documento de referência demonstrativo.",
    });
  }

  const structure = draft.structure;
  if (structure.kind === "grid") {
    const rows = gridRows(structure);
    if (rows.length === 0) {
      issues.push({
        id: "structure-empty",
        severity: "erro",
        field: "structure",
        message: "Estrutura sem elementos curriculares: adicione ao menos um elemento.",
      });
    }
    rows.forEach((row) => {
      if (!row.label.trim()) {
        issues.push({
          id: `row-label-${row.id}`,
          severity: "erro",
          field: `row-label-${row.id}`,
          message: "Elemento curricular sem denominação.",
        });
      }
      const missing = row.values.some((value) => value === null);
      if (missing) {
        issues.push({
          id: `row-load-${row.id}`,
          severity: "aviso",
          message: `Carga ausente em “${row.label || "elemento sem denominação"}”: há colunas sem valor informado.`,
        });
      }
    });
    const computed = computeGridTotals(structure);
    structure.columns.forEach((column, index) => {
      const reference = structure.totals?.[index] ?? null;
      const value = computed[index] ?? null;
      if (reference !== null && value !== null && reference !== value) {
        issues.push({
          id: `total-${column.id}`,
          severity: "aviso",
          message: `Total inconsistente em ${column.label}: calculado ${value} × referência documentada ${reference}.`,
        });
      }
    });
  }

  if (structure.kind === "experience-fields") {
    if (structure.fields.length === 0) {
      issues.push({
        id: "structure-empty",
        severity: "erro",
        field: "structure",
        message: "Estrutura sem campos de experiências: adicione ao menos um campo.",
      });
    }
    structure.fields.forEach((field) => {
      if (!field.label.trim()) {
        issues.push({
          id: `field-label-${field.id}`,
          severity: "erro",
          field: `field-label-${field.id}`,
          message: "Campo de experiências sem denominação.",
        });
      }
    });
    structure.journeys.forEach((journey) => {
      if (!journey.weekly.trim()) {
        issues.push({
          id: `journey-${journey.id}`,
          severity: "aviso",
          message: `Carga ausente na ${journey.label.toLowerCase()}.`,
        });
      }
    });
  }

  if (structure.kind === "extended-time" && structure.axes.length === 0) {
    issues.push({
      id: "structure-empty",
      severity: "erro",
      field: "structure",
      message: "Estrutura sem eixos de ampliação curricular.",
    });
  }

  return issues;
}

export function issueFor(issues: DraftIssue[], field: string) {
  return issues.find((issue) => issue.field === field);
}

/* --------------------------- comparação entre versões ----------------------- */

export type DraftChange = {
  id: string;
  kind: "added" | "removed" | "load" | "organization";
  label: string;
  detail: string;
};

const CHANGE_LABELS: Record<DraftChange["kind"], string> = {
  added: "Adicionado",
  removed: "Removido",
  load: "Carga alterada",
  organization: "Organização alterada",
};

export function changeKindLabel(kind: DraftChange["kind"]) {
  return CHANGE_LABELS[kind];
}

/** Comparação Versão anterior ↔ Nova versão. Não altera nenhuma das duas. */
export function diffStructures(
  previous: CurriculumStructure,
  next: CurriculumStructure,
): DraftChange[] {
  const changes: DraftChange[] = [];

  if (previous.kind !== next.kind) {
    changes.push({
      id: "kind",
      kind: "organization",
      label: "Natureza da estrutura",
      detail: `De ${previous.kind} para ${next.kind}.`,
    });
    return changes;
  }

  if (previous.kind === "grid" && next.kind === "grid") {
    const previousColumns = previous.columns.map((column) => column.label).join(", ");
    const nextColumns = next.columns.map((column) => column.label).join(", ");
    if (previousColumns !== nextColumns) {
      changes.push({
        id: "columns",
        kind: "organization",
        label: "Organização acadêmica",
        detail: `De “${previousColumns}” para “${nextColumns}”.`,
      });
    }
    const previousRows = gridRows(previous);
    const nextRows = gridRows(next);
    const byLabel = (rows: typeof previousRows) =>
      new Map(rows.map((row) => [row.label.trim().toLowerCase(), row]));
    const previousMap = byLabel(previousRows);
    const nextMap = byLabel(nextRows);

    nextRows.forEach((row) => {
      const key = row.label.trim().toLowerCase();
      const before = previousMap.get(key);
      if (!before) {
        changes.push({
          id: `added-${row.id}`,
          kind: "added",
          label: row.label || "Elemento sem denominação",
          detail: "Elemento curricular presente apenas na nova versão.",
        });
        return;
      }
      const alterations: string[] = [];
      next.columns.forEach((column, index) => {
        const beforeValue = before.values[index] ?? null;
        const afterValue = row.values[index] ?? null;
        if (beforeValue !== afterValue) {
          alterations.push(`${column.label}: ${beforeValue ?? "—"} → ${afterValue ?? "—"}`);
        }
      });
      if (alterations.length) {
        changes.push({
          id: `load-${row.id}`,
          kind: "load",
          label: row.label,
          detail: alterations.join(" · "),
        });
      }
    });

    previousRows.forEach((row) => {
      if (!nextMap.has(row.label.trim().toLowerCase())) {
        changes.push({
          id: `removed-${row.id}`,
          kind: "removed",
          label: row.label || "Elemento sem denominação",
          detail: "Elemento curricular existente apenas na versão anterior.",
        });
      }
    });
  }

  if (previous.kind === "experience-fields" && next.kind === "experience-fields") {
    const previousLabels = previous.fields.map((field) => field.label.trim().toLowerCase());
    const nextLabels = next.fields.map((field) => field.label.trim().toLowerCase());
    next.fields.forEach((field) => {
      if (!previousLabels.includes(field.label.trim().toLowerCase())) {
        changes.push({
          id: `added-${field.id}`,
          kind: "added",
          label: field.label || "Campo sem denominação",
          detail: "Campo de experiências presente apenas na nova versão.",
        });
      }
    });
    previous.fields.forEach((field) => {
      if (!nextLabels.includes(field.label.trim().toLowerCase())) {
        changes.push({
          id: `removed-${field.id}`,
          kind: "removed",
          label: field.label || "Campo sem denominação",
          detail: "Campo de experiências existente apenas na versão anterior.",
        });
      }
    });
    next.journeys.forEach((journey) => {
      const before = previous.journeys.find((item) => item.id === journey.id);
      if (!before) {
        changes.push({
          id: `journey-added-${journey.id}`,
          kind: "added",
          label: journey.label,
          detail: `Jornada presente apenas na nova versão (${journey.weekly}).`,
        });
        return;
      }
      if (before.weekly !== journey.weekly) {
        changes.push({
          id: `journey-${journey.id}`,
          kind: "load",
          label: journey.label,
          detail: `${before.weekly} → ${journey.weekly}`,
        });
      }
    });
    previous.journeys.forEach((journey) => {
      if (!next.journeys.some((item) => item.id === journey.id)) {
        changes.push({
          id: `journey-removed-${journey.id}`,
          kind: "removed",
          label: journey.label,
          detail: "Jornada existente apenas na versão anterior.",
        });
      }
    });
  }

  if (previous.kind === "extended-time" && next.kind === "extended-time") {
    next.axes.forEach((axis) => {
      const before = previous.axes.find((item) => item.id === axis.id);
      if (!before) {
        changes.push({
          id: `axis-added-${axis.id}`,
          kind: "added",
          label: axis.label,
          detail: "Eixo presente apenas na nova versão.",
        });
        return;
      }
      if (before.label !== axis.label) {
        changes.push({
          id: `axis-${axis.id}`,
          kind: "organization",
          label: axis.label,
          detail: `De “${before.label}” para “${axis.label}”.`,
        });
      }
    });
    previous.axes.forEach((axis) => {
      if (!next.axes.some((item) => item.id === axis.id)) {
        changes.push({
          id: `axis-removed-${axis.id}`,
          kind: "removed",
          label: axis.label,
          detail: "Eixo existente apenas na versão anterior.",
        });
      }
    });
  }

  return changes;
}

export function isDraftDirty(draft: MatrixDraft, initial: MatrixDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}
