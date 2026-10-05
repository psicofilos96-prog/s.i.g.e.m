import brasao from "@/assets/brasao-itaperuna.png.asset.json";

/**
 * Identidade visual institucional configurável. Componentes genéricos nunca
 * embutem município, órgão ou emblema: leem daqui, para que outra rede troque
 * a identidade sem tocar telas.
 */
export const institution = {
  emblemUrl: brasao.url as string,
  locality: "Itaperuna · RJ",
  governmentName: "Prefeitura de Itaperuna",
  departmentName: "Secretaria Municipal de Educação",
} as const;
