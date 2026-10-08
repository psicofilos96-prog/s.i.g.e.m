# Relatório de simulação do piloto — 2026-10-05

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Ambiente
- Isolado em memória (`src/features/pilot/pilot-simulation.test.ts`): cliente do banco substituído por um falso que conta chamadas e simula latência. **Nada foi gravado na Cloud.**
- Prova adicional no banco: 5.000 unidades sintéticas inseridas numa transação e desfeitas (`ROLLBACK`); contagem posterior de `sim-%` = 0.
- Limite: a conta técnica do ambiente não tem permissão para executar os writers/readers da cadeia completa; a jornada SQL integral segue coberta pelos testes SQL com rollback já existentes (`supabase/tests/`), não por esta simulação.

## Resultados
| Volume | Chamadas | Pico simultâneo | Observação |
|---|---|---|---|
| 300 turmas / 9.000 matrículas | 2.702 | 72 | aprovado |
| 1.000 turmas / 30.000 matrículas | 9.002 | 72 | aprovado (tempo dominado pelo simulador) |

## Achados
1. **Corrigido:** a leitura de prontidão abria todas as chamadas ao mesmo tempo (pico de 9.000 com 1.000 turmas). Agora limita a 8 turmas por vez (pico 72).
2. **Dívida (N+1 por desenho):** 9 leituras por turma. Para uma escola típica (< 60 turmas) é aceitável; para a rede inteira exige um leitor agregado por escola (nova função no banco, fora deste bloco).
3. **Concorrência:** 50 gravações simultâneas de progresso a partir da mesma base ⇒ exatamente uma vence.

## Não executado
- Restore do backup; smoke test com contas reais; carga real contra o banco.
