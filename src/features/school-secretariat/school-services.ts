// N5.5.1 — "Serviços da escola": só agrupa módulos que já existem; nunca duplica motor.
// Serviço sem tela pronta aparece como indisponível, sem link e sem número inventado.
export interface SchoolService {
  key: string;
  title: string;
  description: string;
  /** rota da tela existente; ausente = ainda não disponível */
  to?: "/alimentacao-escolar";
}

export const SCHOOL_SERVICES: readonly SchoolService[] = [
  { key: "alimentacao", title: "Alimentação escolar", description: "Cardápio, restrições alimentares e cozinha da escola.", to: "/alimentacao-escolar" },
  { key: "transporte", title: "Transporte escolar", description: "Veículos, rotas, pontos e alunos atendidos." },
  { key: "infraestrutura", title: "Infraestrutura", description: "Ambientes, condição, acessibilidade e solicitações." },
  { key: "domiciliar", title: "Atendimento domiciliar", description: "Estudantes em atendimento fora da escola." },
];

export function availableServices(list: readonly SchoolService[] = SCHOOL_SERVICES) {
  return list.filter((s) => s.to);
}
