/** Menu único do professor: só o uso diário; fechamentos ficam dentro de "Minhas turmas". */
export type TeacherMenuItem = { id: string; label: string; to: string; search?: Record<string, string> };

export const TEACHER_MENU: readonly TeacherMenuItem[] = [
  { id: "inicio", label: "Minhas aulas", to: "/diario" },
  { id: "chamada", label: "Chamada", to: "/diario/chamadas" },
  { id: "registro", label: "Registro de aula", to: "/diario/registrar" },
  { id: "planejamento", label: "Planejamento", to: "/planejamento" },
  { id: "notas", label: "Notas", to: "/diario", search: { aba: "avaliacoes" } },
  { id: "turmas", label: "Minhas turmas", to: "/diario/turmas" },
];

/** Item ativo pela URL atual (o mais específico vence). */
export function activeTeacherItem(pathname: string, aba?: string): string {
  if (pathname === "/diario" || pathname === "/diario/") return aba === "avaliacoes" ? "notas" : "inicio";
  if (pathname.startsWith("/diario/chamada")) return "chamada";
  if (pathname.startsWith("/diario/registr")) return "registro";
  if (pathname.startsWith("/planejamento")) return "planejamento";
  if (pathname.startsWith("/avaliacoes-do-professor") || pathname.includes("/avaliacao")) return "notas";
  if (pathname.startsWith("/diario/turmas")) return "turmas";
  return "";
}
