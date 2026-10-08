/**
 * NADM.4 — Home da Administração Geral com dados reais e mapa das regras da rede.
 * Só resume o que a sessão já leu (admin_account_overview, capability_policies);
 * nada é gravado nem concedido. Leitura falha ⇒ null (não disponível), nunca zero.
 */
export type AccountRow = { banned: boolean; last_sign_in_at: string | null; password_change_required: boolean };
export type PolicyRow = { version: number; status: string; supersedes_version_id: string | null; id: string };

export type AdminHome = {
  accounts: { total: number; blocked: number; mustChangePassword: number; neverSignedIn: number } | null;
  policies: { latestHomologated: number | null; drafts: number } | null;
};

export function adminHome(accounts: readonly AccountRow[] | null, policies: readonly PolicyRow[] | null): AdminHome {
  return {
    accounts: accounts && {
      total: accounts.length,
      blocked: accounts.filter((a) => a.banned).length,
      mustChangePassword: accounts.filter((a) => a.password_change_required).length,
      neverSignedIn: accounts.filter((a) => !a.last_sign_in_at).length,
    },
    policies: policies && {
      latestHomologated: policies.filter((p) => p.status === "homologated").reduce<number | null>((m, p) => (m === null || p.version > m ? p.version : m), null),
      drafts: policies.filter((p) => p.status === "draft").length,
    },
  };
}

/** Telas de regras que JÁ existem; este mapa só orienta, não cria nem homologa regra. */
export type NetworkRuleScreen = { id: string; title: string; what: string; to: string };
export const NETWORK_RULE_SCREENS: readonly NetworkRuleScreen[] = [
  { id: "acessos", title: "Política de acessos", what: "Quem pode fazer o quê, por tipo de atuação e alcance.", to: "/central-de-acessos" },
  { id: "institucionais", title: "Regras institucionais", what: "Correção, fechamento, frequência e colegiados: rascunho, prévia, homologação e histórico.", to: "/regras-institucionais" },
  { id: "avaliativas", title: "Regras avaliativas", what: "Como os resultados de avaliação são compostos.", to: "/regras-avaliativas" },
  { id: "situacao", title: "Regras de situação acadêmica", what: "Como a situação final do estudante é determinada.", to: "/regras-de-situacao" },
  { id: "calendario", title: "Calendário escolar", what: "Dias letivos, períodos e eventos da rede.", to: "/calendario-escolar" },
  { id: "matrizes", title: "Matrizes curriculares", what: "Componentes e cargas por ano e escola.", to: "/matrizes-curriculares" },
];
