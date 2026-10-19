/** Diário da Cozinha — regras puras. Motivos e fórmula vêm da especificação do setor (padrão do sistema, editável por nova versão). */
export const MENU_REASONS = [
  "Falta de gêneros da Agricultura Familiar", "Atraso no recebimento dos gêneros alimentícios", "Mudança de cardápio autorizada pela nutricionista",
  "Ausência da cozinheira na escola", "Festividade", "Ponto facultativo", "Recesso", "Feriado",
] as const;
export type Compliance = "sim" | "parcialmente" | "nao";
export type Counts = { present: number | null; first: number | null; repeats: number | null; staff: number | null };

/** Adesão real = 1ª refeição ÷ presentes × 100, nunca acima de 100; sem presentes não há índice. */
export function adhesion(c: Counts): number | null {
  if (c.present == null || c.present <= 0 || c.first == null) return null;
  return Math.min(100, Math.round((c.first / c.present) * 1000) / 10);
}
/** Total bruto = 1ª refeição + repetições + servidores; ausência de qualquer parte = não informado. */
export function grossTotal(c: Counts): number | null {
  if (c.first == null || c.repeats == null || c.staff == null) return null;
  return c.first + c.repeats + c.staff;
}
export function diaryProblems(compliance: Compliance | "", reason: string, served: string, c: Counts): string[] {
  const p: string[] = [];
  if (!compliance) p.push("Informe se o cardápio foi cumprido.");
  if (compliance && compliance !== "sim") { if (!reason) p.push("Escolha o motivo."); if (served.trim().length < 3) p.push("Descreva o cardápio servido."); }
  if (c.first != null && c.present != null && c.first > c.present) p.push("A 1ª refeição não pode passar dos alunos presentes.");
  return p;
}
/** PVPS: lote que vence primeiro sai primeiro; sem validade vai por último. */
export function pvpsOrder<T extends { expires_on: string | null }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => (a.expires_on ?? "9999") < (b.expires_on ?? "9999") ? -1 : (a.expires_on ?? "9999") > (b.expires_on ?? "9999") ? 1 : 0);
}
