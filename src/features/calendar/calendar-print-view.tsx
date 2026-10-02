/**
 * View exclusiva de impressão do Calendário Escolar (A4 paisagem).
 *
 * Renderizada fora da árvore da aplicação (portal direto em <body>), para
 * que a impressão contenha SOMENTE o documento: em @media print todo filho
 * de <body> que não seja `.cd-print-root` é ocultado — interface do SIGEM,
 * overlays, selos externos e ferramentas de desenvolvimento.
 * Usa os mesmos dados e a mesma projeção do calendário; só a diagramação muda.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDocument } from "./calendar-document";
import { deriveCalendarProjection } from "./calendar-engine";
import type { NetworkCalendar } from "./calendar-types";

export function CalendarPrintView({ cal, notice }: { cal: NetworkCalendar; notice?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="cd-print-root" aria-hidden>
      <div className="cd-a4">
        <CalendarDocument
          cal={cal}
          projection={deriveCalendarProjection(cal)}
          notice={notice ? <p className="cd-marca-dagua">{notice}</p> : null}
          printContext
        />
      </div>
    </div>,
    document.body,
  );
}
