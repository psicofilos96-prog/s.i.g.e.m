/**
 * CAL.EXT.1 — Folhas dos modelos externos (Panorâmico e Mosaico). Consomem SÓ `ExternalViewModel`
 * (derivado de `PrintModel`). Não tocam no renderer interno. CSS isolado em escopo `.cx-*`.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dayTypesOf, typeInfo } from "./calendar-catalog";
import type { PrintDay } from "./institutional-calendar-presentation";
import { LogoItem } from "./calendar-document";
import { QrCode } from "./calendar-external-qr";
import {
  countText, institutionalIdentity, shortDate, WEEK_HEAD, type ExternalLogo, type ExternalProfile, type ExternalTemplateCode, type ExternalViewModel,
} from "./calendar-external-model";

type Types = ReturnType<typeof dayTypesOf>;
const EFFECT_TEXT: Record<PrintDay["effect"], string> = {
  letivo: "letivo", "nao-letivo": "não letivo", "sem-declaracao": "sem declaração",
  "efeito-nao-declarado": "efeito não declarado", conflito: "conflito", indeterminado: "indeterminado",
};

function cellVisual(d: PrintDay, types: Types, p: ExternalProfile) {
  if (!d.symbolCode) return null;
  const known = Object.prototype.hasOwnProperty.call(types, d.symbolCode);
  const t = typeInfo(types, d.symbolCode as never);
  const o = p.symbolOverrides[d.symbolCode] ?? {};
  return { mark: known ? t.mark : d.symbolCode, label: t.label, bg: o.background ?? t.background, fg: o.foreground ?? t.foreground, known };
}

function DayCell({ d, n, types, p, weekend }: { d: PrintDay | undefined; n: number; types: Types; p: ExternalProfile; weekend: boolean }) {
  if (!d) return <td className="cx-dia cx-nao-lido" title={`Dia ${n}: não lido`}><span>{n}</span></td>;
  const v = cellVisual(d, types, p);
  const unsure = d.effect !== "letivo" && d.effect !== "nao-letivo" && d.effect !== "sem-declaracao";
  const extras = d.extraCodes.map((c) => ({ c, t: typeInfo(types, c as never) }));
  const tip = `${shortDate(d.on)} — ${d.label ?? d.typeLabel ?? v?.label ?? "sem declaração"} (${EFFECT_TEXT[d.effect]})${extras.length ? ` + ${extras.map((e) => e.t.label).join(", ")}` : ""}`;
  const style: CSSProperties | undefined = v ? { backgroundColor: v.bg, color: v.fg } : undefined;
  return (
    <td className={`cx-dia cx-efeito-${d.effect}${weekend ? " cx-fds" : ""}${v ? " cx-marcado" : ""}`} data-date={d.on} data-effect={d.effect} title={tip} aria-label={tip} style={style}>
      <span className="cx-num">{n}</span>
      {v && v.mark && <span className="cx-sigla">{v.mark}</span>}
      {(unsure || (v && !v.known)) && <span className="cx-alerta" aria-hidden>!</span>}
      {d.markMismatch && <span className="cx-alerta" aria-hidden>≠</span>}
      {extras.length > 0 && (
        <span className="cx-extras" aria-hidden>
          {extras.map((e) => <i key={e.c} style={{ backgroundColor: p.symbolOverrides[e.c]?.background ?? e.t.background }} />)}
        </span>
      )}
    </td>
  );
}

function themeVars(p: ExternalProfile): CSSProperties {
  return {
    ["--cx-primary" as never]: p.primary, ["--cx-secondary" as never]: p.secondary, ["--cx-header" as never]: p.headerColor,
    ["--cx-border" as never]: p.borderColor, ["--cx-card" as never]: p.cardColor, ["--cx-page" as never]: p.pageColor,
    ["--cx-title-font" as never]: p.titleFont, ["--cx-body-font" as never]: p.bodyFont,
    ["--cx-radius" as never]: `${p.cardRadius}mm`, ["--cx-shadow" as never]: String(p.cardShadow),
    ["--cx-bw" as never]: `${p.borderWidth}mm`, ["--cx-density" as never]: String(p.density),
    ["--cx-overlay" as never]: String(p.coverOverlay / 100),
  };
}

/** Logo do externo: imagem própria ou logo herdada do snapshot (mesmo `LogoItem` do interno; tamanho do externo). */
function ExtLogo({ l, inherited }: { l: ExternalLogo; inherited: ReturnType<typeof institutionalIdentity>["logos"] }) {
  if (l.src) return <img src={l.src} alt={l.alt} style={{ height: `${l.heightMm}mm` }} />;
  const base = inherited.find((x) => x.id === l.ref);
  if (!base || base.source.kind === "none") return null;
  return <span className="cx-logo-herdada" data-logo-ref={base.id} style={{ height: `${l.heightMm}mm` }}>
    <LogoItem raw={{ ...base, visible: true, unit: "mm", height: l.heightMm, width: undefined }} printContext /></span>;
}

