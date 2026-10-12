# Gestão de Pessoas — Fechamento do Lote 24

Situação atual: Registro de lote (2026-10-12). Fonte da matriz: `src/features/professionals/people-closure.ts` (conferida por `people-closure.test.ts`).

## Evidência reproduzível
- Commit base: `039cfaac8d4710431ad83a1f1410b84406b450e6` (o commit deste lote é gerado pela plataforma ao fim da entrega).
- `bunx vitest run src/features/professionals src/test/invariants` → 514 testes aprovados.
- `bunx tsgo --noEmit` → sem erros após correção no teste do lote.
- Prova SQL `supabase/tests/gp23_people_rls_isolation.sql` (termina em RAISE, nada persiste): gp23-ok A:1/1 B:2/2 sem-cap:0 escrita-direta:negada.
- Migration 0383 (correção da policy de vínculos) aplicada.

## Resumo
| | persistido+tela | persistido | núcleo testado | bloqueado |
|---|---|---|---|---|
| 37 seções | 3 | 5 | 24 | 5 |
| 18 critérios | 1 | 3 | 12 | 2 |

"Núcleo testado" = regra pura com teste, sem gravação institucional. Nenhuma linha está homologada.

## Bloqueios normativos e institucionais
1. Política homologada atribuindo capacidades de RH a pessoas reais (consultar-afastamentos, exportar-registro-funcional, ler/registrar-atos-pessoal).
2. Setores que veem o menu e a página Gestão de Pessoas.
3. Catálogo oficial de cargos/funções e lista oficial de tipos de ato.
4. Regras de duração de hora-aula por etapa e de efeito de afastamento.
5. Critérios de dimensionamento não docente e quem os aprova.
6. Competências por etapa da atribuição e da substituição.
7. Homologação humana dos fluxos (critério 18, seção 37).

## Não comprovado
E2E autenticado no navegador; verificação móvel autenticada; dados reais de pessoal; qualquer ato oficial.
