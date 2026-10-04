/**
 * Decisão do usuário (2026-10-04): a conta autenticada da Supervisão com autoridade real do calendário
 * abre a experiência visual original do calendário (lista, workspace, documento, impressão) sobre o
 * trabalho salvo neste navegador (`sigem.calendarios.v1`). Esse trabalho é o calendário do usuário,
 * não demonstração; mas ainda NÃO é versão institucional: a sincronização com o banco é explícita
 * (painel secundário) e nunca simula homologação.
 */
import { createContext, useContext } from "react";

export type SupervisionMode = { authenticated: true; displayName: string | null } | null;
export const SupervisionModeContext = createContext<SupervisionMode>(null);
export const useSupervisionMode = () => useContext(SupervisionModeContext);
export const CALENDAR_AUTHORITY_CAPABILITY = "construir-calendario-da-rede";

import { calendarRepository, type CalendarRepository } from "./calendar-store";
/** Repositório usado pelas telas do calendário (laboratório por padrão; artefato exato na Supervisão). */
export const CalendarRepositoryContext = createContext<CalendarRepository>(calendarRepository);
export const useCalendarRepository = () => useContext(CalendarRepositoryContext);