function Cover({ vm, p, presentationTitle, presentation }: { vm: ExternalViewModel; p: ExternalProfile; presentationTitle: string; presentation: Record<string, unknown> }) {
  const logos = p.logos.filter((l) => !l.hidden);
  const id = institutionalIdentity(presentation);
  return (
    <header className="cx-capa" style={p.coverImage ? { backgroundImage: `url(${p.coverImage})`, backgroundPosition: `center ${p.coverFocusY}%` } : undefined}
      data-cover={p.coverImage ? "personalizada" : "padrao"}>
      <div className="cx-capa-veu" aria-hidden />
      {!p.coverImage && <svg className="cx-ondas" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden><path d="M0 70 Q300 10 600 60 T1200 50 V120 H0Z" /><path d="M0 95 Q300 50 600 90 T1200 80 V120 H0Z" /></svg>}
      <div className="cx-capa-conteudo">
        <div className="cx-logos">{logos.filter((l) => l.position === "esquerda").map((l) => <ExtLogo key={l.id} l={l} inherited={id.logos} />)}</div>
        <div className="cx-titulo-bloco">
          {p.show.cabecalho && id.headerLines.length > 0 && <div className="cx-cabecalho-inst" data-cx-bloco="cabecalho">{id.headerLines.map((h, i) => <p key={i}>{h}</p>)}</div>}
          <h1 className="cx-titulo">{p.visualTitle ?? `CALENDÁRIO ESCOLAR ${vm.year ?? ""}`}</h1>
          <p className="cx-subtitulo">{p.subtitle ?? presentationTitle}</p>
        </div>
        <div className="cx-logos cx-direita">
          {p.slogan && <p className="cx-slogan">{p.slogan}</p>}
          {logos.filter((l) => l.position === "direita").map((l) => <ExtLogo key={l.id} l={l} inherited={id.logos} />)}
        </div>
      </div>
    </header>
  );
}

