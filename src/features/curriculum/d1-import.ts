/**
 * D1 — importador governado: fonte → proposta → validação → confirmação humana → writers canônicos.
 *
 * - Motor genérico: percorre o contrato (JSON) e a transcrição (JSON). Não conhece etapa,
 *   modalidade, jornada, natureza, posição ou componente; tudo vem dos dados.
 * - Literais da fonte (X, --, *, 1*, números) são transcritos como texto; nenhuma semântica
 *   é atribuída. Somas só são conferidas quando TODAS as células somadas são inteiros puros.
 * - Escrita apenas por `record_attribute_value_version` e `record_curricular_matrix_version`
 *   (11 args). Nenhum INSERT de tabela. Cada chamada é atômica; a execução para na primeira
 *   falha e a reexecução é idempotente (passos já gravados viram "identico").
 * - A data informada é configuração interna do SIGEM, nunca data de publicação da norma.
 */
import sourceJson from "../../../docs/data/deliberacao-cme-3-2026-matrizes-source.json";
import contractJson from "../../../docs/data/d1-contrato-canonico-cme-3-2026.json";

export type SourceRow = { source_label: string; source_texts: string[] };
export type SourceAnnex = { annex: string; title: string; page: number; positions: { key: string; label: string }[]; rows: SourceRow[]; notes: string[] };
export type MatrixSource = {
  schema: string; status: string;
  source: { act_ref: string; act_date: string | null; publication_date: string | null; valid_from: string | null; document_sha256: string };
  annexes: SourceAnnex[];
};
export type ContractPosition = { id: string; label: string; annex: string; source_column_key: string; source_label: string };
export type ContractElement = { id: string; label: string; kind: string; source_labels: string[] };
export type ContractSummaryRow = { key: string; source_label: string; sum_of_items?: boolean };
export type D1Contract = {
  schema: string; source_sha256: string; position_scheme: string; element_scheme: string;
  literal_patterns: string[]; positions: ContractPosition[]; elements: ContractElement[]; summary_rows: ContractSummaryRow[];
};

export const CME_SOURCE = sourceJson as MatrixSource;
export const D1_CONTRACT = contractJson as D1Contract;

const ID = /^[a-z0-9][a-z0-9-]*$/;
const INT = /^[0-9]+$/;

export type Issue = { level: "erro" | "aviso"; code: string; message: string };

