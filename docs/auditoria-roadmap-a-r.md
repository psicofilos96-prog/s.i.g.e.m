# Auditoria do roadmap A–R (Cloud real, 05/10/2026)

## Frente R — Portal da Família
**Status: arquitetura PASS; acesso real BLOCKED (sem fonte de vínculo).** Vínculo responsável↔aluno é fato canônico (`guardian_authorizations`, 0 registros); nunca inferido por nome, endereço ou telefone. Sem vínculo, nenhuma família acessa dados; leitura filtrada por vínculo próprio protege contra IDOR/enumeração (`family-portal.test.ts`).

## Quadro
| Frente | Status | Fonte / bloqueador |
|---|---|---|
| A cadastro escolas | PASS | Matriz 2026 |
| B infraestrutura | PASS | 2.970 fatos |
| C turmas + correção temporal | PASS | 698; stand-ins neutralizados |
| D profissionais | PARTIAL | sem lotação/regência |
| E jornada profissional | BLOCKED | fonte inexistente |
| F alunos/matrículas | PARTIAL | sem início efetivo |
| G reconciliação | PASS | projeção derivada |
| H Mapa | PARTIAL | sem regra homologada |
| I Piloto | PARTIAL | INEP 33002053 |
| J Gate | ACCEPTED_WITH_EXCLUSIONS | — |
| K Currículo | BLOCKED | gate + fonte |
| L Diário | BLOCKED | sem regência |
| M Necessidade docente | BLOCKED | sem matriz/regência/jornada |
| N Secretaria | PARTIAL | sem início efetivo |
| O CIECE operacional | PARTIAL | falta console único |
| P BNCC/SAEB | BLOCKED | sem fonte oficial |
| Q OP/Direção | BLOCKED | sem atuações |
| R Família | BLOCKED | sem vínculo responsável |

## Segurança e testes
Nenhuma migration nova em H–R. Executor técnico inacessível a app roles; RLS e capabilities inalteradas. Novo teste: `pilot-school-selection.test.ts`.

## Dívida técnica
Console CIECE unificado; paginação servidor; RLS intencionalmente ausente em 2 tabelas internas (sem grants a app roles).

## Possibilidades futuras (não iniciadas)
Fontes necessárias: calendário escolar 2026 (só limites do ano), datas de ingresso individuais (fato próprio, não derivado do calendário), jornada profissional, matriz curricular homologada, regra do Mapa, BNCC/SAEB oficial, vínculos de responsáveis.

## Gate técnico de fechamento A–R
HEAD auditado: `334a8da0` (rodada H–R = `3b4b6890..334a8da0`).

- **Diff H–R:** 15 arquivos, +232/−0 — 12 docs, `src/features/pilot/pilot-school-selection.ts` + teste + `AGENTS.md`. **Nenhuma migration/DDL nova** (última segue 0110, da Frente F).
- **Suíte completa:** 260 arquivos, 3.402 testes — PASS.
- **Typecheck (tsgo):** PASS. **Build de produção:** PASS.
- **Migration integrity:** PASS. **Audit SQL:** 385 SECURITY DEFINER, 0 sem `search_path`. **git diff --check:** limpo.
- **Security Advisor:** 305 (74 RLS sem policy, 3 DEFINER executável por anon, 228 por authenticated) = baseline da Frente F; 0 novos. Alertas são intencionais (writers SECURITY DEFINER com capability interna; tabelas internas sem grants a app roles); não enfraquecidos.
- **Coerência dos relatórios:** J segue ACCEPTED_WITH_EXCLUSIONS (gate pleno não aceito); K sem mutação de produção; L/M/P/Q/R só arquitetura, operação real BLOCKED; E BLOCKED (sem jornada profissional); F PARTIAL (sem inscrição letiva/participação/alocação). Corrigida a conflação calendário × data de ingresso em 5 docs.

**Resultado final: GATE TÉCNICO A–R PASS.** S não iniciada.

## Atualização temporal (Frente S, 05/10/2026)
2026 = baseline censitário (`historico-importado`); 2027 = primeiro ano operacional. Os bloqueadores "calendário 2026" de F/N/L saem. Participação, alocação e matrícula operacional passam a ser atos humanos de 2027, e não lacunas a preencher em 2026.

## Frente S — fechamento (05/10/2026)
- Migrations 0113 (transição, matrícula por ano, busca exata, baseline profissional como projeção, indicadores) e 0114 (writer do estado do ano sem EXECUTE para service_role).
- Suíte completa: 3.417 de 3.418 na primeira rodada; a falha (campo de data nativo na nova tela) foi corrigida e o conjunto afetado repassou. tsgo limpo; manifesto de migrations atualizado.
- Security Advisor: 317 alertas (antes 305). Os 12 novos são das novas funções SECURITY DEFINER chamáveis por usuário autenticado (todas com sessão + capability, `search_path=''`) e da trilha `exact_lookup_events` sem política (intencional: sem leitura por app roles). Nenhum novo alerta para anon.
- Status: S = IMPLEMENTADA, com operação 2027 AGUARDANDO ATO HUMANO/PROVISIONAMENTO. E segue bloqueada; F segue parcial para 2026.

## Fechamento S.1 (05/10/2026)
- Migrations: 0115 (v6, cadastro escolar de aluno, lotação escolar), 0116 (correção do writer do estado do ano), 0117 (ACL das tabelas novas), 0118 (helpers sem EXECUTE).
- Gate: suíte completa 3.423/3.423; tsgo, build, migration integrity, audit SQL e diff-check aprovados; teste DB S aprovado e sem resíduo; Advisor 317 (+12 sobre 305, todos classificados e intencionais).
- Resultado: Frente S = PASS técnico / READY_FOR_2027_HUMAN_OPERATION. T não iniciada.

## Ambiente canônico (05/10/2026)
Todos os resultados A–S desta auditoria foram obtidos no banco canônico Lovable Cloud `crfqhyqkujhhlbiyhdbc` (ver docs/ambiente-canonico-sigem.md). `vwhvqtdvzbnfffkgoaen` é externo não canônico e não foi usado. Frente S: PASS — READY_FOR_2027_HUMAN_OPERATION — CANONICAL CLOUD VERIFIED.

> Referência posterior: a Frente H evoluiu na Frente T (`docs/mapa-estatistico-2027.md`). O histórico A–R acima permanece inalterado.
