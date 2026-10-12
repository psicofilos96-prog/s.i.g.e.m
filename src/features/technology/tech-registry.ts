/**
 * Lote corretivo 15 — cadastros técnicos reais (contratos/licenças, conectividade, serviços, backups, ativos).
 * Reúne as etapas já existentes dos writers 0486/0487/0488/0491/0495 (fonte e comprovação exigidas no banco)
 * e espelha a recusa de informação de rede/credencial em texto livre (0502). Nada é semeado.
 */
import type { OperationStage } from "@/features/enrollments/enrollment-operations";
import { TECH_STAGES } from "./tech-operations";

export const REGISTRY_STAGE_IDS = ["licencas", "conectividade", "servicos", "backup", "inventario"] as const;

/** Comprovação que o banco exige em cada cadastro (descrição; a regra vive nos writers). */
export const REGISTRY_PROOF: Record<(typeof REGISTRY_STAGE_IDS)[number], string> = {
  licencas: "Licença não livre exige contrato juntado no SIGEM Documentos; plano anual só vale aprovado por outra pessoa.",
  conectividade: "Velocidade contratada só com contrato juntado; medição só entra no painel depois de verificada por outra pessoa.",
  servicos: "Operador municipal ou terceiro exige contrato juntado; versão só vale aprovada por outra pessoa.",
  backup: "Plano com fonte (norma, fabricante, contrato ou decisão técnica) aprovado por outra pessoa; execução e restauração com evidência juntada.",
  inventario: "Equipamento é bem patrimonial existente de categoria marcada como tecnologia (marca aprovada por outra pessoa).",
};

export const TECH_REGISTRY_STAGES: readonly OperationStage[] = REGISTRY_STAGE_IDS.map((id) => {
  const s = TECH_STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`tech-registry: etapa ${id} ausente`);
  return { ...s, summary: `${s.summary} Comprovação: ${REGISTRY_PROOF[id]} Não informe IP, MAC, endereço interno, senha ou token.` };
});

const PATTERNS: readonly RegExp[] = [
  /(^|[^0-9.])(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}([^0-9.]|$)/,
  /(^|[^0-9a-f:])([0-9a-f]{2}[:-]){5}[0-9a-f]{2}([^0-9a-f:]|$)/i,
  /(^|[^0-9a-f:])([0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}([^0-9a-f:]|$)/i,
  /\b(senha|password|passwd|pwd|token|api[-_ ]?key|secret|segredo|ssid|wpa2?|psk|vlan)\b\s*[:=]/i,
  /:\/\/[^/\s]*(localhost|\.local|\.lan|\.intranet|\.internal)([:/\s]|$)/i,
  /:\/\/[^/\s@]*:[^/\s@]*@/,
];

/** Espelho de `tech_text_exposes_network` (0502), para avisar antes do envio. */
export function exposesNetworkInfo(text: string | null | undefined): boolean {
  return !!text && PATTERNS.some((p) => p.test(text));
}