/** Validação estrutural fonte × contrato. Erros bloqueiam; avisos exigem ciência explícita. */
export function validateSource(src: MatrixSource, c: D1Contract): Issue[] {
  const out: Issue[] = [];
  const err = (code: string, message: string) => out.push({ level: "erro", code, message });
  const warn = (code: string, message: string) => out.push({ level: "aviso", code, message });
  if (!/^[0-9a-f]{64}$/.test(src.source.document_sha256)) err("source-sha256-invalido", "A fonte não declara SHA-256 válido.");
  if (src.source.document_sha256 !== c.source_sha256) err("source-sha256-divergente", "O SHA-256 da fonte difere do contrato: a transcrição não corresponde ao documento conferido.");
  const patterns = c.literal_patterns.map((p) => new RegExp(p));
  const ids = new Set<string>();
  for (const p of c.positions) {
    if (!ID.test(p.id)) err("id-invalido", `ID de posição inválido: ${p.id}`);
    if (ids.has(p.id)) err("id-duplicado", `ID de posição duplicado: ${p.id}`);
    ids.add(p.id);
  }
  for (const e of c.elements) {
    if (!ID.test(e.id)) err("id-invalido", `ID de elemento inválido: ${e.id}`);
    if (ids.has(e.id)) err("id-duplicado", `ID duplicado: ${e.id}`);
    ids.add(e.id);
  }
  const used = new Set<string>();
  for (const a of src.annexes) {
    const width = a.positions.length;
    for (const p of a.positions) {
      const cp = c.positions.find((x) => x.source_column_key === p.key);
      if (!cp) { err("posicao-desconhecida", `Anexo ${a.annex}: coluna "${p.key}" sem posição no contrato.`); continue; }
      if (cp.annex !== a.annex) err("posicao-anexo-divergente", `Coluna "${p.key}" está no Anexo ${a.annex}, contrato diz ${cp.annex}.`);
      if (cp.source_label !== p.label) err("rotulo-fonte-divergente", `Coluna "${p.key}": fonte "${p.label}", contrato "${cp.source_label}".`);
      if (used.has(cp.id)) err("posicao-repetida", `Posição ${cp.id} aparece em mais de uma coluna.`);
      used.add(cp.id);
    }
    const itemSums: (number | null)[] = Array(width).fill(0);
    for (const r of a.rows) {
      if (r.source_texts.length !== width) err("largura-divergente", `Anexo ${a.annex}, linha "${r.source_label}": ${r.source_texts.length} células para ${width} colunas.`);
      for (const t of r.source_texts) if (!patterns.some((p) => p.test(t))) err("literal-desconhecido", `Anexo ${a.annex}, linha "${r.source_label}": literal "${t}" fora do contrato.`);
      const el = c.elements.find((e) => e.source_labels.includes(r.source_label));
      const sr = c.summary_rows.find((s) => s.source_label === r.source_label);
      if (!el && !sr) { err("linha-desconhecida", `Anexo ${a.annex}: linha "${r.source_label}" não é elemento nem linha de resumo do contrato.`); continue; }
      if (el) r.source_texts.forEach((t, i) => { const cur = itemSums[i]; itemSums[i] = cur !== null && cur !== undefined && INT.test(t) ? cur + Number(t) : null; });
    }
    for (const r of a.rows) {
      const sr = c.summary_rows.find((s) => s.source_label === r.source_label);
      if (!sr?.sum_of_items) continue;
      r.source_texts.forEach((t, i) => {
        const s = itemSums[i];
        if (s === null || s === undefined || !INT.test(t)) return; // não verificável sem contrato para os literais
        if (s !== Number(t)) warn("soma-divergente", `Anexo ${a.annex}, coluna ${a.positions[i]?.label}: itens somam ${s}, fonte declara ${t}.`);
      });
    }
    // "Total geral transcrito: N" nas notas × soma da linha de resumo sem sum_of_items marcada como total
    for (const n of a.notes) {
      const m = /Total geral transcrito:\s*([0-9.]+)/.exec(n);
      if (!m?.[1]) continue;
      const declared = Number(m[1].replace(/\./g, ""));
      for (const r of a.rows) {
        const sr = c.summary_rows.find((s) => s.source_label === r.source_label);
        if (!sr || sr.sum_of_items || !r.source_texts.every((t) => INT.test(t))) continue;
        const sum = r.source_texts.reduce((acc, t) => acc + Number(t), 0);
        if (sum !== declared) warn("total-geral-divergente", `Anexo ${a.annex}: linha "${r.source_label}" soma ${sum}, nota declara ${declared}. Conferir no PDF; o importador transcreve sem corrigir.`);
      }
    }
  }
  for (const p of c.positions) if (!used.has(p.id)) err("posicao-ausente", `Posição ${p.id} não aparece na fonte.`);
  return out;
}

// ---------------------------------------------------------------- estado atual e plano
export type CatalogState = { scheme: string; value: string; version: number; label: string; status: string; validFrom: string | null };
export type MatrixState = { matrixId: string; versionId: string; locator: string; sha256: string | null; layoutSignature: string };
export type CurrentState = { catalog: CatalogState[]; matrices: MatrixState[] };

export type ImportInput = { configuredValidFrom: string; documentRef: string | null; acknowledgeWarnings: boolean; confirmed: boolean };

export type CatalogStep = { kind: "catalogo"; scheme: string; value: string; label: string; status: "novo" | "identico" | "divergente" | "vigencia-incompativel"; detail: string | null };
export type MatrixStep = { kind: "matriz"; annex: string; officialName: string; locator: string; args: Record<string, unknown>; signature: string; status: "novo" | "identico" | "divergente" | "fonte-diferente"; detail: string | null };
export type PlanStep = CatalogStep | MatrixStep;
export type ImportPlan = { steps: PlanStep[]; issues: Issue[]; blocked: boolean };

export const annexLocator = (src: MatrixSource, a: SourceAnnex) => `${src.source.act_ref} — Anexo ${a.annex}`;

