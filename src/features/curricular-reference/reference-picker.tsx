import { useMemo, useState } from "react";
import { searchItems, selectionLabel, type Catalog, type SearchQuery } from "./reference-engine";

/**
 * Seletor para planejamento/avaliação: a pessoa busca por palavra e marca itens; não precisa digitar código.
 * O consumidor guarda o ID do item (edição preservada), nunca o texto.
 */
export function ReferencePicker({ catalog, selected, onChange, scope, label = "Habilidades e descritores" }: {
  catalog: Catalog; selected: readonly string[]; onChange: (ids: string[]) => void; scope?: Omit<SearchQuery, "text">; label?: string;
}) {
  const [text, setText] = useState("");
  const results = useMemo(() => searchItems(catalog, { ...scope, text }).slice(0, 50), [catalog, scope, text]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
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
                <input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
                <span><span className="font-mono text-xs text-muted-foreground">{i.code}</span> {selectionLabel(catalog, i)}</span>
              </label>
            </li>))}
        </ul>)}
    </fieldset>
  );
}
