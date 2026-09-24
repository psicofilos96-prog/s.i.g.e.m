/**
 * Documento "Calendário Escolar" — reprodução fiel do modelo interno da
 * Supervisão (grade-calendario.tsx da especificação). A tela administrativa
 * ao redor pode seguir o Design System; ESTE componente não é redesenhado.
 */
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import logoEducacao from "@/assets/logo-educacao.png.asset.json";
import { DAY_TYPES } from "./calendar-catalog";
import {
  buildGrid,
  holidaysForDisplay,
  councilDates,
  periodBlocks,
  periodSchoolDays,
  resolveCalendar,
  shiftDays,
  shortDate,
  totalSchoolDays,
  type GridRow,
} from "./calendar-engine";
import type { DayTypeCode, NetworkCalendar, ResolvedCalendar } from "./calendar-types";

const LEGEND_ORDER: DayTypeCode[] = [
  "ENCONTRO",
  "INICIO",
  "FERIADO",
  "FL",
  "RECESSO",
  "CC",
  "CF",
  "CENSO",
  "RETORNO",
  "TERMINO",
];
const NO_BORDER = new Set<DayTypeCode>(["CC", "CF", "CENSO"]);

function Row({
  row,
  editable,
  selected,
}: {
  row: GridRow;
  editable: boolean;
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
                {c.text}
              </button>
            ) : (
              <span aria-label={c.tooltip}>{c.text}</span>
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

function Periods({ cal, r }: { cal: NetworkCalendar; r: ResolvedCalendar }) {
  const blocks = periodBlocks(cal, r);
  const grouped = blocks.some((b) => b.group);
  const councils = councilDates(cal, r).filter(
    (c) => cal.periods.find((p) => p.id === c.periodId)?.councilLabel,
  );
  return (
    <div className="cd-periodos">
      {grouped
        ? blocks.map((b) => (
            <div key={b.group?.id ?? "sem-grupo"}>
              <div className="cd-bloco">
                {b.block} = {b.total} DIAS LETIVOS
              </div>
              {b.periods.map((p) => (
                <PeriodLine
                  key={p.id}
                  name={p.name}
                  start={p.start}
                  end={p.end}
                  days={periodSchoolDays(r, p)}
                />
              ))}
            </div>
          ))
        : blocks
            .flatMap((b) => b.periods)
            .map((p) => (
              <PeriodLine
                key={p.id}
                name={p.name}
                start={p.start}
                end={p.end}
                days={periodSchoolDays(r, p)}
              />
            ))}
      <div className="cd-periodo-linha" style={{ marginTop: 10 }}>
        <span style={{ gridColumn: "1 / 4" }}>Total de dias letivos</span>
        <span>=</span>
        <span className="cd-periodo-numero">{totalSchoolDays(r)}</span>
        <span>Dias</span>
      </div>
      {councils.length > 0 || cal.observations ? (
        <div className="cd-conselhos">
          {councils.map((c) => (
            <div key={c.periodId} className="cd-conselho-linha">
              <b>{shortDate(c.date)}</b>
              <span>—</span>
              <span>{c.label}</span>
            </div>
          ))}
          {cal.observations ? (
            <div className="cd-conselho-linha">
              <span style={{ gridColumn: "1 / -1" }}>{cal.observations}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CalendarDocument({
  cal,
  editable = false,
  selectedDate,
  onSelect,
  notice,
}: {
  cal: NetworkCalendar;
  editable?: boolean;
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
  /** Aviso de estado (ex.: não homologado) — fora da composição oficial. */
  notice?: ReactNode;
}) {
  const r = resolveCalendar(cal);
  const rows = buildGrid(cal, r);
  const legend = LEGEND_ORDER.filter((c) => !cal.legendHidden.includes(c));
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
      <div className="cd-cabecalho">
        <div className="cd-brasao">
          <img src={brasao.url} alt="Brasão do Município de Itaperuna" />
        </div>
        <div className="cd-titulos">
          <div className="cd-linha1">PREFEITURA MUNICIPAL DE ITAPERUNA</div>
          <div className="cd-linha2">SECRETARIA MUNICIPAL DE EDUCAÇÃO</div>
          <div className="cd-linha3">SUPERVISÃO DE ENSINO</div>
          <div className="cd-linha4">
            CALENDÁRIO ESCOLAR {cal.year} – {cal.title}
          </div>
        </div>
        <div className="cd-logo">
          <img src={logoEducacao.url} alt="Prefeitura de Itaperuna — Educação" />
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
            <th className="cd-mesdia">Mês/Dia</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i}>{i + 1}</th>
            ))}
            <th className="cd-total-cab" colSpan={2}>
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
            />
          ))}
        </tbody>
      </table>
      <div className="cd-rodape">
        <div>
          <h4>Legenda:</h4>
          {legend.map((code) => {
            const info = DAY_TYPES[code];
            return (
              <div key={code} className="cd-legenda-linha">
                <div
                  className={`cd-chip ${NO_BORDER.has(code) ? "cd-chip-sem-borda" : ""}`}
                  style={{ backgroundColor: info.background, color: info.foreground }}
                >
                  {code === "TERMINO" ? "T" : info.mark}
                </div>
                <div>{info.label}</div>
              </div>
            );
          })}
        </div>
        <div>
          <h4>FERIADOS</h4>
          {holidaysForDisplay(cal).map((h) => (
            <div key={h.date + h.name} className="cd-feriado-linha">
              <div>{shortDate(h.date)}</div>
              <div className="cd-feriado-nome">{h.name}</div>
            </div>
          ))}
        </div>
        <Periods cal={cal} r={r} />
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
export function DocumentFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / 1060));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="min-w-0 w-full">
      <div className="cd-fit" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}
