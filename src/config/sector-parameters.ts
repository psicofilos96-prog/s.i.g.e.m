/**
 * Parâmetros por setor. Cada chave existe no catálogo do banco (`sector_parameter_catalog`) E é lida
 * por um cálculo real (`readBy`); o teste `sector-parameters.test.ts` recusa parâmetro sem consumidor.
 */
import { formatAcademicDate } from "@/lib/academic-date";
export type ParameterKind = { kind: "dias" } | { kind: "percentual" } | { kind: "data" } | { kind: "escolha"; options: readonly { value: string; label: string }[] };

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
  secretaria: [{ key: "secretaria.cpf-obrigatorio-desde", group: "Identificação", label: "CPF obrigatório para nascidos desde",
    help: "A partir desta data, inclusive, CPF obrigatório. Para os anteriores, aceita certidão como alternativa. Alterar não modifica matrículas já registradas.",
    usedIn: [{ label: "Nova matrícula", href: "/matriculas/nova" }], readBy: "secretariat_cpf_required_from", input: { kind: "data" }, undefinedEffect: "" },
    { key: "secretaria.prazo-vacinacao", group: "Prazos", label: "Prazo para entregar comprovante de vacinação",
      help: "Dias corridos a partir da declaração de pendência. Alterar vale para novos registros; os prazos já registrados permanecem iguais.",
      usedIn: [{ label: "Ficha do aluno", href: "/secretaria" }, { label: "Relatório de vacinação pendente", href: "/relatorios" }],
      readBy: "secretariat_vaccination_deadline_days", input: { kind: "dias" }, undefinedEffect: "" }],
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
    {
      key: "alimentacao.aviso-de-validade", group: "Estoque", label: "Avisar validade próxima",
      help: "Quantos dias antes do vencimento o estoque avisa que um lote está perto de vencer.",
      usedIn: [{ label: "Estoque — Alertas", href: "/alimentacao-escolar#estoque" }],
      readBy: "meal_stock_alerts_at", input: { kind: "dias" }, undefinedEffect: "",
    },
    {
      key: "alimentacao.saldo-do-pedido", group: "Estoque", label: "Saldo que vale para o pedido",
      help: "Qual saldo de estoque a escola considera ao montar o pedido do mês.",
      usedIn: [{ label: "Estoque", href: "/alimentacao-escolar#estoque" }],
      readBy: "meal_stock_basis_at",
      input: { kind: "escolha", options: [{ value: "saldo-atual", label: "Saldo atual" }, { value: "saldo-menos-entregas-previstas", label: "Saldo atual menos entregas já previstas" }] },
      undefinedEffect: "",
    },
  ],
  protocolos: [
    {
      key: "protocolos.prazo-padrao", group: "Prazos", label: "Prazo padrão dos processos",
      help: "Dias, contados da abertura, para concluir um processo cujo tipo não tem prazo próprio aprovado.",
      usedIn: [{ label: "Documentos — Pesquisa de processos", href: "/sigem-documentos" }],
      readBy: "search_admin_cases_with_due", input: { kind: "dias" }, undefinedEffect: "",
    },
    {
      key: "protocolos.tipo-de-contagem", group: "Prazos", label: "Como contar os dias do prazo",
      help: "Dias úteis contam de segunda a sexta. Vale para o prazo padrão; um tipo de processo com prazo próprio usa a contagem dele.",
      usedIn: [{ label: "Documentos — Pesquisa de processos", href: "/sigem-documentos" }],
      readBy: "search_admin_cases_with_due",
      input: { kind: "escolha", options: [{ value: "uteis", label: "Dias úteis (segunda a sexta)" }, { value: "corridos", label: "Dias corridos" }] },
      undefinedEffect: "",
    },
  ],
  frequencia: [
    {
      key: "frequencia.limite-infrequencia", group: "Infrequência", label: "Limite de presença para alerta",
      help: "Abaixo desse percentual de presença o estudante entra no alerta de infrequência e pode ter caso de busca ativa aberto. O alerta não reprova ninguém.",
      usedIn: [{ label: "Infrequência e busca ativa", href: "/acompanhamento-avaliacao" }],
      readBy: "aa_infrequency_threshold", input: { kind: "percentual" }, undefinedEffect: "",
    },
  ],
};

/** Parâmetros que já existiam em telas próprias: aparecem como atalho, sem duplicar. */
export const EXISTING_PARAMETER_SCREENS: Record<string, readonly { label: string; href: string }[]> = {
  alimentacao: [{ label: "Per capita, proibições por público e conversões de unidade", href: "/alimentacao-escolar#planejamento" }],
  matriculas: [{ label: "Parâmetros de matrícula", href: "/matriculas/parametros" }],
  avaliacao: [{ label: "Regras avaliativas (média, frequência, dias letivos)", href: "/regras-avaliativas" }, { label: "Regras de situação", href: "/regras-de-situacao" }],
};

export function formatParameterValue(p: SectorParameter, v: unknown): string {
  if (v == null) return "Ainda não definido";
  if (p.input.kind === "dias") return `${String(v)} dia(s)`;
  if (p.input.kind === "percentual") return `${String(v)}%`;
  if (p.input.kind === "data") return formatAcademicDate(String(v));
  return p.input.options.find((o) => o.value === v)?.label ?? "Opção não reconhecida";
}

const ERR: Record<string, string> = {
  "parameter:date-invalid": "Informe uma data válida.",
  "parameter:reason-required": "Escreva o motivo da alteração.",
  "parameter:days-invalid": "Informe um número inteiro de dias entre 1 e 365.",
  "parameter:percent-invalid": "Informe um percentual entre 1 e 99.",
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
