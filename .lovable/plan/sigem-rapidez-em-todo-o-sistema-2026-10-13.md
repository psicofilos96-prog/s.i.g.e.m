# SIGEM — rapidez em todo o sistema

Meta: cada tela do menu abre em até 2 segundos, em qualquer setor. Nenhuma tela pode ficar presa em "Carregando". A regra de quem vê o quê não muda.

## Etapa 1 — Medir tudo, setor por setor
- Entrar com os logins de teste de cada setor: CIECE, Supervisão, Secretaria, Direção de uma escola, OP, Avaliação, Alimentação, Inclusão e Transporte.
- Abrir cada item do menu e anotar: abre, fica presa, dá erro ou mostra "sem acesso". Anotar também o tempo de cada tela.
- O resultado é uma tabela de setor × tela com o tempo antes da correção.

## Etapa 2 — Corrigir as causas no banco (maior ganho)
- Rever as regras de leitura que fazem a conferência de permissão linha por linha. Elas passam a conferir uma única vez por consulta, como foi feito hoje em Turmas e no Censo.
- Rever as consultas pesadas que fazem várias varreduras por turma ou por escola. Elas passam a usar uma soma única.
- Criar índices apenas onde a medição mostrar consulta lenta.
- Corrigir permissões faltando, como o caso do Censo de hoje.

## Etapa 3 — Corrigir as causas nas telas
- Remover leituras em cadeia: tudo o que pode ser buscado ao mesmo tempo passa a ser buscado junto.
- Guardar por alguns minutos o que muda pouco, como permissões, lista de escolas e calendário, para não perguntar de novo a cada clique.
- Listas grandes passam a vir paginadas e filtradas pelo servidor.
- Pré-carregar a tela quando o mouse passa sobre o item do menu, para que o clique abra na hora.
- Toda tela que demorar mostra, depois de alguns segundos, o resultado, "sem dados" ou um erro com "Tentar novamente". Nunca fica girando para sempre.

## Etapa 4 — Provar
- Repetir a medição da Etapa 1 e montar a tabela de antes e depois.
- Criar um teste automático que falha se alguma tela voltar a passar de 2 segundos ou a ficar presa.

## Depois disso
Visual simplificado do Início, do Mapa Estatístico e dos Alunos, para você aprovar, conforme o plano anterior.

## Detalhes técnicos
- Bench: `/tmp/browser` estendido em `scripts/perf-loading-gate-bench.py` com sessão de setor (`lovable auth-session --user`), saída JSON em `docs/`.
- Banco: `slow_queries` + `EXPLAIN ANALYZE`; políticas com chamadas de capacidade dentro de `(SELECT ...)` (initplan) ou `IN (SELECT set_fn())`; funções INVOKER com subconsultas correlacionadas por turma reescritas com `GROUP BY`/`LEFT JOIN`; mesma semântica, provada por contagem igual antes/depois.
- Front: `staleTime` em `QUERY_CLIENT_DEFAULTS` para leituras de referência, `defaultPreload: "intent"` no router, `Promise.all` no lugar de awaits sequenciais, `readPages` só onde for necessário.
- Teste de regressão de desempenho como etapa opcional em `npm run verify` (não roda no CI, que não tem sessão).
- RLS nunca afrouxada; nenhum dado novo inventado.
