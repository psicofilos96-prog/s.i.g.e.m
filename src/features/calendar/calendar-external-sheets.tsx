/**
 * CAL.EXT.1 / N2 — Folhas dos modelos externos (Panorâmico e Mosaico), desenhadas conforme os dois prompts-guia
 * do usuário. Consomem SÓ `ExternalViewModel` (derivado de `PrintModel`) e o perfil visual; não tocam no renderer
 * interno. CSS isolado em escopo `.cx-*`; medidas em mm/frações da folha para a prévia ser igual ao PDF.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dayTypesOf, typeInfo } from "./calendar-catalog";
import type { PrintDay } from "./institutional-calendar-presentation";
import { LogoItem } from "./calendar-document";
import { QrCode } from "./calendar-external-qr";
import homeImage from "@/assets/itaperuna-home.png.asset.json";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";
import {
  columnTotals, countText, periodColumns, externalLegendCodes, institutionalIdentity, shortDate, WEEK_HEAD,
  type ExternalLogo, type ExternalMonth, type ExternalPillar, type ExternalProfile, type ExternalTemplateCode, type ExternalViewModel,
} from "./calendar-external-model";

type Types = ReturnType<typeof dayTypesOf>;
const EFFECT_TEXT: Record<PrintDay["effect"], string> = {
  letivo: "letivo", "nao-letivo": "não letivo", "sem-declaracao": "sem declaração",
  "efeito-nao-declarado": "efeito não declarado", conflito: "conflito", indeterminado: "indeterminado",
};
const isWhite = (c: string | undefined) => !c || /^#?f{6}$/i.test(c.replace("#", ""));

function visualOf(code: string, types: Types, p: ExternalProfile) {
  const known = Object.prototype.hasOwnProperty.call(types, code);
  const t = typeInfo(types, code as never);
  const o = p.symbolOverrides[code] ?? {};
  return { mark: known ? t.mark : code, label: t.label, bg: o.background ?? t.background, fg: o.foreground ?? t.foreground, known, kind: known ? t.kind : null };
}

type CellMode = "numero" | "sigla";
type Band = { role: "ini" | "meio" | "fim" | "unico"; len: number; text: string } | null;

function DayCell({ d, n, types, p, weekend, mode, band }: { d: PrintDay | undefined; n: number; types: Types; p: ExternalProfile; weekend: boolean; mode: CellMode; band?: Band }) {
  if (!d) return <td className="cx-dia cx-nao-lido" title={`Dia ${n}: não lido`}><span className="cx-num">{mode === "numero" ? n : ""}</span></td>;
  const v = d.symbolCode ? visualOf(d.symbolCode, types, p) : null;
  const unsure = d.effect !== "letivo" && d.effect !== "nao-letivo" && d.effect !== "sem-declaracao";
  const extras = d.extraCodes.map((c) => ({ c, t: typeInfo(types, c as never) }));
  const tip = `${shortDate(d.on)} — ${d.label ?? d.typeLabel ?? v?.label ?? "sem declaração"} (${EFFECT_TEXT[d.effect]})${extras.length ? ` + ${extras.map((e) => e.t.label).join(", ")}` : ""}`;
  const painted = v && !(isWhite(v.bg) && !v.mark);
  const style: CSSProperties | undefined = v ? { backgroundColor: v.bg, color: v.fg } : undefined;
  const cls = ["cx-dia", `cx-efeito-${d.effect}`, weekend ? "cx-fds" : "", painted ? "cx-marcado" : "", band ? `cx-faixa cx-faixa-${band.role}` : ""].filter(Boolean).join(" ");
  return (
    <td className={cls} data-date={d.on} data-effect={d.effect} title={tip} aria-label={tip} style={style}>
      {mode === "numero" ? <span className="cx-num">{n}</span> : !band && v && v.mark ? <span className={`cx-sigla${v.mark.length > 3 ? " cx-sigla-longa" : ""}`}>{v.mark}</span> : null}
      {band && (band.role === "ini" || band.role === "unico") && <span className="cx-faixa-txt" style={{ width: `${band.len * 100}%` }}>{band.text}</span>}
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

function themeVars(p: ExternalProfile, t: ExternalTemplateCode): CSSProperties {
  const v: Record<string, string> = {
    "--cx-primary": p.primary, "--cx-secondary": p.secondary, "--cx-header": p.headerColor, "--cx-accent": p.accent,
    "--cx-border": p.borderColor, "--cx-card": p.cardColor, "--cx-page": p.pageColor, "--cx-light": p.lightColor,
    "--cx-holiday": p.holidayColor, "--cx-text": p.textColor,
    "--cx-title-font": p.titleFont, "--cx-body-font": p.bodyFont, "--cx-script-font": p.scriptFont,
    "--cx-title-pt": `${p.titlePt}pt`, "--cx-subtitle-pt": `${p.subtitlePt}pt`, "--cx-k": String(p.textScale * p.density),
    "--cx-radius": `${p.cardRadius}mm`, "--cx-shadow": String(p.cardShadow), "--cx-bw": `${p.borderWidth}mm`, "--cx-density": String(p.density),
    "--cx-overlay": String(p.coverOverlay / 100), "--cx-gap": `${p.gapMm}mm`,
    "--cx-h-banner": `${p.bands.banner}fr`, "--cx-h-body": `${p.bands.body}fr`, "--cx-h-info": `${p.bands.info}fr`,
    "--cx-h-footer": `${p.show.branding ? p.bands.footer : 0}fr`,
  };
  const style = v as CSSProperties;
  if (t === "externo-mosaico" && p.pageImage) Object.assign(style, { backgroundImage: `url(${p.pageImage})`, backgroundSize: "cover" });
  return style;
}

/** Logo do externo: imagem própria ou logo herdada do snapshot (mesmo `LogoItem` do interno; tamanho do externo). */
function ExtLogo({ l, inherited }: { l: ExternalLogo; inherited: ReturnType<typeof institutionalIdentity>["logos"] }) {
  if (l.src) return <img src={l.src} alt={l.alt} style={{ height: `${l.heightMm}mm` }} />;
  const base = inherited.find((x) => x.id === l.ref);
  if (!base || base.source.kind === "none") return null;
  return <span className="cx-logo-herdada" data-logo-ref={base.id} style={{ height: `${l.heightMm}mm` }}>
    <LogoItem raw={{ ...base, visible: true, unit: "mm", height: l.heightMm, width: undefined }} printContext /></span>;
}

