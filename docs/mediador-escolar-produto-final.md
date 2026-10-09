# Mediador Escolar — produto final (NMEDIADOR.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — MEDIATOR_WORKSPACE_FULLY_OPERATIONAL.

## Estado do banco (conferido)
inclusion_mediation_assignments 0 · inclusion_records 0 · aee_services 0 · lotações 0 · atuações vigentes 2 (nenhuma de mediação/NEI/professor).
Censo 2026: 299 pessoas declaradas "Profissional de apoio escolar para alunos com deficiência (Lei 13.146/2015)" por turma — é declaração censitária, não vínculo mediador↔estudante, e não vira mediação (nenhum estudante é ligado por inferência).

## Fluxos × situação
| Fluxo | Existente | Bloqueio |
|---|---|---|
| Identidade (pessoa + vínculo + lotação + atuação) | atuação vigente exigida na data inicial | lotações 0 (LOTACAO_FONTE_SEM_CHAVE); nenhuma atuação de mediação |
| Vínculo mediador↔estudante, início/fim, sem sobreposição | `inclusion_mediation_assignments` | 0 vínculos; fonte nominal ausente |
| Substituição = encerra + novo | regra no writer | idem |
| Home "meus estudantes" | `inclusion_my_mediated_students` (só vigência) | sem vínculos |
| Registro/diário de bordo, encaminhamentos | `inclusion_records` (pedagógico, finalidade obrigatória) | categorias sem catálogo homologado |
| Anexos | bucket privado `inclusao-sensivel`, trilha | sem registros |
| CID/laudo | só `inclusion_clinical_records_for` com capability própria — mediador não vê por padrão | — |
| Professor | só "há mediação vigente" nas próprias turmas | sem vínculos |
| NEI rede | contagens por escola | sem atuação NEI |
| Mapa Estrutura V | `map_mediation_projection_at` | sem vínculos |
| Relatórios | pacotes Inclusão bloqueados (REPORT.PRO.2) | sem dados |
| PDF | sem modelo no acervo; modelo-base no Document Studio pendente (MEDIATOR_DOC_TEMPLATE_PENDING) | — |

## Decisões necessárias
1. Fonte nominal de mediação (quem media qual estudante, desde quando) — não existe nas planilhas importadas.
2. Lotações e atuações dos profissionais de apoio (planilha do DP com CPF/matrícula).
3. Conta e atuação do NEI central.
4. Catálogo homologado de categorias de registro de inclusão.
5. Testes autenticados (mediador A/B, término, fora de vigência) — ambiente sem login.
