/**
 * Documento "Calendário Escolar" — reprodução fiel do modelo interno da
 * Supervisão (grade-calendario.tsx da especificação). A tela administrativa
 * ao redor pode seguir o Design System; ESTE componente não é redesenhado.
 */
import { InfoLinesAt } from "./calendar-info-lines";
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { InstitutionalLogo } from "@/features/identity/institutional-logo";
import { dayTypesOf, typeInfo } from "./calendar-catalog";
import { logosOf, type CalendarLogo } from "./calendar-logos";
import { safeImageSrc } from "./calendar-image-asset";
import {
  deriveCalendarProjection,
  shiftDays,
  shortDate,
  type CalendarProjection,
  type GridRow,
} from "./calendar-engine";
import type { NetworkCalendar } from "./calendar-types";
import { layoutCss } from "./calendar-layout";
import { DayMark } from "./calendar-mark";

/** Chip sem borda para tipos de fundo branco (derivado das cores do tipo). */
const noBorder = (bg: string) => bg.toUpperCase() === "#FFFFFF";

/** Renderiza UMA logo já resolvida para o contexto (geral ou impressão). */
export function LogoItem({ raw, printContext }: { raw: CalendarLogo; printContext: boolean }) {
  void printContext;
  const l = raw;
  if (!l.visible || l.source.kind === "none") return null;
  const style = {
    width: l.width ? `${l.width}${l.unit === "mm" ? "mm" : "px"}` : undefined,
    height: l.height ? `${l.height}${l.unit === "mm" ? "mm" : "px"}` : undefined,
    objectFit: l.fit,
    opacity: l.opacity ?? 1,
  } as const;
  if (l.source.kind === "identity") return <InstitutionalLogo kind={l.source.identityKind} />;
  if (l.source.kind === "asset") {
    const src = safeImageSrc(l.source.assetId);
    if (!src) return null;
    return <img src={src} alt={l.label} style={{ ...style, maxWidth: "100%", maxHeight: "100%" }} />;
  }
  return null;
}

function Row({
  row,
  editable,
  selected,
  symbology,
}: {
  row: GridRow;
  editable: boolean;
  symbology?: NetworkCalendar["symbology"];
  selected?: string | null | undefined;
}) {
  if (row.kind === "total")
    return (
      <tr className="cd-faixa">
        <td className="cd-faixa-rotulo" colSpan={32}>
          {row.label}
        </td>
        <td colSpan={2}>{row.total}</td>
      </tr>
    );
  return (
    <tr>
      <td className="cd-mes">{row.monthName}</td>
      {row.segments.map((seg) => {
        if (seg.kind === "ferias")
          return (
            <td
              key={`f-${seg.startDay}`}
              className="cd-ferias"
              colSpan={seg.colSpan}
              aria-label={`Férias — ${seg.colSpan} dias`}
            >
              FÉRIAS
            </td>
          );
        const c = seg.cell;
        if (!c.active) return <td key={c.day} className="cd-dia cd-inexistente" aria-hidden />;
        const cls = [
          "cd-dia",
          c.text.length > 4 ? "cd-dia-longo" : "",
          selected === c.date ? "cd-selecionado" : "",
        ].join(" ");
        return (
          <td
            key={c.day}
            className={cls}
            style={{ backgroundColor: c.background, color: c.foreground }}
            title={c.tooltip}
          >
            {editable ? (
              <button
                type="button"
                className="cd-dia-botao"
                data-date={c.date}
                aria-label={c.tooltip}
                aria-pressed={selected === c.date}
              >
                <DayMark code={c.code} text={c.text} overrides={symbology} />
              </button>
            ) : (
              <span aria-label={c.tooltip}>
                <DayMark code={c.code} text={c.text} overrides={symbology} />
              </span>
            )}
          </td>
        );
      })}
      {row.splitTotal ? (
        <>
          <td className="cd-total">{row.splitTotal[0] || ""}</td>
          <td className="cd-total">{row.splitTotal[1] || ""}</td>
        </>
      ) : (
        <td className="cd-total" colSpan={2}>
          {row.total || ""}
        </td>
      )}
    </tr>
  );
}