/** Linha institucional: "… DE ITAPERUNA" → prefixo pequeno + nome grande; demais linhas: última palavra em negrito. */
function IdentLine({ text, first }: { text: string; first: boolean }) {
  const m = /^(.*\bDE)\s+(.+)$/i.exec(text);
  if (first && m) return <><span className="cx-id-pre">{m[1]}</span><span className="cx-id-nome">{m[2]}</span></>;
  const i = text.lastIndexOf(" ");
  if (i < 0) return <span className="cx-id-pre"><b>{text}</b></span>;
  return <span className="cx-id-pre">{text.slice(0, i)} <b>{text.slice(i + 1)}</b></span>;
}

function Banner({ vm, p, presentation, template }: { vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown>; template: ExternalTemplateCode }) {
  const logos = p.logos.filter((l) => !l.hidden);
  const id = institutionalIdentity(presentation);
  const cover = p.coverImage ?? (p.show.imagemTopo ? homeImage.url : null);
  const title = p.visualTitle ?? "CALENDÁRIO ESCOLAR";
  const year = vm.year !== null && !title.includes(String(vm.year)) ? String(vm.year) : null;
  const left = logos.filter((l) => l.position === "esquerda");
  const right = logos.filter((l) => l.position === "direita");
  return (
    <header className="cx-banner" data-cover={p.coverImage ? "personalizada" : cover ? "institucional" : "nenhuma"}>
      {cover && <img className="cx-banner-img" src={cover} alt="" aria-hidden
        data-fit-mode={p.coverFit}
        style={{ objectFit: p.coverFit === "conter" ? "contain" : "cover", objectPosition: `${p.coverFocusX}% ${p.coverFocusY}%`, transform: `scale(${p.coverFit === "cobrir" ? 1 : p.coverZoom / 100})`, transformOrigin: `${p.coverFocusX}% ${p.coverFocusY}%`, opacity: p.coverOpacity / 100 }} />}
      <div className="cx-banner-veu" aria-hidden />
      <div className="cx-banner-conteudo">
        {(left.length > 0 || (p.show.cabecalho && id.headerLines.length > 0)) && (
          <div className="cx-ident" data-cx-bloco="cabecalho">
            <div className="cx-logos">{left.map((l) => <ExtLogo key={l.id} l={l} inherited={id.logos} />)}</div>
            {p.show.cabecalho && id.headerLines.length > 0 && <div className="cx-ident-txt">{id.headerLines.map((h, i) => <IdentLine key={i} text={h} first={i === 0} />)}</div>}
          </div>)}
        <div className="cx-titulo-bloco">
          <h1 className="cx-titulo">{title}{year && <span className="cx-ano"> {year}</span>}</h1>
          <p className="cx-subtitulo" data-fit>{p.subtitle ?? (vm.title ?? "título não declarado").toUpperCase()}</p>
        </div>
        <div className="cx-banner-dir">
          {right.length > 0 && <div className="cx-logos">{right.map((l) => <ExtLogo key={l.id} l={l} inherited={id.logos} />)}</div>}
          {template === "externo-panoramico" && p.show.slogan && p.slogan && (
            <p className="cx-slogan">{p.slogan}<svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden><path d="M2 9 C 50 2, 120 14, 198 5" /><path d="M10 12 C 70 7, 130 13, 190 9" /></svg></p>)}
        </div>
      </div>
    </header>
  );
}

