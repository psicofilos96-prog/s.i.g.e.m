import type { SessionAuthority } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";

/** Presentation only: mixed institutional accounts retain their other workspaces. */
export function usesTeacherHome(authority: SessionAuthority): boolean {
  return authority.status === "signed-in" && !!authority.person && !authority.principal && !authority.followupSeat
    && authority.capabilities.some((c) => c.capabilityId === "registrar-aula-ministrada" || c.capabilityId === "registrar-frequencia")
    && !["/secretaria", "/direcao", "/orientacao", "/ciece", "/estacao-administrativa"].some((p) => pathAllowed(authority, p));
}