/** Padrão Brasileiro de Datas — documentação viva; reutiliza a infraestrutura central. */
import { useState } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import {
  formatAcademicDate,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
} from "@/lib/academic-date";

const SAMPLE = "2027-02-04";
const ROWS: Array<[string, string, string]> = [
  ["Data completa (preferencial)", "formatAcademicDate", formatAcademicDate(SAMPLE)],
  ["Dia e mês", "formatDayMonth", formatDayMonth(SAMPLE)],
  ["Mês e ano", "formatMonthYear", formatMonthYear("2027-02")],
  ["Por extenso", "formatLongDate", formatLongDate(SAMPLE)],
  ["Data com hora", "formatDateTime", formatDateTime("2027-02-04T11:30:00Z")],
];

export function DateStandardSpecimen() {
  const [value, setValue] = useState(SAMPLE);
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Padrão global obrigatório para componentes atuais e futuros. Internamente toda data é
        canônica <b className="text-foreground">AAAA-MM-DD</b> (domínio, URLs, ordenação); na tela,
        sempre ordem brasileira dia → mês → ano. Nunca exibir ISO nem MM/DD/AAAA.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Representação interna</div>
          <code className="font-mono">{SAMPLE}</code>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Apresentação brasileira</div>
          <span className="font-medium">{formatAcademicDate(SAMPLE)}</span>
        </div>
      </div>
      <ul className="divide-y rounded-md border">
        {ROWS.map(([label, fn, out]) => (
          <li key={fn} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              {label} <code className="text-xs text-muted-foreground">{fn}</code>
            </span>
            <span className="font-medium">{out}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="ds-date">Campo de data (DateInput)</Label>
          <DateInput id="ds-date" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Digita-se dd/mm/aaaa; o código recebe <code>{value || "—"}</code>. Formatação e leitura só
          por <code>@/lib/academic-date</code>; nunca usar campo de data nativo diretamente.
        </p>
      </div>
    </div>
  );
}