function Box({ title, bloco, children, className = "", fit = true }: { title: string; bloco: string; children: ReactNode; className?: string; fit?: boolean }) {
  return <section className={`cx-caixa ${className}`} data-cx-bloco={bloco}><h2>{title}</h2><div className="cx-caixa-corpo" data-fit={fit ? "" : undefined}>{children}</div></section>;
}

function Legend({ vm, types, p, vertical }: { vm: ExternalViewModel; types: Types; p: ExternalProfile; vertical?: boolean }) {
  const codes = externalLegendCodes(vm, (c) => visualOf(c, types, p));
  const anyUnsure = vm.days.some((d) => d.effect !== "letivo" && d.effect !== "nao-letivo" && d.effect !== "sem-declaracao");
  return (
    <Box title="Legenda" bloco="legenda">
      <ul className={`cx-legenda${vertical ? " cx-uma-coluna" : ""}`}>
        {codes.map((c) => { const v = visualOf(c, types, p);
          return <li key={c}><span className="cx-chip" style={{ backgroundColor: v.bg, color: v.fg }}>{vertical ? v.mark : ""}</span><span>{v.label}</span></li>; })}
        {vm.unmappedTypes.map((u) => <li key={`u-${u}`} data-testid="cx-unmapped"><span className="cx-chip cx-chip-sem">?</span><span>Tipo sem mapeamento visual: {u}</span></li>)}
        {anyUnsure && <li><span className="cx-chip cx-chip-sem">!</span><span>Efeito indeterminado / conflito / não declarado</span></li>}
      </ul>
    </Box>
  );
}
const Holidays = ({ vm, cols }: { vm: ExternalViewModel; cols: 1 | 2 }) => (
  <Box title="Feriados nacionais e municipais" bloco="feriados">
    {vm.holidays.length ? <ul className={`cx-feriados${cols === 2 ? " cx-duas" : ""}`}>{vm.holidays.map((h) => <li key={h.on + h.name}><b>{shortDate(h.on)}</b><span>{h.name}</span></li>)}</ul>
      : <p className="cx-vazio">Nenhum feriado declarado.</p>}
  </Box>
);
function Periods({ vm, p, cards }: { vm: ExternalViewModel; p: ExternalProfile; cards?: boolean }) {
  const c = p.periods; const cols = periodColumns(vm.periods.length, c);
  const cls = ["cx-periodos", cards ? "cx-cartoes" : "", `cx-per-${c.density}`, c.align === "esquerda" ? "cx-per-esq" : "", c.wrap ? "cx-per-quebra" : "",
    cols < vm.periods.length ? "cx-per-grade" : ""].filter(Boolean).join(" ");
  return (
    <Box title="Períodos letivos" bloco="periodos" className="cx-caixa-periodos" fit={c.autoScale}>
      <div className={cls} data-cols={cols} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...(c.minHmm ? { gridAutoRows: `minmax(${c.minHmm}mm, auto)` } : {}) }}>
        {vm.periods.map((pp) => (
          <div key={pp.name} className="cx-periodo">
            <p className="cx-per-nome">{pp.name}</p>
            <p className="cx-per-datas">{shortDate(pp.startsOn)} a {shortDate(pp.endsOn)}</p>
            <p className="cx-per-num" title={pp.reason ?? ""}>{countText(pp)}</p>
            <p className="cx-per-rot">{pp.schoolDays !== null ? "dias letivos" : ""}</p>
          </div>))}
      </div>
      <p className="cx-total-anual">Total anual: <b data-testid="cx-total-anual" title={vm.total.reason ?? ""}>{countText(vm.total)}</b>{vm.total.schoolDays !== null ? " dias letivos" : ""}</p>
    </Box>
  );
}
const COUNCIL_TEXT: Record<Exclude<ExternalViewModel["councils"]["state"], "configurada">, string> = {
  "nao-lida": "Configuração de Conselhos de Classe não lida.",
  "acesso-negado": "Configuração de Conselhos de Classe indisponível para sua atuação.",
  malformada: "Configuração de Conselhos de Classe ilegível (resposta malformada).",
  "nao-configurada": "Conselhos de Classe não configurados para esta versão.",
  "nenhum-declarado": "Esta versão declara nenhum Conselho de Classe.",
};
function Councils({ vm }: { vm: ExternalViewModel }) {
  const c = vm.councils;
  return (
    <section className="cx-caixa" data-cx-bloco="conselhos" data-council-state={c.state}><h2>Conselhos de classe</h2>
      <div className="cx-caixa-corpo" data-fit>
        {c.state === "configurada"
          ? c.items.length ? <ul className="cx-feriados cx-duas">{c.items.map((i) => <li key={i.on + i.role}><b>{shortDate(i.on)}</b><span>{i.name}</span></li>)}</ul>
            : <p className="cx-vazio">Tipos de conselho configurados, sem datas declaradas nesta versão.</p>
          : <p className="cx-vazio">{COUNCIL_TEXT[c.state]}</p>}
      </div>
    </section>);
}
const Signatures = ({ vm }: { vm: ExternalViewModel }) => vm.signatures.length ? (
  <div className="cx-assinaturas" data-cx-bloco="assinaturas">{vm.signatures.slice(0, 4).map((s, i) => <div key={i}><span /><p>{s}</p></div>)}</div>) : null;

