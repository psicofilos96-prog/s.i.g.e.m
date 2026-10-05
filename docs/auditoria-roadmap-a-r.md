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
Fontes necessárias: calendário escolar 2026, datas de ingresso, jornada profissional, matriz curricular homologada, regra do Mapa, BNCC/SAEB oficial, vínculos de responsáveis.
