import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import cidade from "@/assets/itaperuna-home.png.asset.json";
import sigem from "@/assets/logo-sigem.png.asset.json";
import { cardValue, safeVerifyUrl, type StudentCard } from "./student-card";
import { CARD_ACCENTS, DEFAULT_CARD_LAYOUT, type CardLayout, type CardLogo } from "./card-layout";

/** Frente e verso em proporção de cartão (85,6 × 54 mm). */
const face = "relative aspect-[85.6/54] w-full max-w-[340px] overflow-hidden rounded-xl border shadow-sm print:w-[85.6mm] print:max-w-none print:break-inside-avoid print:shadow-none print:rounded-[3mm]";
const LOGO_SRC: Record<CardLogo, { src: string; alt: string } | null> = {
  brasao: { src: brasao.url, alt: "Brasão de Itaperuna" }, sigem: { src: sigem.url, alt: "SIGEM" }, educacao: { src: brasao.url, alt: "Secretaria Municipal de Educação" },
};

function useQr(url: string | null) {
  return useMemo(() => { if (!url) return null; const q = qrcode(0, "M"); q.addData(url); q.make(); return q.createDataURL(4, 0); }, [url]);
}
const Row = ({ l, v }: { l: string; v: string | null }) => (
  <p className="leading-tight"><span className="block text-[9px] uppercase tracking-wide text-muted-foreground">{l}</span>
    <span className={`text-micro font-medium ${v ? "" : "italic text-muted-foreground"}`}>{cardValue(v)}</span></p>);

export function CardFront({ card, layout = DEFAULT_CARD_LAYOUT }: { card: StudentCard; layout?: CardLayout | undefined }) {
  return (
    <div className={`${face} bg-card`} data-card-face="frente">
      <div className={`flex items-center gap-2 px-3 py-1.5 ${CARD_ACCENTS[layout.accent]}`}>
        {layout.logos.map((l) => { const s = LOGO_SRC[l]; return s ? <img key={l} src={s.src} alt={s.alt} className="h-6 w-auto" /> : null; })}
        <p className="text-2xs font-semibold leading-tight">Prefeitura de Itaperuna<br />{layout.title}</p>
        {card.year && <span className="ml-auto text-sm font-bold">{card.year}</span>}
      </div>
      <div className="flex gap-3 p-3">
        <div className="flex aspect-[3/4] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded border bg-muted text-center text-[9px] text-muted-foreground print:w-[19mm]">
          {card.photoUrl ? <img src={card.photoUrl} alt="Foto do estudante" className="h-full w-full object-cover" /> : "Foto não registrada"}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 break-words text-sm font-bold leading-tight" title={cardValue(card.name)}>{cardValue(card.name)}</p>
          <Row l="Escola" v={card.school} />
          <div className="flex gap-3">
            {layout.showClass && <Row l="Turma" v={card.className} />}
            {layout.showShift && <Row l="Turno" v={card.shift} />}
          </div>
          {layout.showInternalId && <Row l="Identificador" v={card.internalId ?? null} />}
        </div>
      </div>
    </div>
  );
}

export function CardBack({ card, layout = DEFAULT_CARD_LAYOUT }: { card: StudentCard; layout?: CardLayout | undefined }) {
  const qr = useQr(safeVerifyUrl(card.verifyUrl));
  return (
    <div className={`${face} ${CARD_ACCENTS[layout.accent]}`} data-card-face="verso">
      <img src={cidade.url} onError={hideBrokenImage} ref={hideIfAlreadyBroken} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="relative flex h-full flex-col justify-between p-3">
        <div className="flex items-center gap-2"><img src={sigem.url} alt="SIGEM" className="h-6 w-auto" /><p className="text-2xs">{layout.backText || "Itaperuna — educação para todos"}</p></div>
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xs"><p>{card.status === "vigente" ? "Matrícula vigente" : "Sem matrícula vigente"}</p>
            <p className="font-semibold">{card.validity ?? "Sem emissão oficial"}</p>
            {card.code && <p className="opacity-80">Código {card.code}</p>}</div>
          {qr ? <img src={qr} alt="QR de verificação" className="h-16 w-16 rounded bg-background p-1 print:h-[16mm] print:w-[16mm]" />
            : <p className="max-w-[120px] text-right text-[9px] opacity-80">Verificação por QR ainda não emitida pela Secretaria</p>}
        </div>
      </div>
    </div>
  );
}

export function StudentCardView({ card, layout }: { card: StudentCard; layout?: CardLayout | undefined }) {
  return (
    <div className="flex flex-wrap gap-4" aria-label="Carteirinha do estudante">
      <CardFront card={card} layout={layout} /><CardBack card={card} layout={layout} />
    </div>
  );
}

/**
 * Folhas A4 para impressão em lote frente/verso: página de frentes e página de versos com colunas
 * espelhadas (impressão duplex pela borda longa alinha cada verso com sua frente). 8 cartões por folha.
 */
export function CardBatchSheets({ cards }: { cards: { card: StudentCard; layout: CardLayout }[] }) {
  const pages: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += 8) pages.push(cards.slice(i, i + 8));
  return (
    <div className="card-print-area card-batch space-y-6">
      {pages.map((p, pi) => (
        <div key={pi}>
          <div className="card-sheet grid grid-cols-2 gap-[4mm]" data-sheet="frentes">{p.map((c, i) => <CardFront key={i} card={c.card} layout={c.layout} />)}</div>
          <div className="card-sheet grid grid-cols-2 gap-[4mm]" data-sheet="versos">
            {/* espelha pares: [a b] → [b a] */}
            {p.flatMap((_, i) => (i % 2 === 0 ? [p[i + 1] ?? null, p[i]!] : [])).map((c, i) => c ? <CardBack key={i} card={c.card} layout={c.layout} /> : <div key={i} aria-hidden />)}
          </div>
        </div>))}
    </div>
  );
}
