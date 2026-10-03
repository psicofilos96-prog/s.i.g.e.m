/**
 * B4.6.2b.3.1 — ÚNICA tradução `PeriodSource` → frase. Oficialidade continua só do calendário
 * homologado; período B2.4 é institucional mas não oficializa o calendário. Ausente/legado = demonstrativo
 * (registros históricos não são reetiquetados).
 */
import type { PeriodSource } from "./assessment-types";

export type PeriodSourcePresentation = { tone: "success" | "warning"; badge: string; detail: string };

export function periodSourcePresentation(source: PeriodSource | undefined): PeriodSourcePresentation {
  if (source === "calendario-homologado")
    return { tone: "success", badge: "Período oficial do calendário homologado", detail: "Calendário homologado" };
  if (source === "institucional-b2.4")
    return {
      tone: "warning",
      badge: "Período institucional (B2.4) · calendário institucional indisponível para consulta",
      detail: "Período institucional B2.4 · calendário institucional indisponível para consulta",
    };
  return {
    tone: "warning",
    badge: "Não oficial · cenário demonstrativo sem calendário homologado",
    detail: "Não oficial · cenário demonstrativo",
  };
}
