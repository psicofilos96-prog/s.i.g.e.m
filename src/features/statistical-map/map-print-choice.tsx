import { useState } from "react";
import type { MapDocumentModel } from "./map-structures";

/** Escolha de aparência da impressão do Mapa; só muda o visual, nunca os dados. */
export type PrintOpts = { model: MapDocumentModel; cover: boolean };
export const printOpts: PrintOpts = { model: "premium", cover: true };

export function PrintChoice() {
  const [o, setO] = useState<PrintOpts>({ ...printOpts });
  const upd = (n: PrintOpts) => { Object.assign(printOpts, n); setO(n); };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-1">Modelo
        <select aria-label="Modelo de impressão" className="rounded-md border border-input bg-background px-2 py-1" value={o.model} onChange={(e) => upd({ ...o, model: e.target.value as MapDocumentModel })}>
          <option value="premium">Institucional</option><option value="administrativo">Administrativo (econômico)</option>
        </select>
      </label>
      {o.model === "premium" && <label className="flex items-center gap-1"><input type="checkbox" checked={o.cover} onChange={(e) => upd({ ...o, cover: e.target.checked })} /> Capa</label>}
    </div>
  );
}
