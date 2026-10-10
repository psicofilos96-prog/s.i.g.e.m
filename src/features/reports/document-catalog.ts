/**
 * Catálogo documental por setor: diz, para cada documento, onde ele é emitido hoje e
 * se está COMPLETO, PARCIAL ou BLOQUEADO, com a razão precisa. Só aponta para telas que
 * já emitem pelo motor comum (report-engine / Studio); nunca é um gerador paralelo.
 */
/** BLOQUEADO só quando falta norma comprovadamente ausente; trabalho de engenharia é PENDENTE. Modelos enviados são especificação suficiente; acervo histórico não é requisito. */
export type DocStatus = "COMPLETO" | "PARCIAL" | "PENDENTE" | "BLOQUEADO";
/** O que falta: desenvolvimento (engenharia), norma (regra genuinamente ausente) ou dados-reais (só para uso em produção). */
export type Dependency = "desenvolvimento" | "norma" | "dados-reais";
export type CatalogDoc = { id: string; sector: string; label: string; route: string | null; status: DocStatus; dependsOn: Dependency; reason: string };

export const DOCUMENT_CATALOG: readonly CatalogDoc[] = [
  { id: "relatorio-livre", sector: "Central", label: "Relatório personalizado (CSV/XLSX/PDF)", route: "/relatorios", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Emissão com trilha imutável, QR de verificação sem dado pessoal e reemissão com comparação de impressão digital; isolamento A/B provado no banco com identidades sintéticas. Falta prova no navegador com conta real e arquivo guardado (hoje a reemissão relê a fonte)." },
  { id: "studio", sector: "Central", label: "Documento do Studio com QR de verificação", route: "/central-de-documentos", status: "COMPLETO", dependsOn: "desenvolvimento", reason: "Modelo homologado, emissão congelada com hash e verificação pública por código opaco." },
  { id: "verificacao", sector: "Central", label: "Verificação pública de documento", route: "/verificar/documento/$codigo", status: "COMPLETO", dependsOn: "desenvolvimento", reason: "Resposta igual para código inválido e inexistente; sem dado pessoal." },
  { id: "doc-escolares", sector: "Secretaria", label: "Declarações e atestados escolares", route: "/documentos-escolares", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Só tipos com modelo homologado; demais aparecem como modelo pendente." },
  { id: "movimentacao", sector: "Secretaria", label: "Relatório de movimentação escolar", route: "/relatorios", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Movimentações da carga de 2026 não têm data efetiva real (data técnica 31/07)." },
  { id: "mapa-mensal", sector: "Estatística/CIECE", label: "Mapa mensal por escola e consolidado", route: "/mapa-censo-2026", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Fev–set sem evidência datada ficam como estimativa parcial; 6 escolas com INEP em revisão." },
  { id: "dossie-anual", sector: "Estatística/CIECE", label: "Dossiê anual por escola e rede", route: null, status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente: montagem sobre as fontes existentes e tela." },
  { id: "folha-final", sector: "Docente/Diário", label: "Folha Final e Ata de resultados", route: "/laboratorio/folha-final", status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente: ligar às notas gravadas. Layout e cálculo vêm dos modelos enviados; regras extraídas entram como configuração a confirmar, sem impedir prévia." },
  { id: "boletim", sector: "Docente/Diário", label: "Boletim individual e em lote", route: null, status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente: projeção pronta; falta tela ligada às notas gravadas." },
  { id: "ficha-individual", sector: "Docente/Diário", label: "Ficha individual", route: null, status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente a partir do modelo da rede." },
  { id: "diario-impressao", sector: "Docente/Diário", label: "Impressão do Diário no modelo da rede", route: "/diario/documentos", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Frequência imprime; layout legado completo ainda não." },
  { id: "sipe", sector: "OP/SIPE", label: "Planejamento semanal (A4)", route: "/planejamento", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Planejamento grava versões; plano semanal com datas livres e impressão A4 pendentes." },
  { id: "sia-cartao", sector: "SIA", label: "Cartão-resposta e conferência", route: "/avaliacoes-do-professor/cartao-resposta", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Leitura só de imagem enquadrada; sem QR, sem gravação, sem correção de foto inclinada." },
  { id: "sia-prova", sector: "SIA", label: "Prova impressa por versão A–H", route: "/avaliacoes-do-professor", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Versões só após aprovação da OP; PDF final com quebras cuidadas pendente." },
  { id: "alim-relatorios", sector: "Alimentação", label: "Relatórios do Núcleo (previsto, servido, estoque)", route: "/alimentacao-escolar", status: "PARCIAL", dependsOn: "desenvolvimento", reason: "Exportação CSV pela mesma fonte do painel; sem teste autenticado. Mesma fonte do painel e da exportação; ausência ≠ zero." },
  { id: "alim-mapa-compra", sector: "Alimentação", label: "Mapa de compras por fornecedor", route: null, status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente: cadastro de fornecedores/contratos e mapa testáveis com dados sintéticos; NF/contrato reais só são necessários para transações oficiais." },
  { id: "alim-etiquetas", sector: "Alimentação", label: "Etiquetas e coleta de amostras", route: null, status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente: regra de custódia pronta; falta tela, gravação e etiqueta impressa." },
  { id: "pessoal-jornada", sector: "Pessoal", label: "Lotação e jornadas", route: null, status: "PENDENTE", dependsOn: "dados-reais", reason: "Tela e fluxo são engenharia; uso em produção depende da ligação real matrícula funcional × escola." },
  { id: "saeb", sector: "Acompanhamento", label: "Resultados SAEB e devolutivas", route: null, status: "PENDENTE", dependsOn: "desenvolvimento", reason: "Implementação pendente: validação pronta; falta importação e tela." },
];

export function filterCatalog(q: string, sector: string | null, status: DocStatus | null) {
  const t = q.trim().toLowerCase();
  return DOCUMENT_CATALOG.filter((d) => (!sector || d.sector === sector) && (!status || d.status === status) && (!t || `${d.label} ${d.sector}`.toLowerCase().includes(t)));
}
export const SECTORS = [...new Set(DOCUMENT_CATALOG.map((d) => d.sector))];