const PILLAR_ICON: Record<ExternalPillar["icon"], ReactNode> = {
  estudantes: <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3Zm-6 9.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z" />,
  escolas: <path d="M12 2 3 7v2h18V7l-9-5ZM5 10v8h3v-8H5Zm5.5 0v8h3v-8h-3ZM16 10v8h3v-8h-3ZM3 20v2h18v-2H3Z" />,
  cidade: <path d="M3 21V10l5-3v3l5-3v4h3V4h5v17H3Zm3-3h2v-2H6v2Zm0-4h2v-2H6v2Zm5 4h2v-2h-2v2Zm0-4h2v-2h-2v2Zm6 4h2v-2h-2v2Zm0-4h2v-2h-2v2Zm0-4h2V8h-2v2Z" />,
};
function PanoramicFooter({ p }: { p: ExternalProfile }) {
  const [w, ...rest] = p.footerPhrase.split(" ");
  const pillars = p.pillars.filter((x) => !x.hidden);
  return (
    <footer className="cx-rodape-inst" data-cx-bloco="branding" style={p.footerImage ? { backgroundImage: `url(${p.footerImage})`, backgroundSize: "cover" } : undefined}>
      {p.footerPhrase && <div className="cx-rod-frase">
        <svg viewBox="0 0 24 24" aria-hidden><path d="M12 6.5C10.3 5 7.8 4 5 4H2v14h3c2.8 0 5.3 1 7 2.5 1.7-1.5 4.2-2.5 7-2.5h3V4h-3c-2.8 0-5.3 1-7 2.5Zm-1 11.2A11 11 0 0 0 5 16H4V6h1c2.3 0 4.4.8 6 2.1v9.6Zm9-1.7h-1c-2.2 0-4.3.6-6 1.7V8.1c1.6-1.3 3.7-2.1 6-2.1h1v10Z" /></svg>
        <p><b>{w}</b> {rest.join(" ")}</p></div>}
      {p.show.pilares && pillars.length > 0 && <div className="cx-pilares">{pillars.map((x, i) => (
        <div key={i} className="cx-pilar"><svg viewBox="0 0 24 24" aria-hidden>{PILLAR_ICON[x.icon]}</svg><p><b>{x.title}</b><span>{x.subtitle}</span></p></div>))}</div>}
      <div className="cx-rod-sigem">
        {p.show.qr && p.qrUrl && <span className="cx-qr"><QrCode value={p.qrUrl} sizeMm={13} /><span><span className="cx-qr-txt">{p.qrText}</span><span className="cx-qr-url">{p.qrUrl}</span></span></span>}
        <span className="cx-sigem"><img src={sigemLogo.url} alt="SIGEM" /><span>{p.footerText ?? "Sistema Integrado de Gestão Escolar"}</span></span>
      </div>
    </footer>
  );
}
function MosaicFooter({ p }: { p: ExternalProfile }) {
  const [first, ...rest] = (p.slogan ?? "").split(" ");
  return (
    <footer className="cx-rodape-deco" data-cx-bloco="branding" style={p.footerImage ? { backgroundImage: `url(${p.footerImage})`, backgroundSize: "cover" } : undefined}>
      {p.show.ilustracao && !p.footerImage && (
        <svg className="cx-skyline" viewBox="0 0 600 40" preserveAspectRatio="xMinYMax meet" aria-hidden>
          <path d="M0 39h600M10 39V24h14v15M28 39V16h10v23M42 39V27h18v12M64 39V12h8v27M76 39V22h16v17M96 39V18l8-6 8 6v21M104 12V5M101 8h6M118 39V26h20v13M142 39V20h10v19M156 39c30-30 70-34 110-6 4 3 8 6 10 6M222 14v-8M218 9h8M222 14l-4 6h8l-4-6M280 39V25h14v14M298 39V15h12v24M314 39V28h22v11M340 39V19h9v20M353 39V24h16v15" />
        </svg>)}
      {p.show.slogan && p.slogan && <p className="cx-slogan cx-slogan-rod"><span className="cx-slogan-a">{first}</span> {rest.join(" ")}</p>}
      <div className="cx-rod-sigem">
        {p.show.qr && p.qrUrl && <span className="cx-qr"><QrCode value={p.qrUrl} sizeMm={11} /><span><span className="cx-qr-txt">{p.qrText}</span><span className="cx-qr-url">{p.qrUrl}</span></span></span>}
      </div>
      <svg className="cx-onda" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden><path d="M60 40C110 34 140 10 200 0v40Z" /><path d="M100 40c40-6 70-22 100-30v30Z" /></svg>
    </footer>
  );
}

