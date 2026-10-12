// Matrículas L19 — aceite da família (migration 0472: enr_public_accept_seat). Aceite não é matrícula:
// a vaga só é confirmada pela validação administrativa e a matrícula só nasce no writer canônico da Secretaria.
import { supabase } from "@/integrations/supabase/client";
import { validResultInput } from "./individual-result";

export type AcceptStatus = "registrado" | "ja-registrado" | "sem-reserva" | "reserva-nao-ativa" | "indisponivel";
export const ACCEPT_MESSAGE: Record<AcceptStatus, string> = {
  registrado: "Interesse na vaga registrado. A escola vai conferir e, depois, a Secretaria faz a matrícula.",
  "ja-registrado": "O interesse nesta vaga já estava registrado.",
  "sem-reserva": "Não há vaga reservada para este pedido.",
  "reserva-nao-ativa": "A reserva não está mais ativa (prazo vencido, já confirmada ou liberada).",
  indisponivel: "Não foi possível registrar. Confira o código do pedido e o código de conferência.",
};
const KNOWN = Object.keys(ACCEPT_MESSAGE);

export async function acceptSeat(code: string, check: string): Promise<{ status: AcceptStatus; receipt: string | null }> {
  if (!validResultInput(code, check)) return { status: "indisponivel", receipt: null };
  const { data, error } = await supabase.rpc("enr_public_accept_seat" as never, { _code: code.trim().toUpperCase(), _check: check.trim().toLowerCase() } as never);
  if (error) throw new Error("aceite-indisponivel");
  const row = (data as { status: string; receipt: string | null }[] | null)?.[0];
  return row && KNOWN.includes(row.status) ? { status: row.status as AcceptStatus, receipt: row.receipt } : { status: "indisponivel", receipt: null };
}
