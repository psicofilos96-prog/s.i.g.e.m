/**
 * B4.1.3 — Modelo puro do editor institucional de versões da matriz.
 *
 * O editor só COMPÕE argumentos para o writer canônico de 11 argumentos
 * (`record_curricular_matrix_version`, B4.1.2); toda validação daqui é ajuda de
 * preenchimento — o banco revalida tudo. Nenhuma norma entra aqui: não há
 * etapa, modalidade, carga presumida, vínculo turma→matriz nem significado de
 * símbolo. Texto de célula é evidência literal; célula vazia = nada transcrito.
 */
import type {
  InstitutionalMatrix, InstitutionalMatrixApplicability, InstitutionalMatrixItem, MatrixLayout,
} from "@/features/curriculum/curricular-matrix-source";

export const KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const NUMERIC_LITERAL = /^[0-9]+([.,][0-9]+)?$/;

export type CatalogRef = { scheme: string; value: string; version: number };
export type DraftItemRef = { kind: "componente"; componentId: string; label: string } | { kind: "elemento"; ref: CatalogRef; label: string };
export type DraftColumn = { key: string; parent: string | null; header: string; ref: CatalogRef | null };
export type DraftGroup = { key: string; parent: string | null; label: string };
export type DraftRow = { key: string; group: string | null; role: "item" | "total" | "rotulo"; label: string; item: DraftItemRef | null };
export type DraftCell = { text: string; unit: CatalogRef | null };
export type DraftNote = { key: string; marker: string; text: string };

export type MatrixDraft = {
  mode: "constituicao" | "sucessao" | "retificacao";
  matrixId: string | null;
  baseVersionId: string | null;
  officialName: string; validFrom: string; validUntil: string; reason: string; actRef: string;
  source: { locator: string; page: string; sha256: string };
  columns: DraftColumn[]; groups: DraftGroup[]; rows: DraftRow[];
  /** chave `${row}|${column}`; ausente = nada transcrito. */
  cells: Record<string, DraftCell>;
  notes: DraftNote[];
  applicability: InstitutionalMatrixApplicability[];
};

export const cellKey = (row: string, column: string) => `${row}|${column}`;
export const splitCellKey = (k: string): [string, string] => {
  const i = k.indexOf("|");
  return [k.slice(0, i), k.slice(i + 1)];
};

export function emptyDraft(): MatrixDraft {
  return {
    mode: "constituicao", matrixId: null, baseVersionId: null,
    officialName: "", validFrom: "", validUntil: "", reason: "", actRef: "",
    source: { locator: "", page: "", sha256: "" },
    columns: [], groups: [], rows: [], cells: {}, notes: [], applicability: [],
  };
}

/**
 * Carrega uma versão existente como PONTO DE PARTIDA de uma nova versão.
 * Nada do passado é editado: o resultado vira sucessão ou retificação com base
 * esperada = última versão registrada (o writer recusa base desatualizada).
 */
export function draftFromVersion(args: {
  matrix: InstitutionalMatrix; latestVersionId: string; items: InstitutionalMatrixItem[];
  applicability: InstitutionalMatrixApplicability[]; layout: MatrixLayout | null;
  mode: "sucessao" | "retificacao";
}): MatrixDraft {
  const { matrix, items, layout } = args;
  const d = emptyDraft();
  d.mode = args.mode; d.matrixId = matrix.matrixId; d.baseVersionId = args.latestVersionId;
  d.officialName = matrix.officialName; d.validFrom = matrix.validFrom; d.validUntil = matrix.validUntil ?? "";
  d.actRef = ""; d.applicability = [...args.applicability];
  const itemRef = (key: string | null): DraftItemRef | null => {
    const it = items.find((i) => i.itemKey === key);
    if (!it) return null;
    return it.reference.kind === "componente"
      ? { kind: "componente", componentId: it.reference.componentId, label: it.reference.labelSnapshot }
      : { kind: "elemento", ref: { scheme: it.reference.schemeId, value: it.reference.valueId, version: it.reference.valueVersion }, label: it.reference.valueId };
  };
  if (layout) {
    d.source = { locator: layout.source.locator, page: layout.source.page ?? "", sha256: layout.source.sha256 ?? "" };
    d.columns = layout.columns.map((c) => ({ key: c.key, parent: c.parent, header: c.header, ref: null }));
    d.groups = layout.groups.map((g) => ({ ...g }));
    d.rows = layout.rows.map((r) => ({ key: r.key, group: r.group, role: r.role, label: r.label ?? "", item: r.role === "item" ? itemRef(r.item) : null }));
    for (const c of layout.cells) d.cells[cellKey(c.row, c.column)] = { text: c.text, unit: null };
    d.notes = layout.notes.map((n) => ({ key: n.key, marker: n.marker ?? "", text: n.text }));
  } else {
    // Versão sem quadro: cada item vira linha de item; nenhuma carga é transportada como célula
    // (seria inferir onde ela estava no documento).
    d.rows = items.map((it) => ({ key: it.itemKey, group: null, role: "item", label: "", item: itemRef(it.itemKey) }));
  }
  return d;
}

