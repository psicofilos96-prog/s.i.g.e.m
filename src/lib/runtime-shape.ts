import { z } from "zod";

/**
 * NVALID.1 — fronteira de dados: resposta do banco/arquivo é conferida em execução, não só pelo TypeScript.
 * Falha fechada: shape inválido nunca vira dado parcial; campos extras são descartados (não chegam à tela).
 */
export const SHAPE_INVALID = "shape:invalid";
export const SHAPE_MESSAGE = "Os dados recebidos vieram num formato inesperado e não foram exibidos. Tente novamente; se continuar, avise o suporte.";

export class ShapeError extends Error {
  constructor(readonly boundary: string) { super(`${SHAPE_INVALID} ${boundary}`); }
}

export function parseBoundary<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown, boundary: string): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ShapeError(boundary);
  return r.data;
}

export const isShapeError = (raw: string) => raw.includes(SHAPE_INVALID);
export { z };
