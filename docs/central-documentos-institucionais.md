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
