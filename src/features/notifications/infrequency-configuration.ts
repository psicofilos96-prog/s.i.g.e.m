import { z } from "zod";
import { parseBoundary } from "@/lib/runtime-shape";
export const infrequencyConfigurationSchema = z.object({
  template_id: z.string().uuid().nullable(), rule_id: z.string().uuid().nullable(),
  rule_logical_id: z.string().uuid().nullable(), version: z.number().int().nonnegative(),
  title: z.string().min(1).max(120), body: z.string().min(1).max(500),
  enabled: z.boolean(), recorded_at: z.string().nullable(), reason: z.string().nullable(),
});
export type InfrequencyConfiguration = z.infer<typeof infrequencyConfigurationSchema>;
export const readInfrequencyConfiguration = (data: unknown) => parseBoundary(infrequencyConfigurationSchema, data, "infrequency-configuration");
export function canConfigureInfrequency(capabilities: readonly { capabilityId: string; schoolId: string | null }[]) {
  return capabilities.some((c) => c.capabilityId === "manter-comunicacao-institucional" && c.schoolId === null);
}
export function configurationMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("base-superseded")) return "Outra pessoa alterou o aviso. Atualize a página antes de salvar.";
  if (message.includes("capability:") || message.includes("session-required")) return "Sua conta não pode alterar a comunicação da rede.";
  if (message.includes("undeclared-variable")) return "Escreva o texto completo, sem marcadores de substituição.";
  return "Não foi possível salvar ou carregar o aviso. Tente novamente.";
}
