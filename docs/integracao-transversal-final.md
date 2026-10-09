# Integração transversal — NINTEGRATION.FINAL.1

Situação atual: Registro de lote (2026-10-09). Não declara PASS — SIGEM_CROSS_MODULE_INTEGRATION_COMPLETE.

## Provado (leitura sobre 2026 real)
- Fonte única: enturmações (10.295) referem 698 turmas existentes e 9.763 estudantes, todos com matrícula (9.811) — zero órfãos (consultas de integridade, 2026-10-09).
- Diário, CIECE, Mapa e Secretaria leem enturmação só de `class_enrollment_episodes` (AGENTS: `institutional-roster.ts`, CIECE 14.5, Mapa).
- Relatórios/PDF: exportações e Dossiê saem do `report-engine` sobre as mesmas linhas da tela (AGENTS reports / school-management).

## Cenários E2E × bloqueio
| Cenário | Bloqueio real |
|---|---|
| Estudante | 2026 é histórico (writers recusam); 2027 não aberto; tipos de movimentação 0 |
| Profissional | lotações 0; atribuições docentes 0; grade publicada 0 |
| Turma | idem; capacidade/jornada sem fonte |
| Diário | grade/atribuição 0; BQ.5 sem fluxo de homologação; Conselho sem período |
| Mapa | regra de competência 0; snapshots 0 |
| Alimentação | catálogos/cozinhas 0; capabilities não atribuídas; pedidos 0 |
| Inclusão | mediação/AEE/NEI 0 |
| Família | autorizações de responsável 0 |

## Não executado
E2E de writers com fixtures, concorrência/idempotência/rollback ponta a ponta, 2 escolas autenticadas: exigem ano operacional e capabilities homologadas; harness sem login neste ambiente. Testes unitários de idempotência/concorrência por domínio já existem (ver AGENTS de cada módulo).

## Desbloqueio
Abrir 2027 (ou ano de teste) por ato humano; homologar política com capabilities setoriais; tipos de movimentação; regra do Mapa; grade/atribuições; catálogos NAE; vínculos responsável/mediação.