function Legend({ vm, types, p }: { vm: ExternalViewModel; types: Types; p: ExternalProfile }) {
  return (
    <section className="cx-bloco" data-cx-bloco="legenda"><h2>Legenda</h2>
      <ul className="cx-legenda">
        {vm.legendCodes.map((c) => { const t = typeInfo(types, c as never); const o = p.symbolOverrides[c] ?? {};
          return <li key={c}><span className="cx-chip" style={{ backgroundColor: o.background ?? t.background, color: o.foreground ?? t.foreground }}>{t.mark}</span>{t.label}</li>; })}
        {vm.unmappedTypes.map((u) => <li key={`u-${u}`} data-testid="cx-unmapped"><span className="cx-chip cx-chip-sem">?</span>Tipo sem mapeamento visual: {u}</li>)}
        <li><span className="cx-chip cx-chip-sem">!</span>Efeito indeterminado / conflito / não declarado</li>
      </ul>
    </section>
  );
}
const Holidays = ({ vm }: { vm: ExternalViewModel }) => (
  <section className="cx-bloco" data-cx-bloco="feriados"><h2>Feriados</h2>
    {vm.holidays.length ? <ul className="cx-lista">{vm.holidays.map((h) => <li key={h.on + h.name}><b>{shortDate(h.on)}</b> {h.name}</li>)}</ul> : <p className="cx-vazio">Nenhum feriado declarado.</p>}
  </section>
);
const Periods = ({ vm }: { vm: ExternalViewModel }) => (
  <section className="cx-bloco" data-cx-bloco="periodos"><h2>Períodos letivos</h2>
    <ul className="cx-lista">{vm.periods.map((pp) => <li key={pp.name}><b>{pp.name}</b> {shortDate(pp.startsOn)} a {shortDate(pp.endsOn)} = <span title={pp.reason ?? ""}>{countText(pp)}</span>{pp.schoolDays !== null ? " dias" : ""}</li>)}</ul>
    <p className="cx-total-anual">Total de dias letivos: <b data-testid="cx-total-anual" title={vm.total.reason ?? ""}>{countText(vm.total)}</b></p>
  </section>
);
const COUNCIL_TEXT: Record<Exclude<ExternalViewModel["councils"]["state"], "configurada">, string> = {
  "nao-lida": "Configuração de Conselhos de Classe não lida.",
  "acesso-negado": "Configuração de Conselhos de Classe indisponível para sua atuação.",
  malformada: "Configuração de Conselhos de Classe ilegível (resposta malformada).",
  "nao-configurada": "Conselhos de Classe não configurados para esta versão.",
  "nenhum-declarado": "Esta versão declara nenhum Conselho de Classe.",
};
const Councils = ({ vm }: { vm: ExternalViewModel }) => {
  const c = vm.councils;
  return (
    <section className="cx-bloco" data-cx-bloco="conselhos" data-council-state={c.state}><h2>Conselhos de classe</h2>
      {c.state === "configurada"
        ? c.items.length ? <ul className="cx-lista">{c.items.map((i) => <li key={i.on + i.role}><b>{shortDate(i.on)}</b> {i.name}</li>)}</ul>
          : <p className="cx-vazio">Tipos de conselho configurados, sem datas declaradas nesta versão.</p>
        : <p className="cx-vazio">{COUNCIL_TEXT[c.state]}</p>}
    </section>);
};
const Signatures = ({ vm }: { vm: ExternalViewModel }) => vm.signatures.length ? (
  <div className="cx-assinaturas" data-cx-bloco="assinaturas">{vm.signatures.map((s, i) => <div key={i}><span /><p>{s}</p></div>)}</div>) : null;
const Branding = ({ p }: { p: ExternalProfile }) => (
  <footer className="cx-marca" data-cx-bloco="branding" style={p.footerImage ? { backgroundImage: `url(${p.footerImage})` } : undefined}>
    <span>{p.footerText ?? "SIGEM"}</span>
    {p.qrUrl && <span className="cx-qr"><QrCode value={p.qrUrl} sizeMm={16} /><span className="cx-qr-url">{p.qrUrl}</span></span>}
  </footer>
);

function Notices({ vm }: { vm: ExternalViewModel }) {
  if (!vm.mismatches.length) return null;
  return <p className="cx-aviso" role="note">Símbolo divergente do efeito institucional em {vm.mismatches.map(shortDate).join(", ")} (vale o efeito).</p>;
}

