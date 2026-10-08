import { demoActors } from "./calendar-fixtures";
import { presentState } from "@/config/state-presentation";
import type { CalendarActor, CalendarStatus } from "./calendar-types";

export type CalendarProfile = keyof typeof demoActors;
export const actorFor = (p?: string): CalendarActor =>
  demoActors[(p && p in demoActors ? p : "supervisao") as CalendarProfile];

export const STATUS_COPY: Record<
  CalendarStatus,
  { label: string; tone: "warning" | "info" | "success" | "neutral"; text: string }
> = {
  rascunho: {
    label: presentState("calendario", "rascunho").label,
    tone: presentState("calendario", "rascunho").tone as "info",
    text: "Em elaboração pela Supervisão. Editável; não é oficial.",
  },
  "em-revisao": {
    label: presentState("calendario", "em-revisao").label,
    tone: presentState("calendario", "em-revisao").tone as "info",
    text: "Em conferência antes da homologação. Conteúdo bloqueado para edição.",
  },
  homologado: {
    label: presentState("calendario", "homologado").label,
    tone: presentState("calendario", "homologado").tone as "info",
    text: "Aprovado e publicado para a rede. Imutável.",
  },
  arquivado: {
    label: presentState("calendario", "arquivado").label,
    tone: presentState("calendario", "arquivado").tone as "info",
    text: "Calendário histórico de ano encerrado. Imutável.",
  },
};
