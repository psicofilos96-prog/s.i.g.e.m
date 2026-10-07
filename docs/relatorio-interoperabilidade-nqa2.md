# NQA.2 — Simulação operacional integrada e relatório de interoperabilidade (2026-10-07)

Situação: **PASS técnico (camada autenticada)**, PARTIAL no escopo total.
Roteiro: `scripts/nqa2-integrated-simulation.mjs` (fora do bundle). Última execução: 39/39 aprovadas.

## Método
- 8 contas sintéticas efêmeras (`@bo-fixture.invalid`) criadas pelo provisionador BO (0194): Secretaria, Direção, Professor, OP, CIECE, Gestão Pedagógica, Administrador Geral, RH. Cada conta usa o próprio login real contra as permissões do banco (camada `authenticated-layer`; não houve navegador, porque nenhum login interativo foi injetado).
- Nenhuma gravação foi feita com um alvo que pudesse ser aceito: uma gravação aceita entraria em tabela oficial só de acréscimo, que não pode ser apagada.
- Limpeza obrigatória no `finally`: 0 contas restantes e 0 resíduos (pessoas, atuações, encerramentos, políticas, registro).
- Dados oficiais: contagens antes = depois em 11 tabelas (matrículas 9.811, estudantes 9.763, versões cadastrais 55, demais iguais).

## Resultado por módulo
| Módulo | Integração verificada | Isolamento | Autoria / recusa |
|---|---|---|---|
| Secretaria | visão geral, pendências (327) | outra escola: `not-authorized` | — |
| Turmas/Vagas/Livro | vagas (46), Livro (327), enturmação = mesma fonte do Diário | outra escola recusada | histórico: Livro em 2026-01-01 ≤ hoje |
| Mapa | projeção da própria escola | outra escola recusada | Professor não confere; Direção não abre Mapa de outra escola |
| Docente | regências, grade (mesma fonte da aula prevista) | outra escola recusada | Professor não enturma |
| OP/Direção | fiscalização do Diário (janela ≤ 62 dias) | Direção e OP: `access-denied` em outra escola | — |
| Avaliação | métricas sem dado: vazio, nunca zero | — | Secretaria não grava resultados |
| CIECE | — | sem identidade nominal de estudante | não altera cadastro escolar |
| Administração | visão de contas (178), sem credencial | Secretaria não lê; busca não devolve outra escola | Gestão Pedagógica não encerra atuação alheia |
| Apoio (NAE, Qualidade, RH) | — | NAE de outra escola recusado; RH sem dados de estudante | Professor não registra revisão de qualidade |

Correções no próprio roteiro (não no sistema): a fiscalização do Diário recusa com uma linha `access-denied`/`invalid` em vez de erro, e janelas acima de 62 dias são inválidas; a visão de contas tem só o indicador `password_change_required`, sem credencial.

## Gates
Suíte completa: 379 arquivos aprovados. Invariantes profundas: 36/36. Typecheck 0. Build OK. Varredura de segurança: não rodada novamente.

## Pendências
- Ciclo com gravação aceita (matrícula → enturmação → Mapa → Diário → avaliação), com autoria gravada conferida: **PENDENTE** — exige transação revertida como pessoa autenticada (roteiros BO.3/BO.4); este ambiente não pode assumir esse papel (`permission denied to set role authenticated`).
- Telas com login real: **INTERACTIVE_BROWSER_VALIDATION_PENDING**.
- Transporte, Infraestrutura, Busca Ativa, carteirinha, inclusão: fora do cenário (ASSIGNMENT_PENDING / DEPENDE_DECISAO, já registrados).
