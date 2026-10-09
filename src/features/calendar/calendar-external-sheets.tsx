/**
 * CAL.EXT.1 / N2 — Folhas dos modelos externos (Panorâmico e Mosaico), desenhadas conforme os dois prompts-guia
 * do usuário. Consomem SÓ `ExternalViewModel` (derivado de `PrintModel`) e o perfil visual; não tocam no renderer
 * interno. CSS isolado em escopo `.cx-*`; medidas em mm/frações da folha para a prévia ser igual ao PDF.
 */
import { INFO_PLACES, InfoLinesAt } from "./calendar-info-lines";
import { observationLines } from "./calendar-document";
import { weekendLetter } from "./calendar-catalog";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { dayTypesOf, typeInfo } from "./calendar-catalog";
import type { PrintDay } from "./institutional-calendar-presentation";
import { LogoItem } from "./calendar-document";
import { QrCode } from "./calendar-external-qr";
import homeImage from "@/assets/itaperuna-home.png.asset.json";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";
import {
  columnTotals, countText, periodColumns, externalLegendCodes, institutionalIdentity, shortDate, WEEK_HEAD,
  type ExternalLogo, type InfoBlock, type ExternalMonth, type ExternalPillar, type ExternalProfile, type ExternalTemplateCode, type ExternalViewModel,
} from "./calendar-external-model";
import { resolveLayerText, wavePath, type Layer } from "./calendar-external-layers";
import { SHEET_H, SHEET_W, adjustedBg, type BlockBox, type FreeBlockId, type Sticker } from "./calendar-external-free";

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
      {mode === "numero" ? <span className="cx-num">{n}</span> : !band && v && v.mark ? (() => { const m = weekendLetter(v.mark, d.on); return <span className={`cx-sigla${m.length > 3 ? " cx-sigla-longa" : ""}`}>{m}</span>; })() : null}
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
    "--cx-border": p.borderColor, "--cx-grid": p.gridColor, "--cx-gw": `${p.gridWidth}mm`, "--cx-card": p.cardColor, "--cx-page": p.pageColor, "--cx-light": p.lightColor,
    "--cx-holiday": p.holidayColor, "--cx-text": p.textColor,
    "--cx-title-font": p.titleFont, "--cx-body-font": p.bodyFont, "--cx-script-font": p.scriptFont,
    "--cx-title-pt": `${p.titlePt}pt`, "--cx-subtitle-pt": `${p.subtitlePt}pt`, "--cx-k": String(p.textScale * p.density),
    "--cx-radius": `${p.cardRadius}mm`, "--cx-shadow": String(p.cardShadow), "--cx-bw": `${p.borderWidth}mm`, "--cx-density": String(p.density),
    "--cx-overlay": String(p.coverOverlay / 100), "--cx-gap": `${p.gapMm}mm`,
    "--cx-h-banner": `${p.bands.banner}fr`, "--cx-h-body": `${p.bands.body}fr`, "--cx-h-info": `${p.bands.info}fr`,
    "--cx-ts-bt": String(p.typeScale.blockTitle), "--cx-ts-mo": String(p.typeScale.months), "--cx-ts-days": String(p.typeScale.days),
    ...Object.fromEntries(Object.entries(p.boxPad).map(([k, mm]) => [`--cx-pad-${k}`, `${mm}mm`])),
    ...Object.fromEntries(Object.entries(p.lineGap).map(([k, v]) => [`--cx-lh-${k}`, String(v)])),
    "--cx-h-footer": `${p.show.branding ? p.bands.footer : 0}fr`,
  };
  const style = v as CSSProperties;
  if (false && t && p.pageImage) Object.assign(style, { backgroundImage: `linear-gradient(color-mix(in srgb, ${p.pageColor} ${100 - p.pageOpacity}%, transparent), color-mix(in srgb, ${p.pageColor} ${100 - p.pageOpacity}%, transparent)), url(${p.pageImage})`, backgroundSize: p.pageZoom === 100 ? "cover" : `cover, ${p.pageZoom}%`, backgroundPosition: `${p.pageFocusX}% ${p.pageFocusY}%`, backgroundRepeat: "no-repeat" });
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
      {cover && <img className="cx-banner-img" src={cover} onError={hideBrokenImage} ref={hideIfAlreadyBroken} alt="" aria-hidden
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
          {false && p.show.slogan && p.slogan && (
            <p className="cx-slogan">{p.slogan}<svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden><path d="M2 9 C 50 2, 120 14, 198 5" /><path d="M10 12 C 70 7, 130 13, 190 9" /></svg></p>)}
        </div>
      </div>
    </header>
  );
}

