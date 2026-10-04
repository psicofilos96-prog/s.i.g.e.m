/**
 * B4.6.8 — Caminho de acesso da conta autenticada ao calendário institucional (modelo puro).
 *
 * Decide SÓ o que mostrar; nunca concede capacidade. Entradas vêm do banco (estado da instalação,
 * designação do instalador, capacidades efetivas de rede). E-mail/login nunca entram na decisão.
 */
import { CAP } from "./institutional-calendar-management";

export type CalendarAccessInput =
  | { status: "erro" }
  | { status: "lido"; installation: string | null; designated: boolean; networkCapabilities: readonly string[] };

export type CalendarAccessStep =
  | { kind: "erro-leitura" }
  | { kind: "instalar"; sourcePreview: true }            // conta designada, SIGEM não instalado
  | { kind: "aguardando-instalacao" }                     // outra conta, SIGEM não instalado
  | { kind: "sem-capacidade-calendario" }                 // instalado, sem capacidade do calendário
  | { kind: "gestao"; sourcePreview: true }               // instalado, com capacidade de construir/homologar
  | { kind: "estado-desconhecido" };                      // estado da instalação ausente/inesperado

const CALENDAR_CAPS: readonly string[] = Object.values(CAP);

export function calendarAccessStep(i: CalendarAccessInput): CalendarAccessStep {
  if (i.status === "erro") return { kind: "erro-leitura" };
  if (i.installation === "nao-instalado") return i.designated ? { kind: "instalar", sourcePreview: true } : { kind: "aguardando-instalacao" };
  if (i.installation !== "instalado") return { kind: "estado-desconhecido" };
  return i.networkCapabilities.some((c) => CALENDAR_CAPS.includes(c)) ? { kind: "gestao", sourcePreview: true } : { kind: "sem-capacidade-calendario" };
}

/** Único retorno aceito depois da instalação (evita redirecionamento aberto). */
export const INSTALL_RETURN_CALENDAR = "/calendario-escolar";
export const safeInstallReturn = (v: string | null | undefined): string | null => (v === INSTALL_RETURN_CALENDAR ? v : null);
