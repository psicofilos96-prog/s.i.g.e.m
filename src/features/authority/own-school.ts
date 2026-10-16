import { useSessionAuthority } from "./session-authority";

/** Conta de setor de UMA escola (Secretaria, Direção, OP): a própria escola, sem escolha. Demais ⇒ null. */
export function useOwnSchoolId(): string | null {
  const a = useSessionAuthority();
  if (a.status !== "signed-in") return null;
  const p = a.principal ?? null;
  return p && p.scope === "school" ? p.schoolId : null;
}
