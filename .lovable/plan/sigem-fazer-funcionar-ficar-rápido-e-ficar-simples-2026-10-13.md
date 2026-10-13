# SIGEM — fazer funcionar, ficar rápido e ficar simples

O trabalho vai em três frentes, nesta ordem. Uma frente só começa quando a anterior estiver provada na tela, com login de setor de verdade.

## Frente 1 — Todo módulo abre em todo setor (primeiro)
- Entrar como cada login de setor (CIECE, Supervisão, Secretaria, Direção de uma escola, OP, Avaliação, Alimentação, Inclusão, Transporte) com contas técnicas de teste e abrir cada item do menu.
- Gerar uma tabela simples: setor × tela → abre / fica carregando / dá erro / sem acesso.
- Corrigir cada tela que fica parada em "Carregando". Exemplo: Mapa Estatístico no login da CIECE. Causa provável: a tela espera uma atribuição pessoal e ignora a função do setor, como já aconteceu com a Alimentação.
- Regra: nenhuma tela pode ficar carregando para sempre. Depois de alguns segundos, ela mostra o resultado, "sem dados", "sem acesso" ou um erro com "Tentar novamente".
- Tirar do menu de cada setor o que ele não pode abrir.

## Frente 2 — Rapidez
- Medir o tempo de abertura de cada tela antes e depois, com login de setor.
- Remover os carregamentos em cadeia: hoje, uma consulta espera a outra. Também remover as consultas repetidas.
- Paginar e filtrar no servidor as listas grandes: alunos, servidores e turmas.
- Criar índices no banco apenas onde a medição mostrar consulta lenta.
- Meta: as telas principais abrem em até 2 segundos.

## Frente 3 — Visual simples e intuitivo
- Cada tela passa a ter um título, uma frase de orientação e uma ação principal visível.
- Remover as caixas repetidas, como "Você está em…" e "O que isso significa?" juntas, além dos cartões dentro de cartões e dos textos longos.
- Menu mais curto por setor: só os itens daquele setor, com nomes claros e sem rótulos cortados.
- Início de cada setor: "o que precisa de você hoje", com no máximo 4 a 6 atalhos grandes.
- Aplicar primeiro em 3 telas-modelo: Início, Mapa Estatístico e Alunos. Você aprova o visual, e só depois ele é estendido às demais telas.

## Detalhes técnicos
- Portões de sessão/capacidade antes de qualquer leitura (PERF.LOADING.1); aceitar `sector_station_grants` (`engagement_id = null`) nas fontes que ainda exigem atuação pessoal.
- Timeout + estado de erro governado em `SkeletonState`/workspaces; varredura com `scripts/perf-loading-gate-bench.py` estendida para sessão de setor via `harness-gate`.
- `useSuspenseQuery` + loaders, `readPages`, `staleTime` adequado; índices só com `EXPLAIN` como evidência.
- Simplificação feita nos componentes compartilhados (AppShell, TaskGuide, PageHeader, navegação), não tela a tela.
- RLS não é afrouxada; nada de dado inventado.