function Notices({ vm }: { vm: ExternalViewModel }) {
  if (!vm.mismatches.length) return null;
  return <p className="cx-aviso" role="note">Símbolo divergente do efeito institucional em {vm.mismatches.map(shortDate).join(", ")} (vale o efeito).</p>;
}

/**
 * Auto-fit controlado: reduz a fonte dos blocos marcados `data-fit` (passos de 0,25 pt) até caberem ou até o
 * mínimo configurado; nunca reduz abaixo do mínimo nem mexe nos dados. Exportado para a prova de impressão.
 */
export function autoFitSheet(root: HTMLElement, minPt: number) {
  root.querySelectorAll<HTMLElement>("[data-fit]").forEach((el) => {
    el.style.fontSize = "";
    let pt = parseFloat(getComputedStyle(el).fontSize) * 0.75;
    let guard = 0;
    while ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && pt > minPt && guard++ < 40) {
      pt = Math.max(minPt, pt - 0.25); el.style.fontSize = `${pt}pt`;
    }
  });
}
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
function Sheet({ className, p, template, vm, children }: { className: string; p: ExternalProfile; template: ExternalTemplateCode; vm: ExternalViewModel; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useIsoLayout(() => { if (ref.current) autoFitSheet(ref.current, p.minFitPt); });
  return (
    <article ref={ref} className={`cx-folha ${className}`} style={themeVars(p, template)} data-testid={`external-sheet-${template}`}
      aria-label={`Calendário ${vm.year ?? ""} — modelo ${template === "externo-mosaico" ? "mosaico" : "panorâmico"}`}>{children}</article>
  );
}

function MonthCard({ m, types, p }: { m: ExternalMonth; types: Types; p: ExternalProfile }) {
  const weeks = [...m.weeks]; while (weeks.length < 6) weeks.push(Array(7).fill(null));
  return (
    <section className="cx-cartao" data-month={m.key} data-first-weekday={m.firstWeekday}>
      <h2><span className="cx-mes-nome">{m.name}{p.show.totaisMensais && <small className="cx-mes-total"> · <span data-testid={`cx-total-${m.key}`} title={m.total.reason ?? ""}>{countText(m.total)}</span> letivos</small>}</span>
        {p.show.numeroMes && <span className="cx-mes-num">{String(m.index + 1).padStart(2, "0")}</span>}</h2>
      <table>
        <thead><tr>{WEEK_HEAD.map((w, i) => <th key={i} scope="col" className={i === 0 ? "cx-dom" : undefined}>{w}</th>)}</tr></thead>
        <tbody>{weeks.map((w, wi) => (
          <tr key={wi}>{w.map((n, i) => n === null ? <td key={i} className="cx-dia cx-vazio" aria-hidden />
            : <DayCell key={i} d={m.byDay.get(n)} n={n} types={types} p={p} weekend={i === 0 || i === 6} mode="numero" />)}</tr>))}
        </tbody>
      </table>
    </section>
  );
}

/** Panorâmico: banner · 12 cartões 4×3 · faixa (Legenda | Períodos | Feriados) · rodapé institucional. */
export function PanoramicSheet({ vm, p, presentation }: { vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown> }) {
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  const extra = p.show.conselhos || p.show.assinaturas;
  return (
    <Sheet className="cx-panoramico" p={p} template="externo-panoramico" vm={vm}>
      <Banner vm={vm} p={p} presentation={presentation} template="externo-panoramico" />
      <div className="cx-corpo cx-meses">
        <Notices vm={vm} />
        {vm.months.map((m) => <MonthCard key={m.key} m={m} types={types} p={p} />)}
      </div>
      <div className={`cx-info${extra ? " cx-info-extra" : ""}`} style={{ gridTemplateColumns: [p.show.legenda && p.infoWidths.legenda, p.show.periodos && p.infoWidths.periodos,
        p.show.feriados && p.infoWidths.feriados, p.show.conselhos && p.infoWidths.extra, p.show.assinaturas && vm.signatures.length > 0 && p.infoWidths.extra].filter(Boolean).map((w) => `${w}fr`).join(" ") || "1fr" }}>
        {p.show.legenda && <Legend vm={vm} types={types} p={p} />}
        {p.show.periodos && <Periods vm={vm} p={p} />}
        {p.show.feriados && <Holidays vm={vm} cols={2} />}
        {p.show.conselhos && <Councils vm={vm} />}
        {p.show.assinaturas && <Signatures vm={vm} />}
      </div>
      {p.show.branding && <PanoramicFooter p={p} />}
    </Sheet>
  );
}

/** Faixa contínua de férias/recesso: blocos contíguos (≥ 3 dias) do mesmo código cujo tipo é férias ou recesso. */
function bandsOf(m: ExternalMonth, types: Types, p: ExternalProfile): Map<number, Band> {
  const out = new Map<number, Band>();
  let n = 1;
  while (n <= m.daysInMonth) {
    const code = m.byDay.get(n)?.symbolCode ?? null;
    const kind = code ? visualOf(code, types, p).kind : null;
    if (!code || (kind !== "ferias" && kind !== "recesso")) { n++; continue; }
    let e = n; while (e + 1 <= m.daysInMonth && m.byDay.get(e + 1)?.symbolCode === code) e++;
    const len = e - n + 1;
    if (len >= 3) {
      const text = kind === "ferias" ? p.feriasText : visualOf(code, types, p).label.toUpperCase();
      for (let k = n; k <= e; k++) out.set(k, { role: k === n ? "ini" : k === e ? "fim" : "meio", len, text });
    }
    n = e + 1;
  }
  return out;
}

/** Mosaico: banner · matriz Mês × Dia 1–31 + lateral (Legenda, Feriados) · inferior (Períodos, Conselhos, Assinaturas) · rodapé decorativo. */
export function MosaicSheet({ vm, p, presentation }: { vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown> }) {
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  const cols = Array.from({ length: 31 }, (_, i) => i + 1);
  const colTotals = columnTotals(vm.months);
  return (
    <Sheet className="cx-mosaico" p={p} template="externo-mosaico" vm={vm}>
      <Banner vm={vm} p={p} presentation={presentation} template="externo-mosaico" />
      <div className="cx-corpo">
        <div className="cx-matriz-moldura">
          <Notices vm={vm} />
          <table className="cx-matriz">
            <thead><tr><th scope="col" className="cx-col-mes">Mês / Dia</th>{cols.map((c) => <th key={c} scope="col">{c}</th>)}
              {p.show.totaisMensais && <th scope="col" className="cx-col-total">Total de<br />dias<br />letivos</th>}</tr></thead>
            <tbody>
              {vm.months.map((m) => {
                const bands = bandsOf(m, types, p);
                return (
                  <tr key={m.key} data-month={m.key}>
                    <th scope="row">{m.name}</th>
                    {cols.map((n) => n > m.daysInMonth ? <td key={n} className="cx-dia cx-inexistente" aria-hidden />
                      : <DayCell key={n} d={m.byDay.get(n)} n={n} types={types} p={p} weekend={[0, 6].includes((m.firstWeekday + n - 1) % 7)} mode="sigla" band={bands.get(n) ?? null} />)}
                    {p.show.totaisMensais && <td className="cx-total" data-testid={`cx-total-${m.key}`} title={m.total.reason ?? ""}>{countText(m.total)}</td>}
                  </tr>
                );
              })}
            </tbody>
            {p.show.totaisColuna && (
              <tfoot><tr><th scope="row">Total de dias letivos</th>{colTotals.map((t, i) => <td key={i}>{t === null ? "—" : t}</td>)}
                {p.show.totaisMensais && <td className="cx-total cx-total-geral" title={vm.total.reason ?? ""}>{countText(vm.total)}</td>}</tr></tfoot>)}
          </table>
        </div>
        <aside className="cx-lateral">
          {p.show.legenda && <Legend vm={vm} types={types} p={p} vertical />}
          {p.show.feriados && <Holidays vm={vm} cols={1} />}
        </aside>
      </div>
      <div className="cx-info">
        {p.show.periodos && <Periods vm={vm} p={p} cards />}
        {p.show.conselhos && <Councils vm={vm} />}
        {p.show.assinaturas && <Signatures vm={vm} />}
      </div>
      {p.show.branding && <MosaicFooter p={p} />}
    </Sheet>
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
