# Mapa Estatístico — Diagnóstico do gerador atual e plano de reconstrução

## Diagnóstico (o que causa cada problema)

O PDF é um documento HTML próprio (não é captura de tela), impresso pelo navegador. O problema é a combinação de quatro fatores:

1. **Conteúdo (principal causa).** O gerador percorre uma lista genérica de "células" do Mapa e escreve cada uma como linha `Item | Valor | Origem`. Não existe tabela própria por seção. Por isso a III vira lista de turmas com "Indeterminado", a V vira cinco contagens e não há relações nominais. Aparência não resolve isso: falta montar os dados certos.
2. **Diagnóstico misturado ao documento.** O estado técnico de cada célula ("Indeterminado", "Sem regra homologada", "Sem fonte no SIGEM") e a coluna "Origem" vão direto para o PDF. São informações da conferência, não da escola.
3. **Margens frágeis.** As margens dependem só da regra de página do navegador (`@page margin`). Se a impressão for feita com "Margens: nenhuma" ou "Ajustar à página", elas somem e o conteúdo encosta na borda. A capa também força margem zero e largura fixa de 297 mm, o que no Chrome gera deslocamento. Não há uma "folha" com área segura própria.
4. **Paginação e tamanhos.** Todas as tabelas usam largura fixa por porcentagem (22% / 24%) independentemente do conteúdo. Títulos podem ficar sozinhos no fim da folha. O fechamento (observações + assinaturas) é um bloco que não pode quebrar e, por isso, pula para uma folha quase vazia.

A biblioteca de PDF não é a causa: não há biblioteca, e isso é bom (o texto continua selecionável e nítido).

## Plano de correção

### 1. Três ambientes separados
- **Gestão**: a tela atual do Mapa (consulta e acompanhamento), sem mudança de regra.
- **Conferência**: nova aba/página "Conferência do Mapa" com pendências, fontes ausentes, regras não homologadas e divergências de totais (reaproveita o que hoje vai para o PDF).
- **Documento oficial**: o PDF reconstruído, sem coluna "Origem" e sem estados técnicos.

### 2. Motor de página A4 deitado
- Folha física 297 × 210 mm com área segura própria de 12 mm em cada lado (no próprio documento, não só no navegador). Funciona mesmo se a pessoa imprimir com "Margens: nenhuma".
- Cabeçalho institucional compacto (brasão, Prefeitura/Secretaria, escola, competência) e rodapé ("Página X de Y", data de geração) com espaço reservado.
- Escala 100%, sem `nowrap` geral; nomes, cargos e observações quebram linha onde faz sentido.
- Títulos nunca ficam sozinhos no fim da folha; tabelas longas continuam na folha seguinte repetindo o cabeçalho; linhas não se partem.
- Tipografia: seções 11,5 pt, subtítulos 9,5 pt, tabelas 8,5 pt, rodapé 7,5 pt.

### 3. Tabelas por seção (fiéis ao modelo original)
- **I — Identificação**: ficha em duas colunas (unidade, INEP, endereço, direção, secretaria, competência, data de referência).
- **II — Movimentação**: matriz por modalidade (Ed. Infantil, Fundamental, EJA) e etapa: matrícula anterior, entradas, saídas, total atual, turmas, regentes, distribuição por turno.
- **III — Matrícula por etapa e turno**: modalidade · etapa · turma · 1º turno · 2º turno · 3º turno · integral, agrupado por etapa com subtotais e total geral.
- **IV — Entrada e saída**: relações nominais separadas — Recebidos, Transferidos, Evadidos, Desistentes/Cancelados e Remanejados (este último não altera o total, conforme decisão já registrada).
- **V — Pessoal**: relações nominais por categoria A a K, com nome, matrícula (ou ID profissional), cargo, função, turma, turno, vínculo e observações.
- **VI — Visitas**: cargo, visitante, data e finalidade.
- Dado ausente aparece como "—" com uma nota discreta de rodapé da tabela ("campo ainda não preenchido no SIGEM"); nunca vira zero e nunca é inventado.

### 4. Identidade visual
- Capa mantida como base, enriquecida: brasão, logotipo do SIGEM, nome completo da escola, faixa azul institucional com detalhes em dourado, foto institucional de Itaperuna já existente no sistema (só na capa).
- Páginas internas: títulos em azul, cabeçalhos de tabela em azul-claro, linhas finas visíveis na impressão, subtotais destacados, sem imagens grandes.

### 5. Encerramento equilibrado
- Observações ocupam só o espaço necessário.
- Assinaturas (Secretaria Escolar, Direção da Unidade, Setor de Informação e Estatística quando houver), data de entrega e competência ficam na parte de baixo da última folha de conteúdo; só vão para folha nova se não couberem.
- Mapa sem aprovação sai com a marca "Documento não oficial — fotografia dinâmica" e nunca como fechado.

### 6. Validação visual antes de entregar
Gerar e olhar folha por folha: documento curto (5 folhas), médio (20) e longo (40+), nomes muito longos, muitas turmas, muito pessoal, seções vazias, com e sem capa, e zoom de 50% a 200%. Corrigir e repetir até nenhuma palavra, coluna ou assinatura ser cortada. Testes automáticos garantem: área segura de 12 mm, cabeçalho repetido, sem coluna "Origem" e sem estados técnicos no documento oficial, ausência nunca vira zero.

### O que não muda
Regras de matrícula, lotação, movimentação, fechamento e aprovação; quem pode ver o quê; calendário.

## Pontos que dependem de dados (serão mostrados na Conferência, não inventados)
- Turno por turma vem da jornada de 2026 já gravada; turma sem jornada aparece como "—".
- Relações de entrada/saída dependem dos tipos de movimentação cadastrados; hoje há poucos, então as listas podem sair vazias com a nota correspondente.
- Categorias A a K do pessoal usam cargo/função dos vínculos; quem não se encaixa em nenhuma categoria aparece em "Outros" na Conferência.

## Detalhes técnicos
- `map-print-theme.ts`: substituir dependência de `@page margin` por contêiner `.sheet` (297×210 mm, padding 12 mm) + `@page{size:A4 landscape;margin:0}`; capa como `.sheet` própria; `break-after:avoid` em h2/h3, `break-inside:avoid` em `tr` e no bloco de assinaturas apenas.
- `map-structures.ts`: `renderMapDocument` passa a receber um modelo de documento por seção (`MapOfficialDocument`) em vez de iterar células; novo `buildOfficialDocument` (puro) monta as matrizes a partir do snapshot + listas nominais lidas pela sessão do usuário (RLS) no servidor.
- `statistical-map.functions.ts`: leitura adicional de jornadas por turma, movimentações nominais e vínculos de pessoal, sempre com o cliente da sessão.
- Nova página/aba de Conferência reutilizando `cellValue`/`originBadge`.
- Mesmo motor aplicado ao PDF do mapa declarado (`declared-map-document.ts`).
- Testes atualizados em `map-structures.test.ts`, `pdf-render-audit.test.ts` e novo teste de layout; render headless + rasterização (`pdftoppm`) para inspeção de cada folha.
