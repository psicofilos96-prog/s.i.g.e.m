/**
 * Aviso de excesso na folha A4. Mede uma cópia fora da tela do MESMO documento
 * (mesmo CSS de impressão) e só informa; nunca ajusta nada.
 */
import { useRef, type ReactNode } from "react";
import { CalendarDocument } from "./calendar-document";
import { A4_OVERFLOW_MESSAGE, useA4Overflow } from "./calendar-a4-fit";
import type { NetworkCalendar } from "./calendar-types";

export function A4OverflowNotice({ cal, notice, className }: { cal: NetworkCalendar; notice?: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const found = useA4Overflow(ref, cal);
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed left-[-20000px] top-0 opacity-0" data-testid="a4-medicao">
        <div ref={ref} className="cd-a4 cd-a4-tela">
          <CalendarDocument cal={cal} notice={notice ?? null} />
        </div>
      </div>
      {found.length ? (
        <div role="alert" className={className ?? "rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"}>
          <p className="font-semibold">{A4_OVERFLOW_MESSAGE}</p>
          <p>
            Blocos que ultrapassam a área útil:{" "}
            {found.map((f) => `${f.label} (${f.excessMm.toFixed(1)} mm ${f.direction})`).join("; ")}.
          </p>
          <p>Nada é reduzido automaticamente: ajuste fontes, espaçamentos ou margens se quiser caber em uma folha.</p>
        </div>
      ) : null}
    </>
  );
}
