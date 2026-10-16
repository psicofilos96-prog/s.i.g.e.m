/**
 * Parâmetros por setor. Cada chave existe no catálogo do banco (`sector_parameter_catalog`) E é lida
 * por um cálculo real (`readBy`); o teste `sector-parameters.test.ts` recusa parâmetro sem consumidor.
 */
export type ParameterKind = { kind: "dias" } | { kind: "escolha"; options: readonly { value: string; label: string }[] };

export interface SectorParameter {
  key: string;
  group: string;
  label: string;
  help: string;
  usedIn: readonly { label: string; href: string }[];
  /** Função do banco que lê o parâmetro (prova de que ele faz algo). */
  readBy: string;
  input: ParameterKind;
  undefinedEffect: string;
}

export const SECTOR_PARAMETERS: Record<string, readonly SectorParameter[]> = {
  alimentacao: [
    {
      key: "alimentacao.prazo-nao-conformidade", group: "Prazos", label: "Prazo para resolver não conformidade",
      help: "Quantos dias a empresa ou a escola tem para resolver um problema de entrega, contados da abertura.",
      usedIn: [{ label: "Central — Prazo das não conformidades", href: "/alimentacao-escolar#visao-geral" }],
      readBy: "meal_network_action_summary", input: { kind: "dias" },
      undefinedEffect: "o quadro “Prazo das não conformidades” fica sem número.",
    },
    {
      key: "alimentacao.formula-adesao", group: "Fórmulas", label: "Como calcular a adesão",
      help: "Percentual de adesão da competência.",
      usedIn: [{ label: "Central — Adesão", href: "/alimentacao-escolar#visao-geral" }],
      readBy: "meal_network_action_summary",
      input: { kind: "escolha", options: [{ value: "refeicoes-por-presentes", label: "Refeições servidas ÷ alunos presentes" }] },
      undefinedEffect: "o quadro “Adesão” fica sem número.",
    },
    {
      key: "alimentacao.dias-de-atendimento", group: "Atendimento", label: "Dias de atendimento",
      help: "Em quais dias da semana as escolas servem refeição. Usado para apontar escolas sem refeição registrada.",
      usedIn: [{ label: "Central — Escolas sem execução registrada", href: "/alimentacao-escolar#visao-geral" }],
      readBy: "meal_network_action_summary",
      input: { kind: "escolha", options: [{ value: "segunda-a-sexta", label: "Segunda a sexta" }, { value: "segunda-a-sabado", label: "Segunda a sábado" }] },
      undefinedEffect: "",
    },
  ],
};

export function formatParameterValue(p: SectorParameter, v: unknown): string {
  if (v == null) return "Ainda não definido";
  if (p.input.kind === "dias") return `${String(v)} dia(s)`;
  return p.input.options.find((o) => o.value === v)?.label ?? "Opção não reconhecida";
}

const ERR: Record<string, string> = {
  "parameter:reason-required": "Escreva o motivo da alteração.",
  "parameter:days-invalid": "Informe um número inteiro de dias entre 1 e 365.",
  "parameter:choice-invalid": "Escolha uma das opções.",
  "parameter:stale-base": "Outra pessoa alterou este parâmetro agora. Recarregue e tente de novo.",
  "parameter:sector-not-enabled": "Este setor ainda não tem parâmetros liberados.",
  "session-required": "Entre novamente para alterar.",
};
export function parameterError(message: string): string {
  const k = Object.keys(ERR).find((x) => message.includes(x));
  if (k) return ERR[k]!;
  if (message.includes("capability:")) return "Sua conta não tem permissão para alterar parâmetros deste setor.";
  return "Não foi possível salvar. Tente novamente.";
}
