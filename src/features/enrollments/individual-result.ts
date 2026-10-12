// Matrículas L18 — resultado individual (migration 0471: enr_public_application_result).
// Só o próprio pedido por código + conferência; uma linha; sem nome, lista, posição de terceiros. Texto só aprovado.
import { supabase } from "@/integrations/supabase/client";

export type ResultStatus = "ok" | "texto-nao-autorizado" | "sem-resultado-publicado" | "indisponivel";
export type ResultSituation =
  | "contemplado" | "vaga-reservada" | "vaga-confirmada" | "reserva-vencida" | "reserva-cancelada"
  | "lista-de-espera" | "indeterminado" | "nao-contemplado";

export interface IndividualResult {
  status: ResultStatus; situation: ResultSituation | null; cell: string | null;
  deadline: string | null; justification: string | null; next_step: string | null;
}

export const SITUATION_LABEL: Record<ResultSituation, string> = {
  contemplado: "Contemplado na distribuição — aguarde a reserva da vaga",
  "vaga-reservada": "Vaga reservada — confirme dentro do prazo",
  "vaga-confirmada": "Vaga confirmada",
  "reserva-vencida": "O prazo da reserva terminou",
  "reserva-cancelada": "A reserva foi liberada",
  "lista-de-espera": "Em lista de espera",
  indeterminado: "Em análise — faltam informações para classificar",
  "nao-contemplado": "Não contemplado nesta distribuição",
};

export const STATUS_MESSAGE: Record<Exclude<ResultStatus, "ok">, string> = {
  "texto-nao-autorizado": "A orientação oficial para esta situação ainda não foi publicada. Procure a escola ou a Secretaria.",
  "sem-resultado-publicado": "O resultado desta campanha ainda não foi divulgado.",
  indisponivel: "Não foi possível consultar. Confira o código do pedido e o código de conferência.",
};

const CODE = /^INS-[0-9A-F]{10}$/;
const CHECK = /^[0-9a-f]{12}$/;
export const validResultInput = (code: string, check: string) => CODE.test(code.trim().toUpperCase()) && CHECK.test(check.trim().toLowerCase());

const EMPTY: IndividualResult = { status: "indisponivel", situation: null, cell: null, deadline: null, justification: null, next_step: null };

/** Situação desconhecida vinda do servidor cai em "indisponível", sem detalhes. */
export function normalizeResult(row: Partial<IndividualResult> | null | undefined): IndividualResult {
  if (!row || !row.status || !(["ok", "texto-nao-autorizado", "sem-resultado-publicado", "indisponivel"] as string[]).includes(row.status)) return EMPTY;
  if (row.situation && !(row.situation in SITUATION_LABEL)) return EMPTY;
  return { ...EMPTY, ...row } as IndividualResult;
}

export async function consultResult(code: string, check: string): Promise<IndividualResult> {
  if (!validResultInput(code, check)) return EMPTY;
  const { data, error } = await supabase.rpc("enr_public_application_result" as never, { _code: code.trim().toUpperCase(), _check: check.trim().toLowerCase() } as never);
  if (error) throw new Error("consulta-indisponivel");
  return normalizeResult((data as IndividualResult[] | null)?.[0]);
}
