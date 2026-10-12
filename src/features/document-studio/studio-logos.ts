/**
 * SIGEM Documentos L04 — brasões e logos configuráveis.
 * Registro append-only de versões de logo (`brasao@1`, `brasao@2`...), cada uma
 * apontando para um ativo CDN imutável. Modelo guarda `asset:<id>@<versão>`;
 * logo novo = nova versão, nunca troca a URL de uma versão existente, então
 * documento já emitido reproduz sempre o mesmo brasão. Só ativos deste
 * registro são aceitos (nada de URL livre, data: ou javascript:).
 */
import { INSTITUTIONAL_LOGOS } from "@/features/reports/report-analytics";
import type { StudioBlock } from "./studio-engine";

export interface LogoVersion { id: string; version: number; label: string; url: string; addedAt: string }

const url = (id: string) => INSTITUTIONAL_LOGOS.find((l) => l.id === id)!.url;
export const STUDIO_LOGOS: readonly LogoVersion[] = [
  { id: "brasao", version: 1, label: "Brasão de Itaperuna", url: url("brasao"), addedAt: "2026-10-12" },
  { id: "prefeitura", version: 1, label: "Logo da Prefeitura", url: url("prefeitura"), addedAt: "2026-10-12" },
  { id: "educacao", version: 1, label: "Logo da Secretaria de Educação", url: url("educacao"), addedAt: "2026-10-12" },
  { id: "sigem", version: 1, label: "Logo do SIGEM", url: url("sigem"), addedAt: "2026-10-12" },
];

export const logoRef = (l: Pick<LogoVersion, "id" | "version">) => `asset:${l.id}@${l.version}`;
export const latestLogos = () => [...new Map(STUDIO_LOGOS.map((l) => [l.id, l])).values()].map((l) => STUDIO_LOGOS.filter((x) => x.id === l.id).sort((a, b) => b.version - a.version)[0]!);

/** Mapa key→URL para `renderStudio({ assets })`; ref desconhecida fica fora (logo não aparece, nunca é inventado). */
export function logoAssets(): Record<string, string> {
  return Object.fromEntries(STUDIO_LOGOS.map((l) => [`${l.id}@${l.version}`, l.url]));
}

export function setHeaderLogo(blocks: readonly StudioBlock[], ref: string | null): StudioBlock[] {
  if (ref !== null && !STUDIO_LOGOS.some((l) => logoRef(l) === ref)) throw new Error("logo fora do registro institucional");
  return blocks.map((b) => (b.type === "header" ? { ...b, logoAsset: ref } : b));
}

/** Refs de logo usadas que não existem no registro (devem bloquear homologação). */
export function unknownLogoRefs(blocks: readonly StudioBlock[]): string[] {
  const out = new Set<string>();
  const walk = (bs: readonly StudioBlock[]) => bs.forEach((b) => {
    if (b.type === "header" && b.logoAsset && !STUDIO_LOGOS.some((l) => logoRef(l) === b.logoAsset)) out.add(b.logoAsset);
    if (b.type === "box") walk(b.children);
    if (b.type === "columns") b.columns.forEach(walk);
  });
  walk(blocks); return [...out];
}