/** Panorâmico: 12 mini-calendários 4×3 + rodapé (legenda, períodos, feriados, conselhos, assinaturas) na MESMA folha. */
export function PanoramicSheet({ vm, p, presentation }: { vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown> }) {
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  return (
    <article className="cx-folha cx-panoramico" style={themeVars(p)} data-testid="external-sheet-externo-panoramico" aria-label={`Calendário ${vm.year ?? ""} — modelo panorâmico`}>
      <Cover vm={vm} p={p} presentationTitle={vm.title ?? "título não declarado"} presentation={presentation} />
      <Notices vm={vm} />
      <div className="cx-corpo cx-meses">
        {vm.months.map((m) => (
          <section key={m.key} className="cx-cartao" data-month={m.key} data-first-weekday={m.firstWeekday}>
            <h2>{m.name}{p.show.totaisMensais && <small data-testid={`cx-total-${m.key}`} title={m.total.reason ?? ""}>{countText(m.total)}</small>}</h2>
            <table>
              <thead><tr>{WEEK_HEAD.map((w, i) => <th key={i} scope="col">{w}</th>)}</tr></thead>
              <tbody>{m.weeks.map((w, wi) => (
                <tr key={wi}>{w.map((n, i) => n === null ? <td key={i} className="cx-dia cx-vazio" aria-hidden />
                  : <DayCell key={i} d={m.byDay.get(n)} n={n} types={types} p={p} weekend={i === 0 || i === 6} />)}</tr>))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <div className="cx-rodape">
        {p.show.legenda && <Legend vm={vm} types={types} p={p} />}
        {p.show.periodos && <Periods vm={vm} />}
        {p.show.feriados && <Holidays vm={vm} />}
        {p.show.conselhos && <Councils vm={vm} />}
      </div>
      {p.show.assinaturas && <Signatures vm={vm} />}
      {p.show.branding && <Branding p={p} />}
    </article>
  );
}

/** Mosaico: matriz Mês × Dia 1–31 + lateral (legenda, feriados) + rodapé (períodos, conselhos, assinaturas). */
export function MosaicSheet({ vm, p, presentation }: { vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown> }) {
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  const cols = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <article className="cx-folha cx-mosaico" style={themeVars(p)} data-testid="external-sheet-externo-mosaico" aria-label={`Calendário ${vm.year ?? ""} — modelo mosaico`}>
      <Cover vm={vm} p={p} presentationTitle={vm.title ?? "título não declarado"} presentation={presentation} />
      <Notices vm={vm} />
      <div className="cx-corpo">
        <table className="cx-matriz">
          <thead><tr><th scope="col">Mês</th>{cols.map((c) => <th key={c} scope="col">{c}</th>)}{p.show.totaisMensais && <th scope="col">Letivos</th>}</tr></thead>
          <tbody>
            {vm.months.map((m) => (
              <tr key={m.key} data-month={m.key}>
                <th scope="row">{m.name}</th>
                {cols.map((n) => n > m.daysInMonth ? <td key={n} className="cx-dia cx-inexistente" aria-hidden />
                  : <DayCell key={n} d={m.byDay.get(n)} n={n} types={types} p={p} weekend={[0, 6].includes((m.firstWeekday + n - 1) % 7)} />)}
                {p.show.totaisMensais && <td className="cx-total" data-testid={`cx-total-${m.key}`} title={m.total.reason ?? ""}>{countText(m.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <aside className="cx-lateral">
          {p.show.legenda && <Legend vm={vm} types={types} p={p} />}
          {p.show.feriados && <Holidays vm={vm} />}
        </aside>
      </div>
      <div className="cx-rodape">
        {p.show.periodos && <Periods vm={vm} />}
        {p.show.conselhos && <Councils vm={vm} />}
        {p.show.assinaturas && <Signatures vm={vm} />}
      </div>
      {p.show.branding && <Branding p={p} />}
    </article>
  );
}

export function ExternalSheet(props: { template: ExternalTemplateCode; vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown> }) {
  return props.template === "externo-mosaico" ? <MosaicSheet {...props} /> : <PanoramicSheet {...props} />;
}

/** Portal de impressão do externo: mesma raiz `.cd-print-root` (a regra de impressão já existente), folha própria `.cx-a4`. */
export function ExternalCalendarPrint({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // `cx-print-ativo`: quando o externo está escolhido, é a ÚNICA folha impressa (outras raízes da tela são ocultadas).
  return createPortal(<div className="cd-print-root cx-print-ativo" aria-hidden><div className="cx-a4">{children}</div></div>, document.body);
}
