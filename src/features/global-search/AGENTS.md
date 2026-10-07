## Pesquisa global (`0082`–`0086`)
- Só `global_search` (SECURITY INVOKER, RLS de quem pesquisa) devolve resultados; a tela nunca lê tabelas para filtrar no navegador, porque busca ampla seria vazamento transversal.
- Indexa apenas nome/código vigente de estudante, unidade, turma, pessoa, matriz e componente; identificador oficial só por igualdade exata; conteúdo sensível nunca entra, porque busca parcial permitiria enumeração.
- Busca é normalizada (unaccent + lower) com índices trigram e exige todas as palavras; sem busca aproximada por erro de digitação, porque inundava resultados e degradava o banco.
- Buscas recentes não são guardadas, porque termos de busca contêm nomes de estudantes.
- NSEARCH.2: conta de setor vê só resultados cujo destino pertence à estação (`stationScopedHits`), sobre o que o banco já filtrou; nunca amplia, porque filtro de tela só reduz.
