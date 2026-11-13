import { CalendarDays } from "lucide-react";
import { useActiveYear } from "./active-year";

/** Seletor do ano letivo no menu superior; vale para todo o sistema. */
export function ActiveYearPicker() {
  const y = useActiveYear();
  if (y.loading || y.years.length === 0) return null;
  const short = (l: string) => l.replace(/^Ano letivo\s*/i, "");
  return (
    <label className="flex items-center gap-1.5 text-sm" title={y.fallback ? "O ano de hoje ainda não está cadastrado; mostrando o mais recente." : "Ano letivo mostrado em todo o sistema"}>
      <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Ano letivo</span>
      <select
        aria-label="Ano letivo"
        className="h-9 rounded-full border border-border/70 bg-card/70 px-2 text-sm font-medium text-foreground"
        value={y.id}
        onChange={(e) => y.setYear(e.target.value)}
      >
        {y.years.map((o) => <option key={o.id} value={o.id}>{short(o.label)}{o.id === y.currentId ? " (atual)" : ""}</option>)}
      </select>
    </label>
  );
}
