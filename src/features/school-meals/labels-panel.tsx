import { useEffect, useState } from "react";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { LABEL_KINDS, labelsSheetHtml, type LabelKind } from "./labels";

const field = "mt-1 block w-full rounded-lg border bg-background p-3 text-base";

/** Gerador de etiquetas (Anexos 10–13): folha A4 pronta para imprimir. */
export function LabelsPanel({ school, today, stock }: { school: string; today: string; stock: { item: string; expires_on: string | null }[] }) {
  const [name, setName] = useState(school);
  const [kind, setKind] = useState<LabelKind>("estocavel");
  const [copies, setCopies] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { readCurrentSchoolNames([school]).then((m) => setName(m.get(school) ?? school), () => undefined); }, [school]);
  const products = stock.map((s) => ({ name: s.item, expiresOn: s.expires_on }));
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { setMsg("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(labelsSheetHtml({ kind, school: name, products, copies: Number(copies), date: today }));
    w.document.close(); w.focus(); w.print();
  };
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Etiquetas</h2>
      <label className="block">Tipo<select className={field} value={kind} onChange={(e) => setKind(e.target.value as LabelKind)}>
        {LABEL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.title} ({k.anexo})</option>)}</select></label>
      <label className="block">Cópias {kind === "manipulado" || kind === "estocavel" ? "por produto" : ""}<input inputMode="numeric" className={field} value={copies} onChange={(e) => setCopies(e.target.value.replace(/\D/g, ""))} /></label>
      {(kind === "manipulado" || kind === "estocavel") && <p className="text-sm text-muted-foreground">{products.length ? `${products.length} produto(s) do estoque da escola.` : "Sem produtos no estoque: sai etiqueta em branco."}</p>}
      <button type="button" onClick={print} className="w-full rounded-lg bg-primary p-3 text-primary-foreground">Imprimir folha A4</button>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