/** Colunas-folha na ordem de pré-ordem da árvore (qualquer profundidade). */
export function orderedLeaves(columns: DraftColumn[] | { key: string; parent: string | null }[]) {
  const out: { key: string; parent: string | null }[] = [];
  const walk = (parent: string | null) => {
    for (const c of columns.filter((x) => x.parent === parent)) {
      const kids = columns.filter((x) => x.parent === c.key);
      if (kids.length === 0) out.push(c); else walk(c.key);
    }
  };
  walk(null);
  return out;
}

export type HeaderCell = { key: string; header: string; colSpan: number; rowSpan: number };

/**
 * Linhas de cabeçalho para colunas aninhadas de QUALQUER profundidade.
 * Folha rasa ocupa as linhas restantes (rowSpan), para alinhar com folhas profundas.
 */
export function headerRows<C extends { key: string; parent: string | null; header: string }>(columns: C[]): HeaderCell[][] {
  const depthOf = (key: string): number => {
    const kids = columns.filter((c) => c.parent === key);
    return kids.length === 0 ? 1 : 1 + Math.max(...kids.map((k) => depthOf(k.key)));
  };
  const span = (key: string): number => {
    const kids = columns.filter((c) => c.parent === key);
    return kids.length === 0 ? 1 : kids.reduce((n, k) => n + span(k.key), 0);
  };
  const roots = columns.filter((c) => c.parent === null || !columns.some((p) => p.key === c.parent));
  const total = roots.length === 0 ? 0 : Math.max(...roots.map((r) => depthOf(r.key)));
  const rows: HeaderCell[][] = Array.from({ length: total }, () => []);
  const visit = (c: C, level: number) => {
    const kids = columns.filter((x) => x.parent === c.key);
    rows[level]!.push({ key: c.key, header: c.header, colSpan: span(c.key), rowSpan: kids.length === 0 ? total - level : 1 });
    for (const k of kids) visit(k, level + 1);
  };
  for (const r of roots) visit(r, 0);
  return rows;
}

export function isNumericLiteral(text: string) {
  return NUMERIC_LITERAL.test(text.trim());
}

/** Detecta ciclo pai→filho (colunas ou grupos). */
function hasCycle(nodes: { key: string; parent: string | null }[]) {
  const byKey = new Map(nodes.map((n) => [n.key, n.parent]));
  for (const n of nodes) {
    const seen = new Set<string>();
    let cur: string | null = n.key;
    while (cur) {
      if (seen.has(cur)) return true;
      seen.add(cur);
      cur = byKey.get(cur) ?? null;
    }
  }
  return false;
}

export type DraftIssue = { field: string; message: string };

export function validateDraft(d: MatrixDraft): DraftIssue[] {
  const e: DraftIssue[] = [];
  const add = (field: string, message: string) => e.push({ field, message });
  if (!d.officialName.trim()) add("officialName", "Informe o nome oficial da matriz.");
  if (!d.validFrom) add("validFrom", "Informe o início da vigência.");
  if (d.validUntil && d.validFrom && d.validUntil < d.validFrom) add("validUntil", "O término não pode ser anterior ao início.");
  if (!d.actRef.trim()) add("actRef", "Informe o ato (deliberação) que origina esta versão.");
  if (d.mode !== "constituicao") {
    if (!d.matrixId || !d.baseVersionId) add("base", "Nova versão exige a matriz e a versão-base esperada.");
    if (!d.reason.trim()) add("reason", "Informe o motivo da nova versão.");
  }
  if (!d.source.locator.trim()) add("source.locator", "Informe o anexo/trecho do ato de onde o quadro foi transcrito.");
  if (d.source.sha256.trim() && !/^[0-9a-fA-F]{64}$/.test(d.source.sha256.trim()))
    add("source.sha256", "O identificador do documento deve ter 64 caracteres hexadecimais (sha256).");

  const keyCheck = (kind: string, list: { key: string }[]) => {
    const seen = new Set<string>();
    for (const x of list) {
      if (!KEY_PATTERN.test(x.key)) add(`${kind}.${x.key}`, `Chave "${x.key}" inválida: use letras minúsculas, números e hífen.`);
      if (seen.has(x.key)) add(`${kind}.${x.key}`, `Chave "${x.key}" repetida.`);
      seen.add(x.key);
    }
  };
  keyCheck("column", d.columns); keyCheck("group", d.groups); keyCheck("row", d.rows); keyCheck("note", d.notes);

  for (const c of d.columns) {
    if (!c.header.trim()) add(`column.${c.key}`, `A coluna "${c.key}" precisa de cabeçalho.`);
    if (c.parent && !d.columns.some((p) => p.key === c.parent)) add(`column.${c.key}`, `A coluna "${c.key}" aponta para coluna-mãe inexistente.`);
  }
  if (hasCycle(d.columns)) add("columns", "As colunas formam um ciclo de subordinação.");
  for (const g of d.groups) {
    if (!g.label.trim()) add(`group.${g.key}`, `O grupo "${g.key}" precisa de rótulo.`);
    if (g.parent && !d.groups.some((p) => p.key === g.parent)) add(`group.${g.key}`, `O grupo "${g.key}" aponta para grupo-pai inexistente.`);
  }
  if (hasCycle(d.groups)) add("groups", "Os grupos formam um ciclo de subordinação.");

  const itemComponents = new Set<string>();
  for (const r of d.rows) {
    if (r.group && !d.groups.some((g) => g.key === r.group)) add(`row.${r.key}`, `A linha "${r.key}" aponta para grupo inexistente.`);
    if (r.role === "item") {
      if (!r.item) add(`row.${r.key}`, `A linha "${r.key}" é de item e precisa de componente ou elemento.`);
      else if (r.item.kind === "componente") {
        if (itemComponents.has(r.item.componentId)) add(`row.${r.key}`, `O componente ${r.item.componentId} aparece em mais de uma linha.`);
        itemComponents.add(r.item.componentId);
      }
    } else if (!r.label.trim()) add(`row.${r.key}`, `A linha "${r.key}" precisa de rótulo transcrito.`);
  }

  const leaves = new Set(orderedLeaves(d.columns).map((c) => c.key));
  for (const [k, cell] of Object.entries(d.cells)) {
    const [row, col] = splitCellKey(k);
    if (!cell.text.trim()) continue; // vazio = ausência; não é enviado
    if (!d.rows.some((r) => r.key === row) || !leaves.has(col)) add(`cell.${k}`, "Há texto em célula de linha/coluna que não existe mais.");
    if (cell.unit && !isNumericLiteral(cell.text)) add(`cell.${k}`, `Unidade só pode acompanhar número transcrito (célula "${cell.text}").`);
  }
  for (const n of d.notes) if (!n.text.trim()) add(`note.${n.key}`, `A nota "${n.key}" precisa de texto.`);
  return e;
}

