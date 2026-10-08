import type { SyntheticEvent } from "react";

/** NASSET.2 — imagem decorativa que não carrega some (tela e impressão), sem ícone quebrado; o fundo institucional permanece. */
export function hideBrokenImage(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

/** Cobre a falha ocorrida antes da hidratação (o onError do servidor já passou). */
export function hideIfAlreadyBroken(el: HTMLImageElement | null) {
  if (el && el.complete && el.naturalWidth === 0) el.style.visibility = "hidden";
}
