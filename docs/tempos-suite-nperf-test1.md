# NPERF.TEST.1 — tempos da suíte de testes

## Situação atual (2026-10-12)
- Classe: **Registro de lote**. Em conflito, prevalecem os `AGENTS.md`.

## Medição (sandbox, 16 núcleos, `bun run test`)
| | Antes | Depois |
|---|---|---|
| Arquivos | 975 | 976 (+1 guarda de ambientes) |
| Testes aprovados | 7245 (7 pulados) | 7247 (7 pulados) |
| Duração total | 715,8 s (ambiente jsdom 70%, setup 23%) | 139,7 s |

## Causa e correção
- Todo arquivo subia jsdom, inclusive os 865 `.test.ts` de regra pura. Agora `vitest.config.ts` tem dois projetos: `node` (`.test.ts`) e `dom` (`.test.tsx` + `DOM_TS_TESTS`, lista verificada por execução).
- Setup dividido: `src/test/setup-common.ts` (modo do Diário, limpeza de sessão) e `src/test/setup.ts` (só DOM).
- `src/test/test-environments.test.ts` garante que todo teste cai em exatamente um projeto; nenhum teste foi excluído nem pulado.
- Deep continua em job próprio (`test:deep`, job `deep` do CI).

## Arquivos mais lentos (antes, tempo do arquivo)
transfer-workspace 50 s; person-workspace 48 s; professional-identity-workspace 46 s; professionals-vinculos 43 s; enrollment-workspace 35 s; class-workspace 34 s. Todos `.tsx` de tela; rodam em paralelo e não foram alterados.

## Pendências
- Tempo no runner do GitHub (4 núcleos) a conferir no próximo run.