export function citation(src: MatrixSource, a: SourceAnnex | null, documentRef: string | null): string {
  const where = a ? `, Anexo ${a.annex}, p. ${a.page}` : "";
  const extra = documentRef?.trim() ? ` | referência documental: ${documentRef.trim()}` : "";
  return `${src.source.act_ref}${where} (fonte sha256:${src.source.document_sha256}; vigência configurada no SIGEM por decisão interna; publicação não comprovada)${extra}`;
}

/** Assinatura canônica do quadro: colunas, linhas, células e notas (ordem preservada). */
export function layoutSignature(layout: { columns: { key: string; header: string; ref?: unknown }[]; rows: { key: string; role: string; label?: string | null }[]; cells: { row: string; column: string; text: string }[]; notes: { text: string }[] }): string {
  return JSON.stringify([
    layout.columns.map((c) => [c.key, c.header, c.ref ?? null]),
    layout.rows.map((r) => [r.key, r.role, r.role === "item" ? null : (r.label ?? null)]),
    [...layout.cells].map((c) => [c.row, c.column, c.text]).sort((x, y) => (x.join("|") < y.join("|") ? -1 : 1)),
    layout.notes.map((n) => n.text),
  ]);
}

function matrixArgs(src: MatrixSource, c: D1Contract, a: SourceAnnex, input: ImportInput) {
  const col = (k: string) => c.positions.find((p) => p.source_column_key === k)!;
  const columns = a.positions.map((p) => ({ key: col(p.key).id, header: p.label, ref: { scheme: c.position_scheme, value: col(p.key).id, version: 1 } }));
  const rows: { key: string; role: "item" | "total"; item?: string; label?: string }[] = [];
  const items: { key: string; element: { scheme: string; value: string; version: number } }[] = [];
  const cells: { row: string; column: string; text: string }[] = [];
  for (const r of a.rows) {
    const el = c.elements.find((e) => e.source_labels.includes(r.source_label));
    const sr = c.summary_rows.find((s) => s.source_label === r.source_label)!;
    const key = el ? el.id : sr.key;
    if (el) { rows.push({ key, role: "item", item: key }); items.push({ key, element: { scheme: c.element_scheme, value: el.id, version: 1 } }); }
    else rows.push({ key, role: "total", label: r.source_label });
    r.source_texts.forEach((t, i) => cells.push({ row: key, column: columns[i]!.key, text: t }));
  }
  const notes = a.notes.map((text, i) => ({ key: `nota-${i + 1}`, text }));
  const layout = {
    source: { locator: annexLocator(src, a), page: String(a.page), sha256: src.source.document_sha256 },
    columns, groups: [], rows, cells, notes,
  };
  const args = {
    _matrix: null, _base_version_id: null, _change_kind: "constituicao", _official_name: a.title,
    _valid_from: input.configuredValidFrom, _valid_until: null, _reason: null,
    _act_ref: citation(src, a, input.documentRef), _items: items, _applicability: [], _layout: layout,
  };
  const signature = layoutSignature({ columns, rows: rows.map((r) => ({ key: r.key, role: r.role, label: r.label ?? null })), cells, notes });
  return { args, signature };
}

export function inputProblem(i: ImportInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.configuredValidFrom)) return "Informe a data de início configurada no SIGEM.";
  return null;
}

