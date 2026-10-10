/**
 * Catálogo documental por setor: diz, para cada documento, onde ele é emitido hoje e
 * se está COMPLETO, PARCIAL ou BLOQUEADO, com a razão precisa. Só aponta para telas que
 * já emitem pelo motor comum (report-engine / Studio); nunca é um gerador paralelo.
 */
export type DocStatus = "COMPLETO" | "PARCIAL" | "BLOQUEADO";
export type CatalogDoc = { id: string; sector: string; label: string; route: string | null; status: DocStatus; reason: string };

export const DOCUMENT_CATALOG: readonly CatalogDoc[] = [
  { id: "relatorio-livre", sector: "Central", label: "Relatório personalizado (CSV/XLSX/PDF)", route: "/relatorios", status: "PARCIAL", reason: "Gerador comum funciona; geração autenticada com dados reais e isolamento entre escolas ainda não testados. Gerador comum com leitura sob as permissões de quem gera e paginação acima de 1.000 linhas." },
  { id: "studio", sector: "Central", label: "Documento do Studio com QR de verificação", route: "/central-de-documentos", status: "COMPLETO", reason: "Modelo homologado, emissão congelada com hash e verificação pública por código opaco." },
  { id: "verificacao", sector: "Central", label: "Verificação pública de documento", route: "/verificar/documento/$codigo", status: "COMPLETO", reason: "Resposta igual para código inválido e inexistente; sem dado pessoal." },
  { id: "doc-escolares", sector: "Secretaria", label: "Declarações e atestados escolares", route: "/documentos-escolares", status: "PARCIAL", reason: "Só tipos com modelo homologado; demais aparecem como modelo pendente." },
  { id: "movimentacao", sector: "Secretaria", label: "Relatório de movimentação escolar", route: "/relatorios", status: "PARCIAL", reason: "Movimentações da carga de 2026 não têm data efetiva real (data técnica 31/07)." },
  { id: "mapa-mensal", sector: "Estatística/CIECE", label: "Mapa mensal por escola e consolidado", route: "/mapa-censo-2026", status: "PARCIAL", reason: "Fev–set sem evidência datada ficam como estimativa parcial; 6 escolas com INEP em revisão." },
  { id: "dossie-anual", sector: "Estatística/CIECE", label: "Dossiê anual por escola e rede", route: null, status: "BLOQUEADO", reason: "Montagem ainda não implementada sobre as fontes; sem tela." },
  { id: "folha-final", sector: "Docente/Diário", label: "Folha Final e Ata de resultados", route: "/laboratorio/folha-final", status: "BLOQUEADO", reason: "Só existe laboratório com dados de simulação; não lê notas gravadas e regras das planilhas aguardam confirmação de vigência." },
  { id: "boletim", sector: "Docente/Diário", label: "Boletim individual e em lote", route: null, status: "BLOQUEADO", reason: "Projeção pronta, sem tela ligada às notas gravadas." },
  { id: "ficha-individual", sector: "Docente/Diário", label: "Ficha individual", route: null, status: "BLOQUEADO", reason: "Ainda não implementada." },
  { id: "diario-impressao", sector: "Docente/Diário", label: "Impressão do Diário no modelo da rede", route: "/diario/documentos", status: "PARCIAL", reason: "Frequência imprime; layout legado completo ainda não." },
  { id: "sipe", sector: "OP/SIPE", label: "Planejamento semanal (A4)", route: "/planejamento", status: "PARCIAL", reason: "Planejamento grava versões; plano semanal com datas livres e impressão A4 pendentes." },
  { id: "sia-cartao", sector: "SIA", label: "Cartão-resposta e conferência", route: "/avaliacoes-do-professor/cartao-resposta", status: "PARCIAL", reason: "Leitura só de imagem enquadrada; sem QR, sem gravação, sem correção de foto inclinada." },
  { id: "sia-prova", sector: "SIA", label: "Prova impressa por versão A–H", route: "/avaliacoes-do-professor", status: "PARCIAL", reason: "Versões só após aprovação da OP; PDF final com quebras cuidadas pendente." },
  { id: "alim-relatorios", sector: "Alimentação", label: "Relatórios do Núcleo (previsto, servido, estoque)", route: "/alimentacao-escolar", status: "PARCIAL", reason: "Exportação CSV pela mesma fonte do painel; sem teste autenticado. Mesma fonte do painel e da exportação; ausência ≠ zero." },
  { id: "alim-mapa-compra", sector: "Alimentação", label: "Mapa de compras por fornecedor", route: null, status: "BLOQUEADO", reason: "Sem cadastro de fornecedores/contratos/empenhos: nenhum arquivo-fonte enviado." },
  { id: "alim-etiquetas", sector: "Alimentação", label: "Etiquetas e coleta de amostras", route: null, status: "BLOQUEADO", reason: "Regra de cadeia de custódia pronta, sem tela nem gravação." },
  { id: "pessoal-jornada", sector: "Pessoal", label: "Lotação e jornadas", route: null, status: "BLOQUEADO", reason: "Nenhuma matrícula funcional ligada a escola no cadastro; jornadas profissionais 0." },
  { id: "saeb", sector: "Acompanhamento", label: "Resultados SAEB e devolutivas", route: null, status: "BLOQUEADO", reason: "Validação de arquivo pronta, sem importação nem tela." },
];

export function filterCatalog(q: string, sector: string | null, status: DocStatus | null) {
  const t = q.trim().toLowerCase();
  return DOCUMENT_CATALOG.filter((d) => (!sector || d.sector === sector) && (!status || d.status === status) && (!t || `${d.label} ${d.sector}`.toLowerCase().includes(t)));
}
export const SECTORS = [...new Set(DOCUMENT_CATALOG.map((d) => d.sector))];
