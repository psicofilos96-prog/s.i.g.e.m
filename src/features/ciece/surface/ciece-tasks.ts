/** NCIECE.UX — as três tarefas da estação. Só navegação; não lê nem calcula dado. */
export type CieceTask = {
  id: "qualidade" | "mapa" | "fontes";
  title: string;
  description: string;
  links: readonly { label: string; to: "/qualidade-dos-dados" | "/mapa-estatistico-rede" | "/central-de-integracoes" | "/censo-escolar" }[];
};

export const CIECE_TASKS: readonly CieceTask[] = [
  {
    id: "qualidade",
    title: "Conferir a qualidade dos dados",
    description: "Veja o que precisa ser revisado antes de usar os números.",
    links: [{ label: "Abrir qualidade dos dados", to: "/qualidade-dos-dados" }],
  },
  {
    id: "mapa",
    title: "Fechar o Mapa Estatístico",
    description: "Acompanhe envio, conferência e aprovação dos Mapas das escolas.",
    links: [{ label: "Abrir Mapas da rede", to: "/mapa-estatistico-rede" }],
  },
  {
    id: "fontes",
    title: "Importar e reconciliar fontes",
    description: "Traga arquivos externos e compare com os dados do sistema. Comparar nunca corrige dado.",
    links: [
      { label: "Importar arquivos", to: "/central-de-integracoes" },
      { label: "Reconciliar com o Censo", to: "/censo-escolar" },
    ],
  },
];
