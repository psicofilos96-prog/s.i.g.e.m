# Revisão de Busca Global e Notificações

Situação atual: Registro de lote (2026-10-08).

## Correção
- Sino de avisos: área de toque 44 px em telas de toque (36 px antes; regra NMOBILE.2).

## Conferido sem mudança
- Busca só por `global_search` (RLS de quem pesquisa); conta de setor reduzida a destinos da estação (`stationScopedHits`); nada é guardado como busca recente.
- Avisos: categorias são agrupamento do `event_kind` existente (nenhum tipo novo); filtro lido/não lido; "Abrir destino" revalida acesso (`open_notification`); acesso encerrado é avisado.
- Contador do sino nunca mostra 0 inventado: sem não lidos ou sem leitura, só "Avisos".
- Headless: /avisos com 1 h1 e sem rolagem lateral no computador e no celular (~2 s).
- Harness institucional: 102 PASS, 0 FAIL (inclui /alunos corrigido no NSUP.3), 0 resíduos.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: avisos e busca com login real.
- Medição de desempenho de `global_search` no banco exige sessão (psql não executa funções).
- DEPENDE_DECISAO: rotas/pontos do Transporte na busca.

Teste: `src/features/notifications/nsearch3.test.ts`.
