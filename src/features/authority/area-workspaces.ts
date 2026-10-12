/**
 * L45 — espaço de trabalho por área: atividades ligadas às telas donas já existentes.
 * Só organiza navegação. Abrir a tela não autoriza: cada módulo segue RLS/writers.
 */
export type AreaActivity = { label: string; to: string; verb: "visualizar" | "criar" | "editar" | "aprovar" | "exportar" };

export const AREA_WORKSPACES: Readonly<Record<string, readonly AreaActivity[]>> = {
  mediador: [{ label: "Estudantes acompanhados", to: "/mediador", verb: "visualizar" }],
  "nei-aee": [
    { label: "Painel de inclusão", to: "/inclusao", verb: "visualizar" },
    { label: "Casos e fichas do NEI", to: "/inclusao/nei", verb: "editar" },
    { label: "Atendimento especializado (AEE)", to: "/inclusao/nei/aee", verb: "criar" },
  ],
  alimentacao: [
    { label: "Central de alimentação", to: "/alimentacao-escolar", verb: "visualizar" },
    { label: "Cozinha: execução e estoque", to: "/alimentacao-escolar/cozinha", verb: "criar" },
  ],
  avaliacao: [
    { label: "Desempenho e edições", to: "/avaliacao-desempenho", verb: "visualizar" },
    { label: "Acompanhamento avaliativo", to: "/acompanhamento-avaliacao", verb: "exportar" },
  ],
  "organizacao-da-rede": [
    { label: "Organização da rede", to: "/organizacao-da-rede", verb: "visualizar" },
    { label: "Matrículas", to: "/matriculas", verb: "criar" },
    { label: "Vagas", to: "/secretaria/vagas", verb: "editar" },
  ],
  documental: [
    { label: "Documentos e protocolo", to: "/sigem-documentos", verb: "visualizar" },
    { label: "Central de documentos", to: "/central-de-documentos", verb: "criar" },
  ],
  "busca-ativa": [
    { label: "Permanência", to: "/sigem-permanencia", verb: "visualizar" },
    { label: "Operação da busca ativa", to: "/sigem-permanencia/operacao", verb: "criar" },
  ],
  operacoes: [
    { label: "Transporte escolar", to: "/transporte-escolar", verb: "visualizar" },
    { label: "Infraestrutura", to: "/infraestrutura", verb: "editar" },
    { label: "Centro de operações", to: "/centro-de-operacoes", verb: "criar" },
  ],
  formacao: [
    { label: "Formação continuada", to: "/sigem-desenvolvimento", verb: "visualizar" },
    { label: "Operação das formações", to: "/sigem-desenvolvimento/operacao", verb: "criar" },
  ],
  tecnologia: [
    { label: "Painel de tecnologia", to: "/painel-de-tecnologia", verb: "visualizar" },
    { label: "Chamados e operação", to: "/tecnologia/operacao", verb: "editar" },
  ],
  // Família: só a gestão das autorizações pela equipe (o portal da família tem acesso próprio por vínculo).
  familia: [{ label: "Autorizações de responsáveis (equipe)", to: "/autorizacoes-familia", verb: "visualizar" }],
  // Execução técnica: só leitura do histórico de importações; nunca perfil humano.
  "importacao-tecnica": [{ label: "Histórico de importações", to: "/importacoes", verb: "visualizar" }],
};
