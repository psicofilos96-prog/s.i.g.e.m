/**
 * Verificação de encaixe na folha A4 — só MEDE e aponta. Nunca reduz fonte,
 * espaçamento ou marcador, nunca corta nem esconde: compactar é decisão humana.
 */
import { useEffect, useState, type RefObject } from "react";
import { LAYOUT_BLOCKS } from "./calendar-layout";

export const A4_OVERFLOW_MESSAGE = "A configuração atual excede a área disponível para uma página A4.";

export type A4Overflow = { blockId: string; label: string; excessMm: number; direction: "abaixo" | "à direita" };

const PX_PER_MM = 96 / 25.4;

/** Mede os blocos registrados dentro de `.cd-a4` contra a área útil (entre margens). */
export function measureA4Overflow(a4: HTMLElement): A4Overflow[] {
  const cs = getComputedStyle(a4);
  const r = a4.getBoundingClientRect();
  const scale = a4.offsetWidth ? r.width / a4.offsetWidth : 1;
  const bottom = a4.clientHeight - parseFloat(cs.paddingBottom || "0");
  const right = a4.clientWidth - parseFloat(cs.paddingRight || "0");
  const out: A4Overflow[] = [];
  for (const def of LAYOUT_BLOCKS) {
    const el = a4.querySelector<HTMLElement>(def.root);
    if (!el) continue;
    const e = el.getBoundingClientRect();
    if (e.width === 0 && e.height === 0) continue;
    const eb = (e.bottom - r.top) / scale;
    const er = (e.right - r.left) / scale;
    if (eb > bottom + 0.5) out.push({ blockId: def.id, label: def.label, excessMm: (eb - bottom) / PX_PER_MM, direction: "abaixo" });
    else if (er > right + 0.5) out.push({ blockId: def.id, label: def.label, excessMm: (er - right) / PX_PER_MM, direction: "à direita" });
  }
  return out;
}

/** Remede a cada mudança de `key` (configuração) e de tamanho/fontes. */
export function useA4Overflow(ref: RefObject<HTMLElement | null>, key: unknown): A4Overflow[] {
  const [found, setFound] = useState<A4Overflow[]>([]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setFound(ref.current ? measureA4Overflow(ref.current) : []));
    };
    run();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(run) : null;
    ro?.observe(el);
    el.querySelectorAll("[data-cd-bloco], .cd-grade, .cd-rodape, .cd-assinaturas").forEach((x) => ro?.observe(x));
    document.fonts?.ready.then(run).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [ref, key]);
  return found;
}