export type WriterArgs = {
  _matrix: string | null; _base_version_id: string | null; _change_kind: MatrixDraft["mode"];
  _official_name: string; _valid_from: string; _valid_until: string | null; _reason: string | null; _act_ref: string;
  _items: unknown[]; _applicability: unknown[]; _layout: Record<string, unknown>;
};

/** Monta os 11 argumentos do writer. Itens nunca carregam quantidade (carga vive nas células). */
export function toWriterArgs(d: MatrixDraft): WriterArgs {
  const items = d.rows.filter((r) => r.role === "item" && r.item).map((r) => {
    const it = r.item!;
    return it.kind === "componente"
      ? { key: r.key, component: it.componentId }
      : { key: r.key, element: { scheme: it.ref.scheme, value: it.ref.value, version: it.ref.version } };
  });
  const leaves = new Set(orderedLeaves(d.columns).map((c) => c.key));
  const rowKeys = new Set(d.rows.map((r) => r.key));
  const cells = Object.entries(d.cells)
    .filter(([k, c]) => c.text.trim() !== "" && rowKeys.has(splitCellKey(k)[0]) && leaves.has(splitCellKey(k)[1]))
    .map(([k, c]) => {
      const [row, column] = splitCellKey(k);
      return c.unit ? { row, column, text: c.text, unit: c.unit } : { row, column, text: c.text };
    });
  const applicability = d.applicability.map((a) =>
    a.dimension === "ano-letivo" ? { dimension: a.dimension, id: a.academicYearId }
      : a.dimension === "escola" ? { dimension: a.dimension, id: a.schoolId }
      : { dimension: a.dimension, scheme: a.schemeId, value: a.valueId, version: a.valueVersion });
  const source: Record<string, string> = { locator: d.source.locator.trim() };
  if (d.source.page.trim()) source["page"] = d.source.page.trim();
  if (d.source.sha256.trim()) source["sha256"] = d.source.sha256.trim().toLowerCase();
  return {
    _matrix: d.mode === "constituicao" ? null : d.matrixId,
    _base_version_id: d.mode === "constituicao" ? null : d.baseVersionId,
    _change_kind: d.mode,
    _official_name: d.officialName.trim(), _valid_from: d.validFrom, _valid_until: d.validUntil || null,
    _reason: d.reason.trim() || null, _act_ref: d.actRef.trim(),
    _items: items, _applicability: applicability,
    _layout: {
      source,
      columns: d.columns.map((c) => ({ key: c.key, header: c.header, ...(c.parent ? { parent: c.parent } : {}), ...(c.ref ? { ref: c.ref } : {}) })),
      groups: d.groups.map((g) => ({ key: g.key, label: g.label, ...(g.parent ? { parent: g.parent } : {}) })),
      rows: d.rows.map((r) => ({
        key: r.key, role: r.role, ...(r.group ? { group: r.group } : {}),
        ...(r.role === "item" ? { item: r.key } : { label: r.label }),
      })),
      cells,
      notes: d.notes.map((n) => ({ key: n.key, text: n.text, ...(n.marker.trim() ? { marker: n.marker.trim() } : {}) })),
    },
  };
}

/** Próxima chave técnica livre com prefixo dado (o usuário pode renomear). */
export function nextKey(prefix: string, taken: { key: string }[]) {
  let i = taken.length + 1;
  while (taken.some((t) => t.key === `${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}
