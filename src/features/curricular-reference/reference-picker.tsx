import { useMemo, useState } from "react";
import { searchItems, selectionLabel, toReferenceRef, type Catalog, type CurricularReferenceRef, type SearchQuery } from "./reference-engine";

/**
 * Seletor estável para consumidores futuros: busca amigável, seleção por ID imutável do item (edição preservada).
 * `onChangeRefs` entrega o contrato completo (item + edição + simplificação exibida); o consumidor nunca guarda só código/texto.
 */
export function ReferencePicker({ catalog, selected, onChange, onChangeRefs, scope, multiple = true, label = "Habilidades e descritores" }: {
  catalog: Catalog; selected: readonly string[]; onChange: (ids: string[]) => void; onChangeRefs?: (refs: CurricularReferenceRef[]) => void;
  scope?: Omit<SearchQuery, "text">; multiple?: boolean; label?: string;
}) {
  const [text, setText] = useState("");
  const results = useMemo(() => searchItems(catalog, { ...scope, text }).slice(0, 50), [catalog, scope, text]);
  const emit = (ids: string[]) => {
    onChange(ids);
    onChangeRefs?.(ids.map((id) => toReferenceRef(catalog, id)).filter((r): r is CurricularReferenceRef => !!r));
  };
  const toggle = (id: string) => emit(selected.includes(id) ? selected.filter((x) => x !== id) : multiple ? [...selected, id] : [id]);
  const edLabel = (editionId: string) => { const e = catalog.editions.find((x) => x.id === editionId); return e ? `${e.source_label} — ${e.edition_label}` : ""; };
  if (catalog.items.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma referência curricular registrada ainda.</p>;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <input aria-label="Buscar por palavra ou código" className="w-full rounded border bg-background p-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar por palavra ou código" />
      {results.length === 0 ? <p className="text-sm text-muted-foreground">Nada encontrado.</p> : (
        <ul className="max-h-72 overflow-auto rounded border text-sm">
          {results.map((i) => (
            <li key={i.id} className="border-t first:border-t-0">
              <label className="flex gap-2 p-2">
                <input type={multiple ? "checkbox" : "radio"} checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
                <span><span className="font-mono text-xs text-muted-foreground">{i.code}</span> {selectionLabel(catalog, i)}
                  <span className="block text-xs text-muted-foreground">{edLabel(i.edition_id)}</span></span>
              </label>
            </li>))}
        </ul>)}
    </fieldset>
  );
}
