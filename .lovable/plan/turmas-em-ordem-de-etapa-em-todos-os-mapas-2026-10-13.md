# Turmas em ordem de etapa em todos os Mapas

## Ordem
1. Educação Infantil — creche (0 a 3), unificada (0 a 5), pré-escola (4 e 5)
2. Fundamental I — 1º ao 5º ano, depois multisseriadas/correção de fluxo
3. Fundamental II — 6º ao 9º ano
4. EJA — 1º segmento, 2º segmento, multietapas
5. AEE e atividade complementar
6. Turmas sem etapa informada (no fim)

Dentro de cada grupo, as turmas seguem o ano e depois o nome (ex.: 1º ANO 100, 1º ANO 101, 2º ANO 200...).

## De onde vem a etapa
Cada uma das 698 turmas já tem a etapa declarada na relação de turmas do Censo 2026. Ela é usada **só para ordenar a lista**: não muda números, totais, cálculos nem o cadastro. Quando uma turma não tiver etapa, ela vai para o fim, sem palpite pelo nome.

## Onde vale
- Mapa Estatístico da escola (Estrutura III e qualquer outra lista de turmas)
- Mapa mensal 2026
- Mapa da rede e Consolidado SEMED, nas listas de turmas
- Planilha/PDF exportados saem na mesma ordem da tela

## Detalhes técnicos
- Novo módulo puro `src/features/classes/class-stage-order.ts`: `stageRank(etapaDeEnsino, tipoDeTurma)` com tabela fixa dos valores observados em `class_census_declarations` (campos "Etapa de ensino" e "Tipo de turma") e `compareClasses(a, b)` = rank → ano extraído do texto da etapa → nome (`localeCompare` pt-BR, numérico).
- Leitura: uma consulta em lote por escola em `class_census_declarations` (campos acima, sob a RLS de quem consulta), feita junto da leitura dos nomes em `statistical-map.functions.ts`, `network-projection.functions.ts` e no carregador do Mapa mensal; resultado entra no DTO como `stageRank`.
- Telas e exportações ordenam por `compareClasses`; nenhuma gravação.
- Testes: ordem Infantil < Fund. I < Fund. II < EJA < AEE < sem etapa; "2º ANO" antes de "10º"/numérico natural; turma sem etapa no fim.
- Verificação: abrir com a conta CIECE uma escola com Infantil + Fundamental e conferir a ordem por captura de tela.
