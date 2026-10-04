/**
 * B4.6.7c — Folha institucional do calendário: aparência do snapshot salvo (simbologia, assinaturas, título) e
 * dias/efeitos só das declarações homologadas/registradas da versão. Não chama o motor do laboratório.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DayMark } from "./calendar-mark";
import type { PrintModel } from "./institutional-calendar-presentation";

const EFFECT_TEXT: Record<string, string> = {
  letivo: "letivo", "nao-letivo": "não letivo", "sem-declaracao": "sem declaração",
  "efeito-nao-declarado": "efeito não declarado", conflito: "conflito", indeterminado: "indeterminado",
};
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function InstitutionalPrintSheet({ model, presentation }: { model: PrintModel; presentation: Record<string, unknown> }) {
  const overrides = presentation["symbology"] as never;
  const printOverrides = presentation["symbologyPrint"] as never;
  const types = (presentation["dayTypeCatalog"] ?? undefined) as never;
  return (
    <div className="cd-a4 space-y-3 text-xs" data-testid="institutional-print-sheet">
      <h1 className="text-base font-semibold">{model.title ?? "Calendário (título não declarado)"}</h1>
      {model.unmappedTypes.length > 0 && <p role="note">Tipos sem símbolo vinculado na apresentação: {model.unmappedTypes.join(", ")}.</p>}
      <div className="grid grid-cols-3 gap-2">
        {model.months.map((m) => (
          <table key={m.key} className="w-full border border-border">
            <caption className="font-medium">{m.key.slice(5, 7)}/{m.key.slice(0, 4)}</caption>
            <tbody>{m.days.map((d) => (
              <tr key={d.on} className="border-t border-border">
                <td>{d.on.slice(8, 10)}</td>
                <td>{d.symbolCode ? <DayMark code={d.symbolCode as never} text={d.typeLabel ?? ""} overrides={overrides} printOverrides={printOverrides} types={types} /> : (d.typeLabel ?? "—")}</td>
                <td>{EFFECT_TEXT[d.effect]}</td><td>{d.label ?? ""}</td>
              </tr>))}</tbody>
          </table>))}
      </div>
      <table className="w-full"><tbody>
        {model.periods.map((p) => <tr key={p.name}><td>{p.name} ({br(p.startsOn)} a {br(p.endsOn)})</td>
          <td>{p.schoolDays === null ? `indeterminado (${p.reason})` : `${p.schoolDays} dias letivos`}</td></tr>)}
        <tr><td className="font-medium">Total do intervalo lido</td>
          <td>{model.total.schoolDays === null ? `indeterminado (${model.total.reason})` : `${model.total.schoolDays} dias letivos`}</td></tr>
      </tbody></table>
      {model.signatures.length > 0 && <div className="flex flex-wrap gap-8 pt-6">{model.signatures.map((s, i) => <span key={i} className="border-t border-border pt-1">{s}</span>)}</div>}
    </div>
  );
}

export function InstitutionalCalendarPrint(props: { model: PrintModel; presentation: Record<string, unknown> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<div className="cd-print-root" aria-hidden><InstitutionalPrintSheet {...props} /></div>, document.body);
}
