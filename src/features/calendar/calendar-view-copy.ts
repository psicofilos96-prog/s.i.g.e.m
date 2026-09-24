import { demoActors } from "./calendar-fixtures";
import type { CalendarActor, CalendarStatus } from "./calendar-types";

export type CalendarProfile = keyof typeof demoActors;
export const actorFor = (p?: string): CalendarActor =>
  demoActors[(p && p in demoActors ? p : "supervisao") as CalendarProfile];

export const STATUS_COPY: Record<
  CalendarStatus,
  { label: string; tone: "warning" | "info" | "success" | "neutral"; text: string }
> = {
  rascunho: {
    label: "Rascunho",
    tone: "warning",
    text: "Em elaboração pela Supervisão. Editável; não é oficial.",
  },
  "em-revisao": {
    label: "Em revisão",
    tone: "info",
    text: "Em conferência antes da homologação. Conteúdo bloqueado para edição.",
  },
  homologado: {
    label: "Homologado",
    tone: "success",
    text: "Aprovado e publicado para a rede. Imutável.",
  },
  arquivado: {
    label: "Arquivado",
    tone: "neutral",
    text: "Calendário histórico de ano encerrado. Imutável.",
  },
};
