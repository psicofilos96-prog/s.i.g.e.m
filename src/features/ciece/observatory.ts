/**
 * CIECE Lote 02 — Observatório da Educação Municipal (núcleo puro).
 * Leituras vêm dos readers canônicos (network_indicators_at, school record versions, catálogo territorial);
 * aqui só se projeta: zero lido ≠ ausente ≠ negado, mapa só com coordenada verificada, território só por
 * código ou nome inequívoco dentro do município (nunca geocódigo inventado).
 */
import { reconcileMunicipality, validCode, type Municipality } from "@/features/territory/territory-catalog";

export const PANORAMA_KEYS = ["escolas", "estudantes-unicos", "matriculas", "turmas", "professores", "servidores", "pendencias"] as const;
export type PanoramaKey = (typeof PANORAMA_KEYS)[number];

export type Reading = { state: "lido"; value: number; source: string; referenceDate: string } | { state: "nao-lido" | "sem-permissao" | "sem-fonte"; reason: string };
export type Cell = { key: PanoramaKey; display: string; reading: Reading };

const LABEL: Record<Reading["state"], string> = { lido: "", "nao-lido": "não apurado", "sem-permissao": "sem permissão", "sem-fonte": "sem fonte canônica" };

/** Ausência de leitura nunca vira zero; zero lido aparece como 0. */
export function panorama(readings: Partial<Record<PanoramaKey, Reading>>): Cell[] {
  return PANORAMA_KEYS.map((key) => {
    const r = readings[key] ?? { state: "nao-lido" as const, reason: "leitura não realizada" };
    return { key, reading: r, display: r.state === "lido" ? String(r.value) : LABEL[r.state] };
  });
}

/** Etapas/modalidades: total só quando todas as linhas foram lidas. */
export function breakdownTotal(rows: { group: string; value: number | null }[]): number | null {
  return rows.length > 0 && rows.every((r) => r.value != null) ? rows.reduce((a, r) => a + r.value!, 0) : null;
}

export type GeoSource = { lat: number | null; lng: number | null; verifiedBy: string | null };
/** Ponto no mapa só com coordenada válida e verificação declarada; senão a escola vai para a lista "sem localização verificada". */
export function mapPoint(g: GeoSource | null): { lat: number; lng: number } | { blocked: string } {
  if (!g || g.lat == null || g.lng == null) return { blocked: "sem coordenada no cadastro" };
  if (!g.verifiedBy) return { blocked: "coordenada não verificada" };
  if (Math.abs(g.lat) > 90 || Math.abs(g.lng) > 180 || (g.lat === 0 && g.lng === 0)) return { blocked: "coordenada inválida" };
  return { lat: g.lat, lng: g.lng };
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export type District = { code: string; municipalityCode: string; name: string };

/** UF → município → distrito: código prevalece; nome só casa se único dentro do município já resolvido. */
export function resolveTerritory(cat: { municipalities: Municipality[]; districts: District[] }, school: { municipalityCode?: string | null; municipalityName?: string | null; ufCode?: string | null; district?: string | null; districtCode?: string | null }) {
  const m = reconcileMunicipality(cat.municipalities, { code: school.municipalityCode, name: school.municipalityName, ufCode: school.ufCode });
  if (m.kind === "fila") return { municipio: m, distrito: { kind: "fila" as const, reason: "municipio-nao-resolvido" } };
  const dc = school.districtCode ? validCode("distrito", school.districtCode) : null;
  if (dc) return { municipio: m, distrito: dc.startsWith(m.code) && cat.districts.some((d) => d.code === dc) ? { kind: "codigo" as const, code: dc } : { kind: "fila" as const, reason: "codigo-inexistente" } };
  if (!school.district?.trim()) return { municipio: m, distrito: { kind: "fila" as const, reason: "sem-dado" } };
  const hits = cat.districts.filter((d) => d.municipalityCode === m.code && norm(d.name) === norm(school.district!));
  return { municipio: m, distrito: hits.length === 1 ? { kind: "nome-inequivoco" as const, code: hits[0]!.code } : { kind: "fila" as const, reason: hits.length ? "nome-ambiguo" : "nao-encontrado" } };
}

/** Drill-down: cada célula da rede abre a mesma chave por escola e período; escola sem leitura fica ausente, não zero. */
export function drillDown(key: PanoramaKey, bySchool: { schoolId: string; reading: Reading }[], period: { from: string; to: string }) {
  return { key, period, rows: bySchool.map((s) => ({ schoolId: s.schoolId, display: s.reading.state === "lido" ? String(s.reading.value) : LABEL[s.reading.state] })) };
}