function PeriodLine({
  name,
  start,
  end,
  days,
}: {
  name: string;
  start: string;
  end: string;
  days: number;
}) {
  return (
    <div className="cd-periodo-linha">
      <span>{name}</span>
      <span>—</span>
      <span>
        {shortDate(start)} a {shortDate(end)}
      </span>
      <span>=</span>
      <span className="cd-periodo-numero">{days}</span>
      <span>Dias</span>
    </div>
  );
}

/** Informações adicionais: uma linha por item (texto livre da Supervisão). */
export function observationLines(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function Periods({ cal, p }: { cal: NetworkCalendar; p: CalendarProjection }) {
  // Conselho com texto configurado aparece mesmo com o bloco automático desligado.
  const councils = p.councils.filter(
    (c) =>
      cal.document.showCouncils ||
      !!cal.periods.find((x) => x.id === c.periodId)?.councilLabel?.trim(),
  );
  const infoLines = observationLines(cal.observations);
  const doc = cal.document;
  const line = (x: CalendarProjection["periods"][number]) => (
    <PeriodLine
      key={x.period.id}
      name={x.period.name}
      start={x.period.start}
      end={x.period.end}
      days={x.schoolDays}
    />
  );
  return (
    <div className="cd-coluna">
      <InfoLinesAt lines={infoLines} place="antes-periodos" />
      {doc.showPeriods ? (
        <div className="cd-periodos" data-cd-bloco="periodos">
          {p.grouped
            ? p.groups.map((b) => (
                <div key={b.group?.id ?? "sem-grupo"}>
                  {doc.showGroupSummaries ? (
                    <div className="cd-bloco">
                      {b.block} = {b.total} DIAS LETIVOS
                    </div>
                  ) : null}
                  {b.periods.map(line)}
                </div>
              ))
            : p.periods.map(line)}
        </div>
      ) : null}
      <InfoLinesAt lines={infoLines} place="depois-periodos" />
      {doc.showAnnualTotal ? (
        <div className="cd-periodos cd-total-anual" data-cd-bloco="total">
          <div className="cd-periodo-linha">
            <span style={{ gridColumn: "1 / 4" }}>Total de dias letivos</span>
            <span>=</span>
            <span className="cd-periodo-numero">{p.annualSchoolDays}</span>
            <span>Dias</span>
          </div>
        </div>
      ) : null}
      <InfoLinesAt lines={infoLines} place="depois-total" />
      {councils.length > 0 ? (
        <div className="cd-conselhos" data-cd-bloco="conselhos">
          {councils.map((c) => (
            <div key={c.key} className="cd-conselho-linha">
              <b>{shortDate(c.date)}</b>
              <span>—</span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      <InfoLinesAt lines={infoLines} place="depois-conselhos" />
    </div>
  );
}

export function CalendarDocument({
  cal,
  editable = false,
  selectedDate,
  onSelect,
  notice,
  projection,
  printContext,
}: {
  cal: NetworkCalendar;
  editable?: boolean;
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
  /** Aviso de estado (ex.: não homologado) — fora da composição oficial. */
  notice?: ReactNode;
  /** Projeção já derivada pela tela (evita segundo cálculo). */
  projection?: CalendarProjection;
  /** Marca que este documento está sendo montado para a folha A4/impressão (aplica sobrescritas de logo). */
  printContext?: boolean;
}) {
  const p = projection ?? deriveCalendarProjection(cal);
  const rows = p.grid;
  const legend = p.legend;
  const onClick = (e: MouseEvent<HTMLTableElement>) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>("[data-date]")?.dataset["date"];
    if (d) onSelect?.(d);
  };
  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>("[data-date]")?.dataset["date"];
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!d || !step) return;
    const next = e.currentTarget.querySelector<HTMLElement>(`[data-date="${shiftDays(d, step)}"]`);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <article
      className="cd-folha"
      aria-label={`Calendário Escolar ${cal.year} — ${cal.title}`}
      data-calendar-id={cal.id}
    >
      {cal.document.typography || cal.document.layout ? (
        <style>{layoutCss(cal.id, cal.document)}</style>
      ) : null}
      <div className="cd-cabecalho">
        <div className="cd-brasao">
          {logosOf(cal.document.layout)
            .filter((l) => l.position !== "direita")
            .map((l) => <LogoItem key={l.id} raw={l} printContext={!!printContext} />)}
        </div>
        <div className="cd-titulos">
          {cal.document.headerLines.map((h, i) => (
            <div key={i} className={`cd-linha${Math.min(i + 1, 3)}`}>
              {h}
            </div>
          ))}
          <div className="cd-linha4">
            CALENDÁRIO ESCOLAR {cal.year} – {cal.title}
          </div>
        </div>
        <div className="cd-logo">
          {logosOf(cal.document.layout)
            .filter((l) => l.position === "direita")
            .map((l) => <LogoItem key={l.id} raw={l} printContext={!!printContext} />)}
        </div>
      </div>
      <table
        className="cd-grade"
        onClick={editable ? onClick : undefined}
        onKeyDown={editable ? onKey : undefined}
      >
        <colgroup>
          <col className="cd-col-mes" />
          {Array.from({ length: 31 }, (_, i) => (
            <col key={i} className="cd-col-dia" />
          ))}
          <col className="cd-col-total" />
          <col className="cd-col-total" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="cd-mesdia">Mês/Dia</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th scope="col" key={i}>{i + 1}</th>
            ))}
            <th scope="col" className="cd-total-cab" colSpan={2}>
              Total de
              <br />
              dias letivos
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Row
              key={row.kind === "mes" ? `m-${row.month}-${i}` : `t-${i}`}
              row={row}
              editable={editable}
              selected={selectedDate}
              symbology={cal.symbology}
            />
          ))}
        </tbody>
      </table>
      <div className="cd-rodape">
        <div data-cd-bloco="legenda">
          <h4 className="cd-titulo-bloco">Legenda:</h4>
          {legend.map((code) => {
            const info = typeInfo(dayTypesOf(cal), code);
            return (
              <div key={code} className="cd-legenda-linha">
                <div
                  className={`cd-chip ${noBorder(info.background) ? "cd-chip-sem-borda" : ""}`}
                  style={{ backgroundColor: info.background, color: info.foreground }}
                >
                  <DayMark code={code} text={info.mark} overrides={cal.symbology} where="legenda" />
                </div>
                <div>{info.label}</div>
              </div>
            );
          })}
          {(cal.customLegend ?? []).map((c) => (
            <div key={c.id} className="cd-legenda-linha">
              <div
                className={`cd-chip ${noBorder(c.background) ? "cd-chip-sem-borda" : ""}`}
                style={{ backgroundColor: c.background, color: c.foreground }}
              >
                {c.mark}
              </div>
              <div>{c.label}</div>
            </div>
          ))}
        </div>
        {cal.document.showHolidays ? (
          <div data-cd-bloco="feriados">
            <h4 className="cd-titulo-bloco">FERIADOS</h4>
            {p.holidays.map((h) => (
              <div key={h.date + h.name} className="cd-feriado-linha">
                <div>{shortDate(h.date)}</div>
                <div className="cd-feriado-nome">{h.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <div />
        )}
        <Periods cal={cal} p={p} />
      </div>
      <div className="cd-assinaturas">
        {cal.signatures.map((s) => (
          <div key={s} className="cd-assinatura">
            <div className="cd-assinatura-espaco" />
            <div className="cd-assinatura-rotulo">{s}</div>
          </div>
        ))}
      </div>
      {notice}
    </article>
  );
}

/** Ajusta o documento (1058px) à largura disponível sem alterar sua composição. */
export function DocumentFrame({ children, baseWidth = 1060 }: { children: ReactNode; baseWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / baseWidth));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);
  return (
    <div ref={ref} className="min-w-0 w-full">
      <div className="cd-fit" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}
