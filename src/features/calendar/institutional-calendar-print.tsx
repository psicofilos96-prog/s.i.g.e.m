/**
 * B4.6.7c/F4 — Folha institucional do calendário. Aparência = snapshot salvo da versão (documento/layout geral,
 * blocos e impressão via `layoutCss`/`printLayout`, logos, cabeçalho, simbologia + simbologia de impressão,
 * legenda, observações, assinaturas). Dias/efeitos = SÓ declarações institucionais (`buildPrintModel`).
 * Não chama `deriveCalendarProjection`/`resolveCalendar`: o motor do laboratório não é norma.
 * Total indeterminado é impresso como texto, nunca como número 0.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DayMark } from "./calendar-mark";
import { LogoItem, observationLines } from "./calendar-document";
import { InfoLinesAt } from "./calendar-info-lines";
import { logosOf } from "./calendar-logos";
import { layoutCss } from "./calendar-layout";
import { dayTypesOf, typeInfo, weekendLetter } from "./calendar-catalog";
import type { PrintCount, PrintModel } from "./institutional-calendar-presentation";
import type { NetworkCalendar } from "./calendar-types";
import { MONTH_NAMES } from "@/lib/format-ptbr";

const MONTHS = MONTH_NAMES;
const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const Count = ({ c }: { c: PrintCount }) =>
  c.schoolDays === null ? <span className="cd-indeterminado" title={c.reason ?? ""}>indeterminado</span> : <>{c.schoolDays}</>;

export function InstitutionalPrintSheet({ model, presentation, versionId = "institucional" }: {
  model: PrintModel; presentation: Record<string, unknown>; versionId?: string;
}) {
  const doc = (isObj(presentation["document"]) ? presentation["document"] : {}) as unknown as NetworkCalendar["document"];
  const overrides = (presentation["symbology"] ?? undefined) as never;
  const printOverrides = (presentation["symbologyPrint"] ?? undefined) as never;
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  const headerLines = Array.isArray(doc.headerLines) ? doc.headerLines.filter((h): h is string => typeof h === "string") : [];
  const year = typeof presentation["year"] === "number" ? presentation["year"] : null;
  const customLegend = Array.isArray(presentation["customLegend"]) ? (presentation["customLegend"] as { id: string; mark: string; label: string; background: string; foreground: string }[]) : [];
  const info = observationLines(typeof presentation["observations"] === "string" ? presentation["observations"] : undefined);
  const logos = logosOf(doc.layout);
  return (
    <article className="cd-folha" data-calendar-id={versionId} data-testid="institutional-print-sheet"
      aria-label={`Calendário Escolar ${year ?? ""} — ${model.title ?? "título não declarado"}`}>
      {doc.typography || doc.layout ? <style>{layoutCss(versionId, doc)}</style> : null}
      <div className="cd-cabecalho">
        <div className="cd-brasao">{logos.filter((l) => l.position !== "direita").map((l) => <LogoItem key={l.id} raw={l} printContext />)}</div>
        <div className="cd-titulos">
          {headerLines.map((h, i) => <div key={i} className={`cd-linha${Math.min(i + 1, 3)}`}>{h}</div>)}
          <div className="cd-linha4">CALENDÁRIO ESCOLAR {year ?? ""} – {model.title ?? "Calendário (título não declarado)"}</div>
        </div>
        <div className="cd-logo">{logos.filter((l) => l.position === "direita").map((l) => <LogoItem key={l.id} raw={l} printContext />)}</div>
      </div>
      {model.unmappedTypes.length > 0 && <p role="note">Tipos sem símbolo vinculado na apresentação: {model.unmappedTypes.join(", ")}.</p>}
      {model.mismatches.length > 0 && <p role="note">Símbolo da fonte diverge do efeito institucional em: {model.mismatches.map(short).join(", ")} (vale o efeito institucional).</p>}
      <table className="cd-grade">
        {/* NPRINT.FINAL.2: mesmas colunas da folha do laboratório; sem elas o nome do mês era cortado. */}
        <colgroup><col className="cd-col-mes" />{Array.from({ length: 31 }, (_, i) => <col key={i} className="cd-col-dia" />)}<col className="cd-col-total" /><col className="cd-col-total" /></colgroup>
        <thead><tr><th scope="col" className="cd-mesdia">Mês/Dia</th>{Array.from({ length: 31 }, (_, i) => <th scope="col" key={i}>{i + 1}</th>)}<th scope="col" className="cd-total-cab" colSpan={2}>Total de<br />dias letivos</th></tr></thead>
        <tbody>
          {model.months.map((m) => {
            const byDay = new Map(m.days.map((d) => [Number(d.on.slice(8, 10)), d]));
            return (
              <tr key={m.key}>
                <td className="cd-mes">{MONTHS[Number(m.key.slice(5, 7)) - 1]}</td>
                {Array.from({ length: 31 }, (_, i) => {
                  const d = byDay.get(i + 1);
                  if (!d) return <td key={i} className="cd-dia cd-inexistente" aria-hidden />;
                  const t = d.symbolCode ? typeInfo(types, d.symbolCode as never) : null;
                  const tip = `${short(d.on)} — ${d.label ?? d.typeLabel ?? ""} (${d.effect})`;
                  return (
                    <td key={i} className={`cd-dia cd-efeito-${d.effect}`} data-date={d.on} title={tip}
                      style={t ? { backgroundColor: t.background, color: t.foreground } : undefined}>
                      {t ? <DayMark code={d.symbolCode as never} text={weekendLetter(t.mark, d.on)} overrides={overrides} printOverrides={printOverrides} types={types} extra={d.extraCodes as never} />
                        : <span aria-label={tip}>{d.effect === "sem-declaracao" ? "" : "?"}</span>}
                    </td>
                  );
                })}
                <td className="cd-total" colSpan={2}><Count c={m.total} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="cd-rodape">
        <div data-cd-bloco="legenda">
          <h4 className="cd-titulo-bloco">Legenda:</h4>
          {model.legendCodes.map((code) => {
            const t = typeInfo(types, code as never);
            return (
              <div key={code} className="cd-legenda-linha">
                <div className="cd-chip" style={{ backgroundColor: t.background, color: t.foreground }}>
                  <DayMark code={code as never} text={t.mark} overrides={overrides} where="legenda" types={types} />
                </div>
                <div>{t.label}</div>
              </div>
            );
          })}
          {customLegend.map((c) => (
            <div key={c.id} className="cd-legenda-linha">
              <div className="cd-chip" style={{ backgroundColor: c.background, color: c.foreground }}>{c.mark}</div><div>{c.label}</div>
            </div>
          ))}
        </div>
        {doc.showHolidays ? (
          <div data-cd-bloco="feriados">
            <h4 className="cd-titulo-bloco">FERIADOS</h4>
            {model.holidays.map((h) => <div key={h.on + h.name} className="cd-feriado-linha"><div>{short(h.on)}</div><div className="cd-feriado-nome">{h.name}</div></div>)}
          </div>
        ) : <div />}
        <div className="cd-coluna">
          <InfoLinesAt lines={info} place="antes-periodos" />
          {doc.showPeriods !== false && (
            <div className="cd-periodos" data-cd-bloco="periodos">
              {model.periods.map((p) => (
                <div key={p.name} className="cd-periodo-linha">
                  <span>{p.name}</span><span>—</span><span>{short(p.startsOn)} a {short(p.endsOn)}</span><span>=</span>
                  <span className="cd-periodo-numero"><Count c={p} /></span><span>Dias</span>
                </div>
              ))}
            </div>
          )}
          <InfoLinesAt lines={info} place="depois-periodos" />
          {doc.showAnnualTotal !== false && (
            <div className="cd-periodos cd-total-anual" data-cd-bloco="total">
              <div className="cd-periodo-linha"><span style={{ gridColumn: "1 / 4" }}>Total de dias letivos</span><span>=</span>
                <span className="cd-periodo-numero" data-testid="total-anual"><Count c={model.total} /></span><span>Dias</span></div>
            </div>
          )}
          <InfoLinesAt lines={info} place="depois-total" />
          <InfoLinesAt lines={info} place="depois-conselhos" />
        </div>
      </div>
      <div className="cd-assinaturas">
        {model.signatures.map((s, i) => <div key={i} className="cd-assinatura"><div className="cd-assinatura-espaco" /><div className="cd-assinatura-rotulo">{s}</div></div>)}
      </div>
    </article>
  );
}

export function InstitutionalCalendarPrint(props: { model: PrintModel; presentation: Record<string, unknown>; versionId?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<div className="cd-print-root" aria-hidden><div className="cd-a4"><InstitutionalPrintSheet {...props} /></div></div>, document.body);
}