/** Tamanho escolhido pelo usuário (≠ 100%) é respeitado: o ajuste automático só age no tamanho padrão; se não couber, o editor avisa. */
function Box({ title, bloco, children, className = "", fit = true, scale = 1 }: { title: string; bloco: string; children: ReactNode; className?: string; fit?: boolean; scale?: number }) {
  return <section className={`cx-caixa ${className}`} data-cx-bloco={bloco} style={{ ["--cx-bs" as string]: String(scale) } as CSSProperties}><h2>{title}</h2><div className="cx-caixa-corpo" data-fit={fit && scale === 1 ? "" : undefined}>{children}</div></section>;
}

function Legend({ vm, types, p, vertical }: { vm: ExternalViewModel; types: Types; p: ExternalProfile; vertical?: boolean }) {
  const codes = externalLegendCodes(vm, (c) => visualOf(c, types, p));
  const anyUnsure = vm.days.some((d) => d.effect !== "letivo" && d.effect !== "nao-letivo" && d.effect !== "sem-declaracao");
  return (
    <Box title="Legenda" bloco="legenda" scale={p.typeScale.legend}>
      <ul className={`cx-legenda${vertical ? " cx-uma-coluna" : ""}`}>
        {codes.map((c) => { const v = visualOf(c, types, p);
          return <li key={c}><span className="cx-chip" style={{ backgroundColor: v.bg, color: v.fg }}>{vertical ? v.mark : ""}</span><span>{v.label}</span></li>; })}
        {vm.unmappedTypes.map((u) => <li key={`u-${u}`} data-testid="cx-unmapped"><span className="cx-chip cx-chip-sem">?</span><span>Tipo sem mapeamento visual: {u}</span></li>)}
        {anyUnsure && <li><span className="cx-chip cx-chip-sem">!</span><span>Efeito indeterminado / conflito / não declarado</span></li>}
      </ul>
    </Box>
  );
}
const Holidays = ({ vm, cols, p }: { vm: ExternalViewModel; cols: 1 | 2; p: ExternalProfile }) => (
  <Box title="Feriados nacionais e municipais" bloco="feriados" scale={p.typeScale.holidays}>
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
            <p className="cx-per-nome"><span style={{ fontSize: `${p.typeScale.periodName}em` }}>{pp.name}</span></p>
            <p className="cx-per-datas"><span style={{ fontSize: `${p.typeScale.periodText}em` }}>{shortDate(pp.startsOn)} a {shortDate(pp.endsOn)}</span></p>
            <p className="cx-per-num" title={pp.reason ?? ""}><span style={{ fontSize: `${p.typeScale.periodNumber}em` }}>{countText(pp)}</span></p>
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
function Councils({ vm, p }: { vm: ExternalViewModel; p: ExternalProfile }) {
  const c = vm.councils;
  return (
    <section className="cx-caixa" data-cx-bloco="conselhos" data-council-state={c.state} style={{ ["--cx-bs" as string]: String(p.typeScale.councils) } as CSSProperties}><h2>Conselhos de classe</h2>
      <div className="cx-caixa-corpo" data-fit={p.typeScale.councils === 1 ? "" : undefined}>
        {c.state === "configurada"
          ? c.items.length ? <ul className="cx-feriados cx-duas">{c.items.map((i) => <li key={i.on + i.role}><b>{shortDate(i.on)}</b><span>{i.name}</span></li>)}</ul>
            : <p className="cx-vazio">Tipos de conselho configurados, sem datas declaradas nesta versão.</p>
          : <p className="cx-vazio">{COUNCIL_TEXT[c.state]}</p>}
      </div>
    </section>);
}
const Signatures = ({ vm, p }: { vm: ExternalViewModel; p: ExternalProfile }) => vm.signatures.length ? (
  <div className="cx-assinaturas" data-cx-bloco="assinaturas" style={{ fontSize: `${5.8 * p.typeScale.signatures}pt` }}>{vm.signatures.slice(0, 4).map((s, i) => <div key={i}><span /><p>{s}</p></div>)}</div>) : null;

const PILLAR_ICON: Record<ExternalPillar["icon"], ReactNode> = {
  estudantes: <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3Zm-6 9.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3-6-3Z" />,
  escolas: <path d="M12 2 3 7v2h18V7l-9-5ZM5 10v8h3v-8H5Zm5.5 0v8h3v-8h-3ZM16 10v8h3v-8h-3ZM3 20v2h18v-2H3Z" />,
  cidade: <path d="M3 21V10l5-3v3l5-3v4h3V4h5v17H3Zm3-3h2v-2H6v2Zm0-4h2v-2H6v2Zm5 4h2v-2h-2v2Zm0-4h2v-2h-2v2Zm6 4h2v-2h-2v2Zm0-4h2v-2h-2v2Zm0-4h2V8h-2v2Z" />,
};
function PanoramicFooter({ p }: { p: ExternalProfile }) {
  const [w, ...rest] = p.footerPhrase.split(" ");
  const pillars = p.pillars.filter((x) => !x.hidden);
  return (
    <footer className="cx-rodape-inst" data-cx-bloco="branding" style={{ fontSize: `${p.typeScale.footer}em`, ...(p.footerImage ? { backgroundImage: `url(${p.footerImage})`, backgroundSize: "cover" } : {}) }}>
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
    <footer className="cx-rodape-deco" data-cx-bloco="branding" style={{ fontSize: `${p.typeScale.footer}em`, ...(p.footerImage ? { backgroundImage: `url(${p.footerImage})`, backgroundSize: "cover" } : {}) }}>
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
  // Limpa o tamanho deixado por um ajuste anterior: um bloco que deixou de ser ajustável (tamanho escolhido
  // pelo usuário) ficava preso no último tamanho automático e o controle parecia não funcionar.
  root.querySelectorAll<HTMLElement>("[data-fitted]").forEach((el) => { el.style.fontSize = ""; el.removeAttribute("data-fitted"); });
  root.querySelectorAll<HTMLElement>("[data-fit]").forEach((el) => {
    el.style.fontSize = "";
    let pt = parseFloat(getComputedStyle(el).fontSize) * 0.75;
    let guard = 0;
    // Folga de 2 px: a impressão arredonda linhas de forma diferente da tela e cortava a última linha.
    while ((el.scrollHeight > el.clientHeight - 2 || el.scrollWidth > el.clientWidth + 1) && pt > minPt && guard++ < 60) {
      pt = Math.max(minPt, pt - 0.25); el.style.fontSize = `${pt}pt`; el.setAttribute("data-fitted", "");
    }
  });
}
/**
 * CAL.EXT.2.1 — Blocos que não couberam mesmo após o ajuste automático (texto cortado ou invadindo o vizinho).
 * Usado pelo editor para avisar e impedir salvar/imprimir uma configuração inválida (nunca corta em silêncio).
 */
export function sheetIssues(root: HTMLElement): string[] {
  const out: string[] = [];
  // Tolerância de 3 px: glifos com line-height < 1 e arredondamento subpixel da prévia escalada
  // geravam falso "não coube". Só conta como problema o que realmente sai da área visível.
  const T = 3;
  const over = (el: HTMLElement) => el.scrollHeight > el.clientHeight + T || el.scrollWidth > el.clientWidth + T;
  root.querySelectorAll<HTMLElement>("[data-cx-bloco]").forEach((b) => {
    const body = b.querySelector<HTMLElement>(".cx-caixa-corpo") ?? b;
    const parent = b.parentElement?.getBoundingClientRect(); const r = b.getBoundingClientRect();
    const escapes = !!parent && parent.height > 0 && (r.bottom > parent.bottom + T || r.right > parent.right + T);
    // Período "não cabe" só se um texto invade o cartão vizinho ou sai do bloco.
    const clipped = [...b.querySelectorAll<HTMLElement>(".cx-periodo")].some((c) => {
      const cr = c.getBoundingClientRect();
      if (cr.bottom > r.bottom + T) return true;
      return [...c.querySelectorAll<HTMLElement>("p")].some((t) => {
        const tr = t.getBoundingClientRect();
        const w = t.scrollWidth > t.clientWidth + T;
        return w || tr.left < cr.left - T || tr.right > cr.right + T || tr.bottom > r.bottom + T;
      });
    });
    const bad = escapes || clipped || over(body);
    if (bad) out.push(b.dataset["cxBloco"]!);
  });
  return [...new Set(out)];
}
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
function Sheet({ className, p, template, vm, children }: { className: string; p: ExternalProfile; template: ExternalTemplateCode; vm: ExternalViewModel; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useIsoLayout(() => { if (ref.current) autoFitSheet(ref.current, p.minFitPt); });
  // Na impressão a folha é redesenhada em outro tamanho: reajusta ao entrar e ao sair do modo de impressão.
  useEffect(() => {
    const refit = () => { if (ref.current) autoFitSheet(ref.current, p.minFitPt); };
    const mq = window.matchMedia?.("print");
    window.addEventListener("beforeprint", refit); window.addEventListener("afterprint", refit);
    mq?.addEventListener?.("change", refit);
    return () => { window.removeEventListener("beforeprint", refit); window.removeEventListener("afterprint", refit); mq?.removeEventListener?.("change", refit); };
  }, [p.minFitPt]);
  return (
    <article ref={ref} className={`cx-folha ${className}`} style={themeVars(p, template)} data-testid={`external-sheet-${template}`}
      aria-label={`Calendário ${vm.year ?? ""} — modelo layout livre`}>{children}</article>
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
          <tr key={wi}>{w.map((n, i) => n === null ? <td key={i} className="cx-dia cx-vazio" aria-hidden><span className="cx-num cx-num-oculto">00</span></td>
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
  const blocks = visibleBlocks(p, vm);
  const widthOf = (b: InfoBlock) => b === "legenda" ? p.infoWidths.legenda : b === "periodos" ? p.infoWidths.periodos : b === "feriados" ? p.infoWidths.feriados : p.infoWidths.extra;
  const render = (b: InfoBlock) => renderBlock(b, vm, types, p, { holidayCols: 2 });
  return (
    <Sheet className="cx-panoramico" p={p} template="externo-livre" vm={vm}>
      <Banner vm={vm} p={p} presentation={presentation} template="externo-livre" />
      <div className="cx-corpo cx-meses">
        <Notices vm={vm} />
        {vm.months.map((m) => <MonthCard key={m.key} m={m} types={types} p={p} />)}
      </div>
      <div className={`cx-info${extra ? " cx-info-extra" : ""}`} data-order={blocks.join(",")} style={{ gridTemplateColumns: blocks.map((b) => `${widthOf(b)}fr`).join(" ") || "1fr" }}>
        {blocks.map((b) => render(b))}
      </div>
      {p.show.branding && <PanoramicFooter p={p} />}
    </Sheet>
  );
}

/** CAL.EXT.2.1 — blocos visíveis na ordem do perfil (ocultos e assinaturas sem nomes saem sem quebrar a ordem). */
export function visibleBlocks(p: ExternalProfile, vm: Pick<ExternalViewModel, "signatures">): InfoBlock[] {
  return p.blockOrder.filter((b) => p.show[b] && (b !== "assinaturas" || vm.signatures.length > 0));
}
function renderBlock(b: InfoBlock, vm: ExternalViewModel, types: Types, p: ExternalProfile, o: { holidayCols: 1 | 2; vertical?: boolean; cards?: boolean }): ReactNode {
  switch (b) {
    case "legenda": return <Legend key={b} vm={vm} types={types} p={p} vertical={o.vertical === true} />;
    case "periodos": return <Periods key={b} vm={vm} p={p} cards={o.cards === true} />;
    case "feriados": return <Holidays key={b} vm={vm} cols={o.holidayCols} p={p} />;
    case "conselhos": return <Councils key={b} vm={vm} p={p} />;
    case "assinaturas": return <Signatures key={b} vm={vm} p={p} />;
  }
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
      const text = kind === "ferias" ? p.feriasText : (visualOf(code, types, p).mark || visualOf(code, types, p).label.toUpperCase());
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
    <Sheet className="cx-mosaico" p={p} template="externo-livre" vm={vm}>
      <Banner vm={vm} p={p} presentation={presentation} template="externo-livre" />
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
          {visibleBlocks(p, vm).filter((b) => b === "legenda" || b === "feriados").map((b) => renderBlock(b, vm, types, p, { holidayCols: 1, vertical: true }))}
        </aside>
      </div>
      <div className="cx-info" data-order={visibleBlocks(p, vm).join(",")}>
        {visibleBlocks(p, vm).filter((b) => b !== "legenda" && b !== "feriados").map((b) => renderBlock(b, vm, types, p, { holidayCols: 1, cards: true }))}
      </div>
      {p.show.branding && <MosaicFooter p={p} />}
    </Sheet>
  );
}

export function ExternalSheet(props: { template: ExternalTemplateCode; vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown>; selected?: FreeBlockId | null; onSelect?: (b: FreeBlockId) => void; onMove?: (b: FreeBlockId, patch: { x?: number; y?: number; w?: number; h?: number }) => void; onMoveSticker?: (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => void; selectedLayer?: string | null; onSelectLayer?: (id: string) => void; onMoveLayer?: (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => void }) {
  return <FreeSheet {...props} template={props.template} />;
}

// ---------------- CAL.EXT.3 — modelos de layout livre ----------------
const mm = (v: number) => `${v}mm`;
function FreeBox({ id, b, p, title, selected, onSelect, onMove, children }: { id: FreeBlockId; b: BlockBox; p: ExternalProfile; title?: string; selected?: boolean; onSelect?: ((b: FreeBlockId) => void) | undefined; onMove?: ((b: FreeBlockId, patch: { x?: number; y?: number; w?: number; h?: number }) => void) | undefined; children: ReactNode }) {
  const s = b.style;
  const drag = (mode: "move" | "resize") => (e: RPointerEvent<HTMLElement>) => {
    if (!onMove || b.locked) return;
    e.preventDefault(); e.stopPropagation(); onSelect?.(id);
    const sheet = (e.currentTarget as HTMLElement).closest<HTMLElement>(".cx-folha"); if (!sheet) return;
    const k = sheet.getBoundingClientRect().width / SHEET_W; const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => { const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      onMove(id, mode === "move" ? { x: b.x + dx, y: b.y + dy } : { w: b.w + dx, h: b.h + dy }); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <section className={`cf-bloco${s.fill ? " cf-preenchido" : ""}${selected ? " cf-selecionado" : ""}`} data-cx-bloco={id} data-free-block={id}
      style={{ left: mm(b.x), top: mm(b.y), width: mm(b.w), height: mm(b.h), zIndex: b.z, padding: mm(s.padMm), fontFamily: s.font ?? undefined,
        fontSize: `${s.pt}pt`, lineHeight: s.lh, fontWeight: s.bold ? 700 : undefined, textAlign: s.align === "centro" ? "center" : s.align === "direita" ? "right" : "left",
        letterSpacing: s.tracking ? `${s.tracking}em` : undefined, fontStyle: s.italic ? "italic" : undefined, color: s.color ?? undefined,
        ...(s.fill ? { borderWidth: mm(s.borderMm), borderRadius: mm(s.radiusMm), ...(s.borderColor ? { borderColor: s.borderColor } : {}) } : {}),
        ...(s.bg ? { background: s.bg } : {}) }}
      onPointerDown={onMove ? drag("move") : undefined} onClick={onSelect ? () => onSelect(id) : undefined}>
      {title && <h2 className="cf-titulo" style={{ fontSize: `${s.titlePt}pt` }}>{title}</h2>}
      <div className="cf-corpo" data-fit="">{children}</div>
      {onMove && selected && !b.locked && <span className="cf-alca" aria-hidden onPointerDown={drag("resize")} />}
    </section>
  );
}

function StickerImg({ s, onMove }: { s: Sticker; onMove?: ((id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => void) | undefined }) {
  const drag = (mode: "move" | "resize") => (e: RPointerEvent<HTMLElement>) => {
    if (!onMove || s.locked) return;
    e.preventDefault(); e.stopPropagation();
    const sheet = (e.currentTarget as HTMLElement).closest<HTMLElement>(".cx-folha"); if (!sheet) return;
    const k = sheet.getBoundingClientRect().width / SHEET_W; const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => { const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      onMove(s.id, mode === "move" ? { x: s.x + dx, y: s.y + dy } : { w: s.w + dx, h: s.h + dy }); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <div className="cf-imagem-avulsa" data-sticker={s.id} aria-hidden onPointerDown={onMove ? drag("move") : undefined}
      style={{ position: "absolute", left: mm(s.x), top: mm(s.y), width: mm(s.w), height: mm(s.h), zIndex: s.front ? 40 + s.z : s.z, opacity: s.opacity / 100,
        transform: s.rot ? `rotate(${s.rot}deg)` : undefined, cursor: onMove && !s.locked ? "move" : undefined }}>
      <img src={s.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
      {onMove && !s.locked && <span className="cf-alca" aria-hidden onPointerDown={drag("resize")} />}
    </div>
  );
}

type LayerMove = (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => void;
function fadeMask(l: Extract<Layer, { kind: "imagem" }>): string | undefined {
  if (l.fade === "nenhum" || l.fadeMm <= 0) return undefined;
  const f = `${Math.min(l.fadeMm, l.h / 2)}mm`;
  if (l.fade === "baixo") return `linear-gradient(to bottom, #000 calc(100% - ${f}), transparent)`;
  if (l.fade === "cima") return `linear-gradient(to top, #000 calc(100% - ${f}), transparent)`;
  return `linear-gradient(to bottom, transparent, #000 ${f}, #000 calc(100% - ${f}), transparent)`;
}
/** CAL.EXT.4 — camada visual independente (foto, logo, onda vetorial, texto). Só aparência. */
function LayerView({ l, ctx, selected, onSelect, onMove }: { l: Layer; ctx: { year: number | null; title: string | null; subtitle: string | null }; selected: boolean; onSelect?: ((id: string) => void) | undefined; onMove?: LayerMove | undefined }) {
  if (!l.visible) return null;
  const drag = (mode: "move" | "resize") => (e: RPointerEvent<HTMLElement>) => {
    if (!onMove || l.locked) return;
    e.preventDefault(); e.stopPropagation(); onSelect?.(l.id);
    const sheet = (e.currentTarget as HTMLElement).closest<HTMLElement>(".cx-folha"); if (!sheet) return;
    const k = sheet.getBoundingClientRect().width / SHEET_W; const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => { const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      onMove(l.id, mode === "move" ? { x: l.x + dx, y: l.y + dy } : { w: l.w + dx, h: l.h + dy }); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const box: CSSProperties = { position: "absolute", left: mm(l.x), top: mm(l.y), width: mm(l.w), height: mm(l.h), zIndex: l.z, opacity: l.opacity / 100,
    transform: l.rot ? `rotate(${l.rot}deg)` : undefined, cursor: onMove && !l.locked ? "move" : undefined,
    outline: selected ? "0.4mm dashed currentColor" : undefined, pointerEvents: onMove ? "auto" : "none" };
  let inner: ReactNode = null;
  if (l.kind === "imagem") {
    const mask = fadeMask(l);
    inner = <div style={{ width: "100%", height: "100%", backgroundImage: `url(${l.src})`, backgroundRepeat: "no-repeat", backgroundPosition: `${l.fx}% ${l.fy}%`,
      backgroundSize: l.fit === "conter" ? "contain" : l.zoom === 100 ? "cover" : `${l.zoom}%`,
      filter: l.brightness !== 100 || l.contrast !== 100 || l.saturate !== 100 ? `brightness(${l.brightness}%) contrast(${l.contrast}%) saturate(${l.saturate}%)` : undefined,
      ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}), printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />;
  } else if (l.kind === "onda") {
    const gid = `cx-onda-${l.id}`;
    inner = <svg width="100%" height="100%" viewBox={`0 0 ${l.w} ${l.h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      {l.fill2 && <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={l.fill} /><stop offset="1" stopColor={l.fill2} /></linearGradient></defs>}
      <path d={wavePath(l)} fill={l.fill2 ? `url(#${gid})` : l.fill} />
      {l.stroke && l.strokeMm > 0 && <path d={wavePath({ ...l, side: l.side }).split(" L ")[0]} fill="none" stroke={l.stroke} strokeWidth={l.strokeMm} vectorEffect="non-scaling-stroke" />}
    </svg>;
  } else {
    const parts = resolveLayerText(l.text, ctx);
    inner = <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: l.align === "centro" ? "center" : l.align === "direita" ? "flex-end" : "flex-start",
      fontFamily: l.font ?? undefined, fontSize: `${l.pt}pt`, fontWeight: l.bold ? 700 : 400, fontStyle: l.italic ? "italic" : undefined, color: l.color,
      letterSpacing: l.tracking ? `${l.tracking}em` : undefined, lineHeight: l.lh, whiteSpace: "pre-wrap", textAlign: l.align === "centro" ? "center" : l.align === "direita" ? "right" : "left",
      textShadow: l.shadow ? "0 0.3mm 0.8mm rgba(0,0,0,0.45)" : undefined }}>
      <span>{parts.map((p, i) => <span key={i} style={p.accent ? { color: l.accent } : undefined}>{p.t}</span>)}</span></div>;
  }
  return <div className="cf-camada" data-layer={l.id} data-layer-kind={l.kind} aria-hidden style={box}
    onPointerDown={onMove ? drag("move") : undefined}>{inner}
    {onMove && selected && !l.locked && <span className="cf-alca" aria-hidden onPointerDown={drag("resize")} />}</div>;
}

export function FreeSheet({ vm, p, presentation, template, selected, onSelect, onMove, onMoveSticker, selectedLayer, onSelectLayer, onMoveLayer }: { vm: ExternalViewModel; p: ExternalProfile; presentation: Record<string, unknown>; template: ExternalTemplateCode; selectedLayer?: string | null; onSelectLayer?: (id: string) => void; onMoveLayer?: LayerMove; selected?: FreeBlockId | null; onSelect?: (b: FreeBlockId) => void; onMove?: (b: FreeBlockId, patch: { x?: number; y?: number; w?: number; h?: number }) => void; onMoveSticker?: (id: string, patch: { x?: number; y?: number; w?: number; h?: number }) => void }) {
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  const f = p.free; const B = f.blocks; const t = f.table;
  const id = institutionalIdentity(presentation);
  const cols = Array.from({ length: 31 }, (_, i) => i + 1);
  const colTotals = columnTotals(vm.months);
  const foto = false;
  const cards = false;
  const info = observationLines(typeof presentation["observations"] === "string" ? presentation["observations"] : undefined);
  const topImg = f.photo.top ?? (f.photo.useDefaultTop ? homeImage.url : null);
  const title = p.visualTitle ?? "CALENDÁRIO ESCOLAR";
  const year = vm.year !== null && !title.includes(String(vm.year)) ? ` ${vm.year}` : "";
  const legend = externalLegendCodes(vm, (c) => visualOf(c, types, p));
  const common = (k: FreeBlockId) => ({ id: k, b: B[k], p, selected: selected === k, onSelect, onMove });
  const manual = t.mode === "manual";
  const tableStyle: CSSProperties = { fontSize: `${t.dayPt}pt`, ...(manual ? { width: "auto", height: "auto" } : {}), ["--cf-div" as string]: mm(t.dividerMm) } as CSSProperties;
  const cell: CSSProperties | undefined = manual ? { width: mm(t.cellWmm), minWidth: mm(t.cellWmm), height: mm(t.cellHmm) } : undefined;
  const logos = p.logos.filter((l) => !l.hidden);
  return (
    <Sheet className={`cf-livre ${foto ? "cf-fotografico" : "cf-quadro"} ${cards ? "cf-panoramico" : "cf-mosaico"}`} p={p} template={template} vm={vm}>
      {false && !!f.photo.page && <div className="cf-foto cf-foto-pagina" aria-hidden style={{ position: "absolute", inset: 0, ...adjustedBg(f.photo.page ?? "", f.photo.pageAdj) }} />}
      {topImg && f.photo.topHmm > 0 && <div className="cf-foto cf-foto-topo" aria-hidden style={{ height: mm(f.photo.topHmm), ...adjustedBg(topImg, f.photo.topAdj) }} />}
      {f.photo.bottom && f.photo.bottomHmm > 0 && <div className="cf-foto cf-foto-rodape" aria-hidden style={{ height: mm(f.photo.bottomHmm), ...adjustedBg(f.photo.bottom, f.photo.bottomAdj) }} />}
      {f.photo.veilStrength > 0 && <div className="cf-veu" aria-hidden style={{ background: `linear-gradient(to bottom, transparent 0mm, transparent 45mm, color-mix(in srgb, ${f.photo.veil} ${f.photo.veilStrength}%, transparent) 55mm, color-mix(in srgb, ${f.photo.veil} ${f.photo.veilStrength}%, transparent) ${SHEET_H - Math.max(8, f.photo.bottomHmm)}mm, transparent ${SHEET_H}mm)` }} />}
      {f.layers.map((l) => <LayerView key={l.id} l={l} ctx={{ year: vm.year, title: p.visualTitle ?? "CALENDÁRIO ESCOLAR", subtitle: p.subtitle ?? (vm.title ?? "").toUpperCase() }} selected={selectedLayer === l.id} onSelect={onSelectLayer} onMove={onMoveLayer} />)}
      {f.stickers.map((s) => <StickerImg key={s.id} s={s} onMove={onMoveSticker} />)}
      {B.cabecalho.visible && <FreeBox {...common("cabecalho")}>
        <div className="cf-cab">
          <div className="cx-logos">{logos.filter((l) => l.position === "esquerda").map((l) => <ExtLogo key={l.id} l={l} inherited={id.logos} />)}</div>
          <div className="cf-cab-txt">
            {p.show.cabecalho && id.headerLines.map((h, i) => <p key={i} className="cf-cab-linha">{h}</p>)}
            <h1 style={{ fontSize: `${B.cabecalho.style.titlePt}pt`, fontFamily: B.cabecalho.style.font ?? p.titleFont }}>{title}{year}</h1>
            <p className="cf-cab-sub">{p.subtitle ?? (vm.title ?? "título não declarado").toUpperCase()}</p>
          </div>
          <div className="cx-logos">{logos.filter((l) => l.position === "direita").map((l) => <ExtLogo key={l.id} l={l} inherited={id.logos} />)}</div>
        </div>
      </FreeBox>}
      {B.matriz.visible && <FreeBox {...common("matriz")}>
        <Notices vm={vm} />
        {cards ? <div className="cx-meses cf-meses" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1.5mm", height: "100%" }}>
          {vm.months.map((m) => <MonthCard key={m.key} m={m} types={types} p={p} />)}</div> :
        <table className={`cf-matriz${manual ? " cf-manual" : ""}`} style={tableStyle}>
          <colgroup><col style={{ width: mm(t.monthColMm) }} />{cols.map((c) => <col key={c} />)}{p.show.totaisMensais && t.totalColMm > 0 && <col style={{ width: mm(t.totalColMm) }} />}</colgroup>
          <thead style={{ fontSize: `${t.headPt}pt` }}><tr><th scope="col">Mês / Dia</th>{cols.map((c) => <th key={c} scope="col" style={cell ? { width: cell.width, minWidth: cell.minWidth } : undefined}>{c}</th>)}
            {p.show.totaisMensais && t.totalColMm > 0 && <th scope="col">Total</th>}</tr></thead>
          <tbody>{vm.months.map((m) => { const bands = bandsOf(m, types, p);
            return <tr key={m.key} data-month={m.key} style={cell ? { height: cell.height } : undefined}>
              <th scope="row" style={{ fontSize: `${t.monthPt}pt` }}>{m.name}</th>
              {cols.map((n) => n > m.daysInMonth ? <td key={n} className="cx-dia cx-inexistente" aria-hidden />
                : <DayCell key={n} d={m.byDay.get(n)} n={n} types={types} p={p} weekend={[0, 6].includes((m.firstWeekday + n - 1) % 7)} mode={t.showDayNumbers ? "numero" : "sigla"} band={t.showDayNumbers ? null : bands.get(n) ?? null} />)}
              {p.show.totaisMensais && t.totalColMm > 0 && <td className="cx-total" data-testid={`cx-total-${m.key}`} title={m.total.reason ?? ""}>{m.split ? <span className="cx-split"><span>{m.split[0]}</span><span>{m.split[1]}</span></span> : countText(m.total)}</td>}
            </tr>; })}</tbody>
        </table>}
      </FreeBox>}
      {B.periodos.visible && <FreeBox {...common("periodos")} title="Períodos letivos">
        <div className={`cf-periodos cf-${B.periodos.style.orientation}`}>
          {vm.periods.map((pp) => <div key={pp.name} className="cf-periodo"><b>{pp.name}</b><span>{shortDate(pp.startsOn)} a {shortDate(pp.endsOn)}</span>
            <span className="cf-per-num" title={pp.reason ?? ""}>{countText(pp)}{pp.schoolDays !== null ? " dias letivos" : ""}</span></div>)}
          <p className="cf-total">Total anual: <b data-testid="cx-total-anual" title={vm.total.reason ?? ""}>{countText(vm.total)}</b>{vm.total.schoolDays !== null ? " dias letivos" : ""}</p>
        </div>
      </FreeBox>}
      {B.legenda.visible && <FreeBox {...common("legenda")} title="Legenda">
        <ul className="cf-lista" style={{ columnCount: B.legenda.style.cols }}>
          {legend.map((c) => { const v = visualOf(c, types, p); return <li key={c}><span className="cx-chip" style={{ backgroundColor: v.bg, color: v.fg }}>{v.mark}</span> {v.label}</li>; })}
          {vm.unmappedTypes.map((u) => <li key={`u-${u}`} data-testid="cx-unmapped"><span className="cx-chip cx-chip-sem">?</span> Tipo sem mapeamento visual: {u}</li>)}
        </ul>
      </FreeBox>}
      {B.feriados.visible && <FreeBox {...common("feriados")} title="Feriados">
        {vm.holidays.length ? <ul className="cf-lista" style={{ columnCount: B.feriados.style.cols }}>{vm.holidays.map((h) => <li key={h.on + h.name}><b>{shortDate(h.on)}</b> {h.name}</li>)}</ul> : <p className="cx-vazio">Nenhum feriado declarado.</p>}
      </FreeBox>}
      {B.conselhos.visible && <FreeBox {...common("conselhos")} title="Conselhos de Classe">
        {vm.councils.state === "configurada"
          ? vm.councils.items.length ? <ul className="cf-lista" style={{ columnCount: B.conselhos.style.cols }}>{vm.councils.items.map((i) => <li key={i.on + i.role}><b>{shortDate(i.on)}</b> {i.name}</li>)}</ul>
            : <p className="cx-vazio">Tipos de conselho configurados, sem datas declaradas nesta versão.</p>
          : <p className="cx-vazio" data-council-state={vm.councils.state}>{COUNCIL_TEXT[vm.councils.state]}</p>}
        {INFO_PLACES.map((pl) => <InfoLinesAt key={pl.code} lines={info} place={pl.code} />)}
      </FreeBox>}
      {B.assinaturas.visible && <FreeBox {...common("assinaturas")} title="Assinaturas">
        {vm.signatures.length ? <div className="cf-assinaturas">{vm.signatures.slice(0, 4).map((x, i) => <div key={i}><span /><p>{x}</p></div>)}</div> : <p className="cx-vazio">Nenhuma assinatura declarada.</p>}
      </FreeBox>}
      {B.rodape.visible && <FreeBox {...common("rodape")}>
        <div className="cf-rodape">{p.show.slogan && p.slogan && <span>{p.slogan}</span>}
          {p.show.qr && p.qrUrl && <QrCode value={p.qrUrl} sizeMm={Math.min(12, B.rodape.h - 1)} />}
          <span className="cx-sigem"><img src={sigemLogo.url} alt="SIGEM" /><span>{p.footerText ?? "Sistema Integrado de Gestão Escolar"}</span></span></div>
      </FreeBox>}
    </Sheet>
  );
}

/** Portal de impressão do externo: mesma raiz `.cd-print-root` (a regra de impressão já existente), folha própria `.cx-a4`. */
export function ExternalCalendarPrint({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // `cx-print-ativo`: quando o externo está escolhido, é a ÚNICA folha impressa (outras raízes da tela são ocultadas).
  return createPortal(<div className="cd-print-root cx-print-ativo" aria-hidden><div className="cx-a4">{children}</div></div>, document.body);
}
