# Etapa 7A — Turmas e organização escolar (UX)

Criar a consulta e a leitura de turmas mostrando que uma turma existe dentro de um
contexto institucional e temporal, e nunca como "nome + série + turno + professor".
Sem backend, sem persistência, sem criação/edição de turma.

## Rotas

- `/turmas` — consulta densa de turmas fictícias.
- `/turmas/$id` — leitura da turma, com Visão geral funcional.
- Um item novo "Turmas" no grupo já existente da navegação lateral. Nada da barra é
  redesenhado; Início, Login e identidade permanecem intactos.

## Consulta `/turmas`

Cabeçalho operacional + pesquisa + barra de filtros + tabela densa + paginação
demonstrativa + os estados já padronizados (carregando, sem resultados, erro, acesso
negado, dados desatualizados).

Colunas enxutas: identificação da turma, unidade, período letivo, organização
acadêmica, agrupamentos atendidos, turno e jornada (informações distintas na mesma
coluna, com rótulos próprios), situação contextual.

Filtros conceituais: período letivo, unidade, oferta/organização, agrupamento, turno.
Ação "Nova turma" visível e desabilitada.

## Leitura `/turmas/$id`

Abas: Visão geral (funcional) e Estudantes, Componentes, Profissionais, Horários,
Histórico como hipóteses de UX desabilitadas.

Visão geral em seções semânticas (não coleção de cartões):

1. Identificação — nome, código, situação contextual.
2. Contexto acadêmico — unidade (com acesso à unidade), período letivo, oferta
   educacional e organização acadêmica, cada um nomeado separadamente, com nota de que
   período letivo não é ano civil nem período avaliativo.
3. Organização da turma — lista dos agrupamentos atendidos, um item por agrupamento
   (ano, fase ou agrupamento da Infantil), nunca concatenados num texto opaco; turma de
   organização simples mostra um único item, sem ruído.
4. Jornada e turno — dois conceitos separados, com nota de que jornada integral é
   organização de tempo e ampliação, não um "sim/não".
5. Matriz curricular aplicável — apenas referência contextual (nome, versão, vigência)
   com acesso ao detalhe da matriz; a estrutura curricular não é copiada para a turma.
6. Síntese demonstrativa — quantidade fictícia de estudantes e indicação de vínculos
   futuros, marcada como não oficial. Sem lista de alunos, matrícula ou atribuição.
7. Histórico contextual — linha do tempo demonstrativa. Turma encerrada continua legível
   com o período, a organização e a matriz registrados naquele momento, sem depender do
   cadastro atual.

## Dados fictícios

Arquivo de fixtures isolado da interface, com origem declarada e aviso de que nada é
cadastro oficial de Itaperuna; turmas apenas nas instituições já fictícias. Exemplos:
turma simples do Fundamental, Educação Infantil, EJA por fases, multietapa com três
agrupamentos, turma de jornada integral e uma turma encerrada de período anterior.
Cada turma guarda o contexto registrado (período, organização, matriz aplicada).

## Detalhes técnicos

- `src/features/classes/classes-data.ts`: tipos `DemonstrationClass` (unitId, academicPeriod
  com rótulo/nota, offerId, academicOrganization, `groupings: Array<{label, kind, note}>`,
  `shift`, `journey` separados, `matrixId` + snapshot contextual, `situation`,
  `demonstrativeHeadcount`, `historyEntries`), fixtures, `getDemonstrationClass`,
  `getClassOfferContext`, `classSituationTone`, `classDetailAreas`, listas `DEMO_*`
  para filtros.
- `src/features/classes/classes-list-page.tsx` e `class-detail-page.tsx`, reutilizando
  `OperationalPageHeader`, `DataGrid`, `FilterBar`, `DefinitionList`, `DetailSection`,
  `AuditTimeline`, `StatusBadge`, `EmptyState`.
- Rotas `src/routes/turmas.tsx` (layout com `Outlet`), `turmas.index.tsx`,
  `turmas.$id.tsx`, cada folha com `head()` próprio.
- `src/config/navigation.ts` e `app-shell.tsx`: novo destino `/turmas`;
  `operational.tsx`: `parent.to` aceita `/turmas`.
- `src/test/router-harness.tsx`: rotas de turmas.
- `src/features/classes/classes-routes.test.tsx`: listagem, busca/filtros, detalhe válido,
  não encontrada, turma → matriz, turma simples, multietapa, EJA por fases, distinção
  período letivo × organização, turma histórica, abas futuras desabilitadas,
  acessibilidade básica. Os 53 testes atuais permanecem.
- Validação: testes, tipos, análise e compilação.
