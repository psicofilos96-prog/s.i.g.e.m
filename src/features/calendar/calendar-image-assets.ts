/**
 * Recursos de imagem institucionais enviados pelo editor do Calendário.
 *
 * A configuração do documento referencia o recurso pelo identificador
 * permanente (`img-<uuid>`), nunca pelo nome do arquivo. O armazenamento atual
 * acompanha o do calendário (navegador); o contrato permite trocar por
 * armazenamento institucional sem alterar a configuração.
 */
import { useEffect, useSyncExternalStore } from "react";
import { ACCEPTED_MIME, MAX_LOGO_BYTES } from "@/features/identity/identity-store";

export type CalendarImageAsset = {
  id: string;
  url: string;
  mimeType: string;
  originalFileName: string;
  size: number;
  width: number;
  height: number;
  createdAt: string;
};

const KEY = "sigem.calendar.image-assets.v1";
let cache: CalendarImageAsset[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: CalendarImageAsset[] = [];

function load(): CalendarImageAsset[] {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as CalendarImageAsset[];
  } catch {
    cache = [];
  }
  return cache;
}

function save(list: CalendarImageAsset[]) {
  cache = list;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export const calendarImages = {
  list: load,
  get: (id: string) => load().find((a) => a.id === id) ?? null,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Valida e grava; recursos nunca são apagados (configurações antigas continuam resolvendo). */
  async add(file: File): Promise<{ ok: true; asset: CalendarImageAsset } | { ok: false; error: string }> {
    if (!(ACCEPTED_MIME as readonly string[]).includes(file.type))
      return { ok: false, error: "Envie uma imagem PNG ou JPEG." };
    if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "A imagem ultrapassa 2 MB." };
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const dim = await new Promise<{ w: number; h: number }>((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res({ w: 0, h: 0 });
      img.src = url;
    });
    if (!dim.w || !dim.h) return { ok: false, error: "Não foi possível ler a imagem." };
    const asset: CalendarImageAsset = {
      id: `img-${crypto.randomUUID()}`,
      url,
      mimeType: file.type,
      originalFileName: file.name,
      size: file.size,
      width: dim.w,
      height: dim.h,
      createdAt: new Date().toISOString(),
    };
    try {
      save([...load(), asset]);
    } catch {
      return { ok: false, error: "Sem espaço no armazenamento do navegador para esta imagem." };
    }
    return { ok: true, asset };
  },
};

export function useCalendarImages() {
  useEffect(() => {
    load();
    listeners.forEach((l) => l());
  }, []);
  return useSyncExternalStore(calendarImages.subscribe, calendarImages.list, () => EMPTY);
}