export function buildPlan(src: MatrixSource, c: D1Contract, state: CurrentState, input: ImportInput): ImportPlan {
  const issues = validateSource(src, c);
  const steps: PlanStep[] = [];
  const cat = (scheme: string, value: string, label: string) => {
    const versions = state.catalog.filter((v) => v.scheme === scheme && v.value === value).sort((x, y) => y.version - x.version);
    const cur = versions[0];
    let status: CatalogStep["status"] = "novo"; let detail: string | null = null;
    if (cur) {
      if (cur.status !== "homologada" || cur.label !== label || cur.version !== 1) { status = "divergente"; detail = `Já existe v${cur.version} "${cur.label}" (${cur.status}).`; }
      else if (cur.validFrom && input.configuredValidFrom && cur.validFrom > input.configuredValidFrom) { status = "vigencia-incompativel"; detail = `Valor vigente só desde ${cur.validFrom}.`; }
      else status = "identico";
    }
    steps.push({ kind: "catalogo", scheme, value, label, status, detail });
  };
  for (const p of c.positions) cat(c.position_scheme, p.id, p.label);
  for (const e of c.elements) cat(c.element_scheme, e.id, e.label);
  if (!issues.some((i) => i.level === "erro")) {
    for (const a of src.annexes) {
      const { args, signature } = matrixArgs(src, c, a, input);
      const locator = annexLocator(src, a);
      const same = state.matrices.filter((m) => m.locator === locator);
      let status: MatrixStep["status"] = "novo"; let detail: string | null = null;
      if (same.length > 1) { status = "divergente"; detail = "Mais de uma matriz com o mesmo trecho-fonte; resolva pelo editor."; }
      else if (same[0]) {
        if (same[0].sha256 !== src.source.document_sha256) { status = "fonte-diferente"; detail = "Matriz existente veio de documento com outro SHA-256; use sucessão/retificação pelo editor."; }
        else if (same[0].layoutSignature !== signature) { status = "divergente"; detail = "Quadro existente difere da transcrição; use retificação pelo editor."; }
        else status = "identico";
      }
      steps.push({ kind: "matriz", annex: a.annex, officialName: a.title, locator, args, signature, status, detail });
    }
  }
  const blockingStep = steps.some((s) => s.status !== "novo" && s.status !== "identico");
  return { steps, issues, blocked: issues.some((i) => i.level === "erro") || blockingStep };
}

// ---------------------------------------------------------------- execução
export type Rpc = (fn: "record_attribute_value_version" | "record_curricular_matrix_version", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
export type ExecOutcome = { done: { step: PlanStep; result: unknown }[]; skipped: PlanStep[]; failed: { step: PlanStep; message: string } | null; notStarted: PlanStep[] };
export type ImportCapabilities = { catalog: boolean; matrix: boolean };

export function preflight(plan: ImportPlan, input: ImportInput, caps: ImportCapabilities): string | null {
  const p = inputProblem(input); if (p) return p;
  if (plan.blocked) return "A proposta tem erro ou divergência; nada pode ser gravado.";
  if (plan.issues.some((i) => i.level === "aviso") && !input.acknowledgeWarnings) return "Declare ciência dos avisos da fonte antes de gravar.";
  if (!input.confirmed) return "Confirme explicitamente a importação.";
  const needsCatalog = plan.steps.some((s) => s.kind === "catalogo" && s.status === "novo");
  const needsMatrix = plan.steps.some((s) => s.kind === "matriz" && s.status === "novo");
  if (needsCatalog && !caps.catalog) return "Sua atuação vigente não concede manter-catalogos-institucionais em rede.";
  if (needsMatrix && !caps.matrix) return "Sua atuação vigente não concede manter-matrizes-curriculares em rede.";
  return null;
}

/** Executa só passos "novo", em ordem (catálogos antes de matrizes); para na primeira falha. */
export async function executePlan(plan: ImportPlan, input: ImportInput, caps: ImportCapabilities, rpc: Rpc, src: MatrixSource = CME_SOURCE): Promise<ExecOutcome> {
  const problem = preflight(plan, input, caps);
  if (problem) throw new Error(problem);
  const out: ExecOutcome = { done: [], skipped: [], failed: null, notStarted: [] };
  const ordered = [...plan.steps.filter((s) => s.kind === "catalogo"), ...plan.steps.filter((s) => s.kind === "matriz")];
  for (const step of ordered) {
    if (out.failed) { out.notStarted.push(step); continue; }
    if (step.status === "identico") { out.skipped.push(step); continue; }
    const call = step.kind === "catalogo"
      ? rpc("record_attribute_value_version", {
          _scheme: step.scheme, _value: step.value, _base_version: null, _label: step.label, _status: "homologada",
          _valid_from: input.configuredValidFrom, _act_ref: citation(src, null, input.documentRef), _reason: null,
        })
      : rpc("record_curricular_matrix_version", step.args);
    const { data, error } = await call;
    if (error) out.failed = { step, message: error.message };
    else out.done.push({ step, result: data });
  }
  return out;
}
