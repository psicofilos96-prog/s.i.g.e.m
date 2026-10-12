# Mediador Escolar — aceite técnico (Lote 20)

## Situação atual
Classe: Registro de lote (2026-10-12, base c830452f). Gerado de `src/features/school-mediator/mediator-acceptance.ts`, conferido por `mediator-acceptance.test.ts`. Aceite TÉCNICO: nenhuma seção está homologada institucionalmente; isso exige avaliação humana competente.

## Evidência
- Suítes school-mediator + privacy: 24 arquivos, 136 testes, todos passando; checagem de tipos limpa.
- Sem login: tabelas de inclusão e emissões responderam 401; funções de inclusão sem EXECUTE para anônimo.
- Nenhuma falha encontrada nos Lotes 17–20.

## Matriz das 30 seções
| # | Seção | Módulos | Status | Bloqueio |
|---|---|---|---|---|
| 1 | Finalidade do perfil | mediator-architecture.ts | nucleo-testado | — |
| 2 | Princípios orientadores | mediator-architecture.ts | nucleo-testado | — |
| 3 | Objetivos estratégicos | mediator-architecture.ts | nucleo-testado | — |
| 4 | Configuração das funções | mediator-architecture.ts | bloqueado | Atribuições municipais das três funções não verificadas; coluna de função da designação não decidida. |
| 5 | Arquitetura do perfil (menu) | mediator-panel.ts | bloqueado | Permissão de menu /mediador não decidida. |
| 6 | Painel geral | mediator-panel.ts | tela+nucleo | 0 designações e 0 concessões NEI no banco: sem teste com sessão real. |
| 7 | Minha agenda | mediator-panel.ts | nucleo-testado | Tela Minha Agenda não construída. |
| 8 | Estudantes acompanhados | mediator-designations.ts, mediator-student-file.ts | nucleo-testado | 0 designações e 0 concessões NEI no banco: sem teste com sessão real. |
| 9 | Orientações de apoio | mediator-central.ts, mediator-guidance-flow.ts | tela+nucleo | 0 designações e 0 concessões NEI no banco: sem teste com sessão real. |
| 10 | Registro diário de acompanhamento | mediator-daily-record.ts | nucleo-testado | Sem gravação oficial do mediador no banco. |
| 11 | Categorias de apoio | mediator-support-categories.ts | bloqueado | Catálogo de categorias não homologado. |
| 12 | Participação escolar | mediator-participation.ts | nucleo-testado | Sem gravação oficial do mediador no banco. |
| 13 | Promoção da autonomia | mediator-participation.ts | nucleo-testado | Sem gravação oficial do mediador no banco. |
| 14 | Ocorrências | mediator-occurrences.ts | nucleo-testado | Protocolos de urgência não homologados; sem gravação. |
| 15 | Comunicação com o docente | mediator-communication.ts | nucleo-testado | — |
| 16 | Integração com o NEI | mediator-support-plan.ts, mediator-communication.ts | nucleo-testado | — |
| 17 | Solicitações de orientação | mediator-requests.ts | bloqueado | Definição 'solicitacao-mediacao' não homologada. |
| 18 | Acompanhamento da evolução | mediator-timeline.ts | nucleo-testado | — |
| 19 | Relatórios | mediator-reports.ts, mediator-automation.ts | nucleo-testado | — |
| 20 | Documentos | mediator-reports.ts | nucleo-testado | — |
| 21 | Meu histórico | mediator-history-integration.ts | nucleo-testado | — |
| 22 | Integração com demais módulos | mediator-history-integration.ts | nucleo-testado | Nenhum destinatário detém as capacidades exigidas. |
| 23 | Arquitetura de dados | mediator-designations.ts, mediator-architecture.ts | nucleo-testado | — |
| 24 | Perfis e permissões | mediator-access-policy.ts | bloqueado | Capacidades por função dependem de configuração homologada. |
| 25 | Segurança e proteção de dados | mediator-access-policy.ts, mediator-functional.ts | nucleo-testado | — |
| 26 | Requisitos de interface | mediator-central.ts, mediator-automation.ts | tela+nucleo | — |
| 27 | Automações | mediator-automation.ts | nucleo-testado | Envio por notificações não ligado. |
| 28 | Plano de implementação | mediator-acceptance.ts | nucleo-testado | — |
| 29 | Critérios de aceitação | mediator-acceptance.ts, mediator-functional.ts | nucleo-testado | 0 designações e 0 concessões NEI no banco: sem teste com sessão real. |
| 30 | Resultado institucional esperado | mediator-acceptance.ts | nucleo-testado | Resultado institucional depende de avaliação humana competente. |

## 14 critérios de aceitação
| # | Critério | Status | Lacuna |
|---|---|---|---|
| 1 | Acesso só por designação vigente (escola×estudante×data) | comprovado-tecnico | — |
| 2 | Funções não herdam competência | comprovado-tecnico | — |
| 3 | Revogação e mudança de turma preservam histórico | comprovado-tecnico | — |
| 4 | Ficha sem laudo/prontuário | comprovado-tecnico | — |
| 5 | Orientação versionada com autoria real | comprovado-tecnico | — |
| 6 | Registro diário objetivo, idempotente, 'Salvo' só confirmado | parcial | Sem gravação oficial do mediador no banco. |
| 7 | Plano do NEI não alterado pelo mediador | comprovado-tecnico | — |
| 8 | Ocorrência não substitui serviço competente | comprovado-tecnico | — |
| 9 | Sem canal/fluxo paralelo | comprovado-tecnico | — |
| 10 | Relatório/exportação auditados; ausência ≠ zero | comprovado-tecnico | — |
| 11 | Automação nunca diagnostica, avalia nem decide | comprovado-tecnico | — |
| 12 | Acesso restrito: anônimo sem leitura nem execução | parcial | Prova no banco feita fora da suíte; sessão real ausente. |
| 13 | Operação móvel em poucos toques | parcial | Central conferida em 390×844 sem sessão; demais telas não construídas. |
| 14 | Credencial técnica não concede permissão humana | comprovado-tecnico | — |
