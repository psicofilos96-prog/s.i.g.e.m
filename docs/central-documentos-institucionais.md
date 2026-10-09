# Central de Documentos Institucionais (DOCS.PRO.1)

**Situação atual:** Registro de lote — parcial (PASS não declarado).

## Entregue
- `/central-de-documentos`: biblioteca por setor, editor por blocos (subir/descer/remover/adicionar, texto editável, orientação), prévia de impressão em iframe isolado (`sandbox=""`), catálogo de campos, acervo analisado e links aos documentos já emitidos pelos setores.
- `src/features/document-studio/studio-engine.ts`: blocos fechados (cabeçalho, imagem, título, texto rico limitado, campo, lista, tabela, caixa, colunas, linha, QR, assinatura, data/local, número, quebra de página, condição só de presença); página A4 retrato/paisagem, margens, fontes/cores de lista fechada, rodapé, numeração, marca d'água; texto sempre escapado; tokens só do catálogo; ciclo Rascunho → Em revisão → Homologado → Substituído/Arquivado como projeção de eventos (autor não homologa a própria versão); emissão congelada (versão exata, fatos, issuedAt, ator, SHA-256) que recusa modelo não homologado e token sem leitura autorizada.
- `acervo.ts`: 33 itens do acervo classificados (nenhum é modelo oficial homologado da rede; Ficha de Matrícula, Termo de Imagem e Termo de Faltas são modelos de UMA escola). Dados pessoais dos arquivos preenchidos não foram copiados.
- `base-templates.ts`: 14 modelos-base marcados "Rascunho institucional — não homologado" — Declaração de Matrícula, Declaração Escolar, Atestado de Escolaridade, Renovação, Transferência, Ficha de Matrícula, Livro de Matrícula, Termo de Imagem, Termo de Ciência de Faltas, Ofício, Ata, Termo de Visita, Não Conformidade (Alimentação), Lista de documentos de matrícula.
- 14 testes (`studio-engine.test.ts`).

## Pendências (bloqueiam o PASS)
- DOCS_LIFECYCLE_DB_PENDING: estados/eventos do modelo não estão no banco; a tela não grava versões nem homologa. A emissão real continua só por `emit_school_document_v3` (blocos v1).
- DOCS_READERS_PENDING: responsável, profissional, ato, vida escolar e destino de transferência não têm leitura autorizada; modelos que os usam ficam não emitíveis.
- DOCS_QR_PENDING: QR é o código de verificação em caixa, sem imagem de QR.
- DOCS_PDF_RASTER_PENDING: pageCount/overflow/raster não testados; PDF = impressão do navegador.
- Permissão por setor para editar modelos: depende da capability no banco (não criada).
- ACL/temporalidade/a11y/full suite autenticados não executados neste lote.

## DOCS.PRO.2 — pacote por setor (2026-10-09)
+27 modelos-base (total 41) em `base-templates.ts` (`sectorPack`), cobrindo Secretaria (vida escolar), Direção/OP (Dossiê, Conselho, encaminhamento, decisão, acompanhamento), Docente (diário, frequência Presente/Falta, registro, planejamento, notas, SIPE/SIA), CIECE (folha do Mapa, Censo/Qualidade, reconciliação, rede), Avaliação (resultados, metodologia), Alimentação (solicitação, recebimento, estoque, fechamento), Inclusão (sem campo clínico), Família (comprovante, carteirinha) e Admin (acessos, prontidão). Todos "Rascunho institucional — não homologado"; nenhum oficial. Teste `sector-pack.test.ts` (cobertura, validação, ids, sem campo clínico). Pendências mantidas: homologação no banco (DOCS_LIFECYCLE_DB_PENDING), QR como imagem, PDF rasterizado.

## NPRINT.FINAL.1 — auditoria de impressão do Studio (2026-10-09)
45 PDFs gerados headless (41 modelos + Livro com 0/1/10/100/1000 linhas), nomes longos e acentos. Resultado: A4 retrato/paisagem conforme modelo; Livro 1000 linhas = 51 páginas com cabeçalho de tabela repetido; numeração "Página X de Y" em todas; acentos corretos; tabela vazia = "Sem registros". Corrigido: rodapé sobrepunha a última linha da tabela (passou à margem `@page`, texto escapado) e assinaturas se separavam da data. Fora deste lote: Calendário, Mapa, Diário, relatórios, Alimentação e carteirinha usam renderizadores próprios e não foram rasterizados; QR é código textual, não imagem; logos ausentes no acervo.
