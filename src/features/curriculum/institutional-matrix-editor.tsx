/**
 * B4.1.3 — Editor institucional de versões da matriz curricular.
 * Grava SOMENTE pelo writer canônico de 11 argumentos; nada do passado é editado.
 * Escrita visível só com a capacidade efetiva `manter-matrizes-curriculares` em rede;
 * o banco revalida. Sem catálogo homologado, unidade/elemento/referência ficam bloqueados.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/sigem/date-input";
import {
  MATRIX_ELEMENT_SCHEME, MATRIX_UNIT_SCHEME, humanMatrixError, loadAcademicYearOptions, loadComponentsAt, loadSchoolOptions, loadHomologatedValues, recordMatrixVersion,
} from "@/features/curriculum/curricular-matrix-source";
import {
  addApplicability, cellKey, splitCellKey, headerRows, isNumericLiteral, nextKey, orderedLeaves, toWriterArgs, validateDraft, type CatalogRef, type MatrixDraft,
} from "@/features/curriculum/matrix-editor-model";

const MODE_LABEL: Record<MatrixDraft["mode"], string> = {
  constituicao: "Constituir nova matriz",
  sucessao: "Nova versão por sucessão (nova deliberação a partir de uma data)",
  retificacao: "Retificação (corrige a versão anterior; o histórico é preservado)",
};

const refKey = (r: CatalogRef) => `${r.scheme}|${r.value}|${r.version}`;
const parseRef = (s: string): CatalogRef | null => {
  if (!s) return null;
  const [scheme = "", value = "", version = ""] = s.split("|");
  return { scheme, value, version: Number(version) };
};

export function MatrixVersionEditor({ initial, onDone, onCancel }: {
  initial: MatrixDraft; onDone: (r: { matrixId: string; version: number }) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<MatrixDraft>(initial);
  const [showIssues, setShowIssues] = useState(false);
  const qc = useQueryClient();
  const on = d.validFrom || new Date().toISOString().slice(0, 10);
  const components = useQuery({ queryKey: ["b413-components", on], queryFn: () => loadComponentsAt(on) });
  const units = useQuery({ queryKey: ["b413-cat", MATRIX_UNIT_SCHEME, on], queryFn: () => loadHomologatedValues(MATRIX_UNIT_SCHEME, on) });
  const elements = useQuery({ queryKey: ["b413-cat", MATRIX_ELEMENT_SCHEME, on], queryFn: () => loadHomologatedValues(MATRIX_ELEMENT_SCHEME, on) });
  const [refScheme, setRefScheme] = useState("");
  const refValues = useQuery({
    queryKey: ["b413-cat", refScheme, on], enabled: refScheme.trim() !== "",
    queryFn: () => loadHomologatedValues(refScheme.trim(), on),
  });

  const issues = useMemo(() => validateDraft(d), [d]);
  const leaves = orderedLeaves(d.columns);
  const heads = headerRows(d.columns);
  const unitList = units.data ?? [];
  const elementList = elements.data ?? [];

  const save = useMutation({
    mutationFn: () => recordMatrixVersion(toWriterArgs(d) as unknown as Record<string, unknown>),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("b41") });
      onDone(r);
    },
  });

  const set = (patch: Partial<MatrixDraft>) => setD((x) => ({ ...x, ...patch }));
  const issueFor = (field: string) => issues.filter((i) => i.field === field || i.field.startsWith(`${field}.`));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowIssues(true);
    if (issues.length === 0) save.mutate();
  };

  const FieldError = ({ field }: { field: string }) =>
    showIssues && issueFor(field).length > 0 ? (
      <p id={`err-${field}`} className="text-xs text-destructive">{issueFor(field).map((i) => i.message).join(" ")}</p>
    ) : null;

  return (
    <form onSubmit={submit} className="space-y-6 rounded-md border border-border p-4" aria-label="Editor de versão da matriz curricular" noValidate>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{MODE_LABEL[d.mode]}</h2>
        <p className="text-xs text-muted-foreground">
          Gravar cria uma NOVA versão; versões anteriores nunca são alteradas. Símbolos (X, --, *) e números são guardados exatamente como digitados;
          célula em branco significa que nada foi transcrito. O sistema não deduz carga, etapa, modalidade nem vínculo com turmas.
        </p>
        {d.mode !== "constituicao" && <p className="text-xs text-muted-foreground">Versão-base esperada: {d.baseVersionId}. Se outra versão for registrada antes, a gravação é recusada.</p>}
      </header>

      {/* Identificação e referência ------------------------------------------------ */}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">Versão e referência documental</legend>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="m-name">Nome oficial</Label>
          <Input id="m-name" value={d.officialName} onChange={(e) => set({ officialName: e.target.value })} aria-invalid={showIssues && issueFor("officialName").length > 0} />
          <FieldError field="officialName" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-from">Vigente a partir de</Label>
          <DateInput id="m-from" value={d.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
          <FieldError field="validFrom" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-until">Vigente até (opcional)</Label>
          <DateInput id="m-until" value={d.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
          <FieldError field="validUntil" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="m-act">Referência documental/fonte (opcional, ex.: deliberação que define a matriz)</Label>
          <Input id="m-act" value={d.actRef} onChange={(e) => set({ actRef: e.target.value })} />
          <FieldError field="actRef" />
        </div>
        {d.mode !== "constituicao" && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="m-reason">Motivo da nova versão</Label>
            <Textarea id="m-reason" value={d.reason} onChange={(e) => set({ reason: e.target.value })} />
            <FieldError field="reason" />
            <FieldError field="base" />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="m-loc">Anexo / trecho do documento-fonte</Label>
          <Input id="m-loc" value={d.source.locator} onChange={(e) => set({ source: { ...d.source, locator: e.target.value } })} />
          <FieldError field="source.locator" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-page">Página (opcional)</Label>
          <Input id="m-page" value={d.source.page} onChange={(e) => set({ source: { ...d.source, page: e.target.value } })} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="m-sha">Identificador do documento — sha256 (opcional)</Label>
          <Input id="m-sha" value={d.source.sha256} onChange={(e) => set({ source: { ...d.source, sha256: e.target.value } })} />
          <FieldError field="source.sha256" />
        </div>
      </fieldset>

      {/* Colunas ------------------------------------------------------------ */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Colunas (aninháveis em qualquer profundidade)</legend>
        {d.columns.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma coluna.</p>}
        <ul className="space-y-2">
          {d.columns.map((c, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`c-key-${i}`}>Chave</Label>
                <Input id={`c-key-${i}`} className="w-32" value={c.key} onChange={(e) => {
                  const old = c.key; const key = e.target.value;
                  setD((x) => ({
                    ...x,
                    columns: x.columns.map((y, j) => (j === i ? { ...y, key } : y.parent === old ? { ...y, parent: key } : y)),
                    cells: Object.fromEntries(Object.entries(x.cells).map(([k, v]) => {
                      const [r, col] = splitCellKey(k); return [col === old ? cellKey(r, key) : k, v];
                    })),
                  }));
                }} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`c-h-${i}`}>Cabeçalho</Label>
                <Input id={`c-h-${i}`} className="w-48" value={c.header} onChange={(e) => set({ columns: d.columns.map((y, j) => (j === i ? { ...y, header: e.target.value } : y)) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`c-p-${i}`}>Subordinada a</Label>
                <select id={`c-p-${i}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={c.parent ?? ""}
                  onChange={(e) => set({ columns: d.columns.map((y, j) => (j === i ? { ...y, parent: e.target.value || null } : y)) })}>
                  <option value="">(nenhuma — coluna de topo)</option>
                  {d.columns.filter((o) => o.key !== c.key).map((o) => <option key={o.key} value={o.key}>{o.header || o.key}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`c-r-${i}`}>Valor de catálogo (opcional)</Label>
                <select id={`c-r-${i}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={c.ref ? refKey(c.ref) : ""}
                  disabled={(refValues.data ?? []).length === 0 && !c.ref}
                  onChange={(e) => set({ columns: d.columns.map((y, j) => (j === i ? { ...y, ref: parseRef(e.target.value) } : y)) })}>
                  <option value="">(sem referência)</option>
                  {c.ref && <option value={refKey(c.ref)}>{c.ref.scheme}: {c.ref.value} v{c.ref.version}</option>}
                  {(refValues.data ?? []).map((v) => <option key={refKey(v)} value={refKey(v)}>{v.label} ({v.scheme} v{v.version})</option>)}
                </select>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setD((x) => ({ ...x, columns: x.columns.filter((_, j) => j !== i).map((y) => (y.parent === c.key ? { ...y, parent: c.parent } : y)) }))}>
                Remover coluna
              </Button>
              <FieldError field={`column.${c.key}`} />
            </li>
          ))}
        </ul>
        <FieldError field="columns" />
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => set({ columns: [...d.columns, { key: nextKey("col", d.columns), parent: null, header: "", ref: null }] })}>
            Adicionar coluna
          </Button>
          <div className="space-y-1">
            <Label htmlFor="ref-scheme">Catálogo para referência de coluna</Label>
            <Input id="ref-scheme" className="w-56" placeholder="identificador do catálogo" value={refScheme} onChange={(e) => setRefScheme(e.target.value)} />
          </div>
          {refScheme.trim() && refValues.data && refValues.data.length === 0 && (
            <p className="text-xs text-muted-foreground">Este catálogo não tem valor homologado nesta data; a referência fica indisponível.</p>
          )}
        </div>
      </fieldset>

      {/* Grupos ------------------------------------------------------------- */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Grupos de linhas</legend>
        <ul className="space-y-2">
          {d.groups.map((g, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor={`g-key-${i}`}>Chave</Label>
                <Input id={`g-key-${i}`} className="w-32" value={g.key} onChange={(e) => {
                  const old = g.key; const key = e.target.value;
                  setD((x) => ({ ...x, groups: x.groups.map((y, j) => (j === i ? { ...y, key } : y.parent === old ? { ...y, parent: key } : y)),
                    rows: x.rows.map((r) => (r.group === old ? { ...r, group: key } : r)) }));
                }} /></div>
              <div className="space-y-1"><Label htmlFor={`g-l-${i}`}>Rótulo</Label>
                <Input id={`g-l-${i}`} className="w-56" value={g.label} onChange={(e) => set({ groups: d.groups.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} /></div>
              <div className="space-y-1"><Label htmlFor={`g-p-${i}`}>Dentro de</Label>
                <select id={`g-p-${i}`} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={g.parent ?? ""}
                  onChange={(e) => set({ groups: d.groups.map((y, j) => (j === i ? { ...y, parent: e.target.value || null } : y)) })}>
                  <option value="">(nenhum)</option>
                  {d.groups.filter((o) => o.key !== g.key).map((o) => <option key={o.key} value={o.key}>{o.label || o.key}</option>)}
                </select></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setD((x) => ({ ...x, groups: x.groups.filter((_, j) => j !== i).map((y) => (y.parent === g.key ? { ...y, parent: g.parent } : y)), rows: x.rows.map((r) => (r.group === g.key ? { ...r, group: null } : r)) }))}>
                Remover grupo
              </Button>
              <FieldError field={`group.${g.key}`} />
            </li>
          ))}
        </ul>
        <FieldError field="groups" />
        <Button type="button" variant="outline" size="sm" onClick={() => set({ groups: [...d.groups, { key: nextKey("grupo", d.groups), parent: null, label: "" }] })}>Adicionar grupo</Button>
      </fieldset>

      {/* Linhas e células --------------------------------------------------- */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Linhas e células</legend>
        {unitList.length === 0 && (
          <p className="text-xs text-muted-foreground">Unidade de carga: não há catálogo homologado; números ficam apenas como texto transcrito, sem unidade.</p>
        )}
        {elementList.length === 0 && (
          <p className="text-xs text-muted-foreground">Itens não disciplinares: não há elemento de matriz homologado; somente componentes oficiais podem ser usados.</p>
        )}
        {components.data && components.data.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum componente curricular oficial registrado nesta data.</p>
        )}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Quadro em edição: cada campo é uma célula; em branco = nada transcrito.</caption>
            <thead>
              {heads.length === 0 ? (
                <tr><th scope="col" className="p-2 text-left">Linha</th></tr>
              ) : heads.map((hr, level) => (
                <tr key={level}>
                  {level === 0 && <th scope="col" rowSpan={heads.length} className="border-b border-border p-2 text-left">Linha</th>}
                  {hr.map((h) => <th key={h.key} scope="col" colSpan={h.colSpan} rowSpan={h.rowSpan} className="border-b border-l border-border p-2 text-center">{h.header || h.key}</th>)}
                </tr>
              ))}
            </thead>
            <tbody>
              {d.rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <th scope="row" className="min-w-[18rem] space-y-1 border-t border-border p-2 text-left font-normal">
                    <div className="flex flex-wrap gap-1">
                      <Input aria-label={`Chave da linha ${i + 1}`} className="h-8 w-28" value={r.key} onChange={(e) => {
                        const old = r.key; const key = e.target.value;
                        setD((x) => ({ ...x, rows: x.rows.map((y, j) => (j === i ? { ...y, key } : y)),
                          cells: Object.fromEntries(Object.entries(x.cells).map(([k, v]) => { const [rr, col] = splitCellKey(k); return [rr === old ? cellKey(key, col) : k, v]; })) }));
                      }} />
                      <select aria-label={`Papel da linha ${i + 1}`} className="h-8 rounded-md border border-input bg-background px-1 text-xs" value={r.role}
                        onChange={(e) => set({ rows: d.rows.map((y, j) => (j === i ? { ...y, role: e.target.value as typeof r.role, item: e.target.value === "item" ? y.item : null } : y)) })}>
                        <option value="item">item</option><option value="total">total transcrito</option><option value="rotulo">rótulo</option>
                      </select>
                      <select aria-label={`Grupo da linha ${i + 1}`} className="h-8 rounded-md border border-input bg-background px-1 text-xs" value={r.group ?? ""}
                        onChange={(e) => set({ rows: d.rows.map((y, j) => (j === i ? { ...y, group: e.target.value || null } : y)) })}>
                        <option value="">(sem grupo)</option>
                        {d.groups.map((g) => <option key={g.key} value={g.key}>{g.label || g.key}</option>)}
                      </select>
                    </div>
                    {r.role === "item" ? (
                      <select aria-label={`Componente ou elemento da linha ${i + 1}`} className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs"
                        value={r.item ? (r.item.kind === "componente" ? `c|${r.item.componentId}` : `e|${refKey(r.item.ref)}`) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          let item = null as MatrixDraft["rows"][number]["item"];
                          if (v.startsWith("c|")) { const c = components.data?.find((x) => x.id === v.slice(2)); item = { kind: "componente", componentId: v.slice(2), label: c?.name ?? v.slice(2) }; }
                          else if (v.startsWith("e|")) { const ref = parseRef(v.slice(2))!; item = { kind: "elemento", ref, label: elementList.find((x) => refKey(x) === refKey(ref))?.label ?? ref.value }; }
                          set({ rows: d.rows.map((y, j) => (j === i ? { ...y, item } : y)) });
                        }}>
                        <option value="">(escolha o componente oficial)</option>
                        {r.item?.kind === "componente" && !components.data?.some((c) => c.id === (r.item as { componentId: string }).componentId) && (
                          <option value={`c|${r.item.componentId}`}>{r.item.label} — {r.item.componentId} (não listado nesta data)</option>
                        )}
                        {(components.data ?? []).map((c) => <option key={c.id} value={`c|${c.id}`} disabled={!c.active}>{c.name} — {c.id}{c.active ? "" : " (inativo)"}</option>)}
                        {elementList.map((e) => <option key={refKey(e)} value={`e|${refKey(e)}`}>{e.label} — elemento v{e.version}</option>)}
                      </select>
                    ) : (
                      <Input aria-label={`Rótulo transcrito da linha ${i + 1}`} className="h-8" value={r.label} onChange={(e) => set({ rows: d.rows.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} />
                    )}
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" disabled={i === 0} aria-label={`Subir linha ${i + 1}`}
                        onClick={() => setD((x) => { const rows = [...x.rows]; const t = rows[i - 1]!; rows[i - 1] = rows[i]!; rows[i] = t; return { ...x, rows }; })}>↑</Button>
                      <Button type="button" variant="ghost" size="sm" disabled={i === d.rows.length - 1} aria-label={`Descer linha ${i + 1}`}
                        onClick={() => setD((x) => { const rows = [...x.rows]; const t = rows[i + 1]!; rows[i + 1] = rows[i]!; rows[i] = t; return { ...x, rows }; })}>↓</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setD((x) => ({ ...x, rows: x.rows.filter((_, j) => j !== i) }))}>Remover</Button>
                    </div>
                    <FieldError field={`row.${r.key}`} />
                  </th>
                  {leaves.map((c) => {
                    const k = cellKey(r.key, c.key);
                    const cell = d.cells[k];
                    const numeric = cell ? isNumericLiteral(cell.text) : false;
                    return (
                      <td key={c.key} className="border-l border-t border-border p-1">
                        <Input aria-label={`Célula ${r.key} × ${c.key} (em branco = nada transcrito)`} className="h-8 w-20 text-center" value={cell?.text ?? ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            setD((x) => {
                              const cells = { ...x.cells };
                              if (text === "") delete cells[k]; else cells[k] = { text, unit: isNumericLiteral(text) ? (cells[k]?.unit ?? null) : null };
                              return { ...x, cells };
                            });
                          }} />
                        {numeric && unitList.length > 0 && (
                          <select aria-label={`Unidade da célula ${r.key} × ${c.key}`} className="mt-1 h-7 w-20 rounded-md border border-input bg-background text-xs"
                            value={cell?.unit ? refKey(cell.unit) : ""}
                            onChange={(e) => setD((x) => ({ ...x, cells: { ...x.cells, [k]: { text: x.cells[k]?.text ?? "", unit: parseRef(e.target.value) } } }))}>
                            <option value="">(sem unidade)</option>
                            {unitList.map((u) => <option key={refKey(u)} value={refKey(u)}>{u.label}</option>)}
                          </select>
                        )}
                        <FieldError field={`cell.${k}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => set({ rows: [...d.rows, { key: nextKey("linha", d.rows), group: null, role: "item", label: "", item: null }] })}>
          Adicionar linha
        </Button>
      </fieldset>

      {/* Notas -------------------------------------------------------------- */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Notas transcritas</legend>
        <ul className="space-y-2">
          {d.notes.map((n, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor={`n-k-${i}`}>Chave</Label>
                <Input id={`n-k-${i}`} className="w-28" value={n.key} onChange={(e) => set({ notes: d.notes.map((y, j) => (j === i ? { ...y, key: e.target.value } : y)) })} /></div>
              <div className="space-y-1"><Label htmlFor={`n-m-${i}`}>Marcador</Label>
                <Input id={`n-m-${i}`} className="w-16" value={n.marker} onChange={(e) => set({ notes: d.notes.map((y, j) => (j === i ? { ...y, marker: e.target.value } : y)) })} /></div>
              <div className="min-w-[16rem] flex-1 space-y-1"><Label htmlFor={`n-t-${i}`}>Texto</Label>
                <Input id={`n-t-${i}`} value={n.text} onChange={(e) => set({ notes: d.notes.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} /></div>
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ notes: d.notes.filter((_, j) => j !== i) })}>Remover</Button>
              <FieldError field={`note.${n.key}`} />
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => set({ notes: [...d.notes, { key: nextKey("nota", d.notes), marker: "", text: "" }] })}>Adicionar nota</Button>
      </fieldset>

      <ApplicabilityEditor draft={d} on={on} onChange={setD} />

      {showIssues && issues.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          <p className="font-semibold">Corrija antes de gravar ({issues.length}):</p>
          <ul className="list-disc pl-5">{issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>
        </div>
      )}
      {save.error && <p role="alert" className="text-sm text-destructive">{humanMatrixError((save.error as Error).message)}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Gravando…" : "Gravar nova versão"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

/**
 * Aplicabilidade: referências explícitas a IDs oficiais existentes (ano letivo, unidade)
 * ou a valor homologado de qualquer catálogo. Não define eixo de oferta (D1) nem se as
 * referências se combinam por E ou OU; o banco revalida vigência e homologação.
 */
function ApplicabilityEditor({ draft, on, onChange }: { draft: MatrixDraft; on: string; onChange: (d: MatrixDraft) => void }) {
  const years = useQuery({ queryKey: ["b413-years", on], queryFn: () => loadAcademicYearOptions(on) });
  const schools = useQuery({ queryKey: ["b413-schools", on], queryFn: () => loadSchoolOptions(on) });
  const [scheme, setScheme] = useState("");
  const values = useQuery({ queryKey: ["b413-cat", scheme.trim(), on], enabled: scheme.trim() !== "", queryFn: () => loadHomologatedValues(scheme.trim(), on) });
  const [year, setYear] = useState(""); const [school, setSchool] = useState(""); const [value, setValue] = useState("");
  const yearName = (id: string) => years.data?.find((y) => y.id === id)?.name;
  const schoolName = (id: string) => schools.data?.find((y) => y.id === id)?.name;
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">Aplicabilidade (referências explícitas)</legend>
      <p className="text-xs text-muted-foreground">
        Cada linha é uma referência registrada como informada. O sistema não decide o eixo de oferta nem como as referências se combinam,
        e não liga a matriz a turmas. Opções vêm só de registros oficiais ativos na data de início e de valores homologados.
      </p>
      {draft.applicability.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma aplicabilidade declarada.</p> : (
        <ul className="space-y-1 text-sm">
          {draft.applicability.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <span>{a.dimension === "ano-letivo" ? `Ano letivo ${yearName(a.academicYearId) ?? ""} — ${a.academicYearId}`
                : a.dimension === "escola" ? `Unidade ${schoolName(a.schoolId) ?? ""} — ${a.schoolId}` : `${a.schemeId}: ${a.valueId} (v${a.valueVersion})`}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...draft, applicability: draft.applicability.filter((_, j) => j !== i) })}>Retirar</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label htmlFor="ap-year">Ano letivo</Label>
          <select id="ap-year" className={sel} value={year} onChange={(e) => setYear(e.target.value)} disabled={!years.data?.length}>
            <option value="">{years.data?.length ? "(escolha)" : "(nenhum ano letivo ativo nesta data)"}</option>
            {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name} — {y.id}</option>)}
          </select></div>
        <Button type="button" variant="outline" size="sm" disabled={!year}
          onClick={() => { onChange(addApplicability(draft, { dimension: "ano-letivo", academicYearId: year })); setYear(""); }}>Acrescentar ano</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label htmlFor="ap-school">Unidade escolar</Label>
          <select id="ap-school" className={sel} value={school} onChange={(e) => setSchool(e.target.value)} disabled={!schools.data?.length}>
            <option value="">{schools.data?.length ? "(escolha)" : "(nenhuma unidade ativa nesta data)"}</option>
            {(schools.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name} — {y.id}</option>)}
          </select></div>
        <Button type="button" variant="outline" size="sm" disabled={!school}
          onClick={() => { onChange(addApplicability(draft, { dimension: "escola", schoolId: school })); setSchool(""); }}>Acrescentar unidade</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label htmlFor="ap-scheme">Catálogo (identificador)</Label>
          <Input id="ap-scheme" className="w-56" value={scheme} onChange={(e) => { setScheme(e.target.value); setValue(""); }} /></div>
        <div className="space-y-1"><Label htmlFor="ap-value">Valor homologado</Label>
          <select id="ap-value" className={sel} value={value} onChange={(e) => setValue(e.target.value)} disabled={!values.data?.length}>
            <option value="">{!scheme.trim() ? "(informe o catálogo)" : values.data?.length ? "(escolha)" : "(sem valor homologado nesta data)"}</option>
            {(values.data ?? []).map((v) => <option key={refKey(v)} value={refKey(v)}>{v.label} — {v.value} v{v.version}</option>)}
          </select></div>
        <Button type="button" variant="outline" size="sm" disabled={!value}
          onClick={() => { const r = parseRef(value)!; onChange(addApplicability(draft, { dimension: "atributo", schemeId: r.scheme, valueId: r.value, valueVersion: r.version })); setValue(""); }}>
          Acrescentar valor
        </Button>
      </div>
    </fieldset>
  );
}
