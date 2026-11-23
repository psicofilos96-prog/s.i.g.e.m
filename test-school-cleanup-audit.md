# Limpeza da escola de teste — inventário de 23/11/2026

## Situação atual
Registro de lote. **LIMPEZA BLOQUEADA; migration 0633 aplicada e comando técnico tentado, com reversão integral e zero exclusões.**
Consultas realizadas no Cloud canônico por `supabase--read_query`, como `supabase_read_only_user`.
Não foram usados DML direto, roles da aplicação, alterações de RLS, desativação de triggers ou autoria humana simulada.

## Identidade a preservar no escopo anterior (histórico)
- Escola: `inep-99999901`.
- Identificador INEP: `99999901`; registro `fef22959-1d0f-46ca-9e7c-fcd668e7fc41`.
- Duas versões cadastrais; última: `97430f22-2417-42ba-a86f-280f133f7f6a`, versão 2.
- Nome oficial: ESCOLA MUNICIPAL DE TESTE VILA ESPERANÇA (TESTE).
- Preservar ambas as versões, a escola, infraestrutura, anos letivos e catálogos.

## Totais confirmados antes da operação
| Escopo | Linhas |
|---|---:|
| school_enrollments | 192 |
| Estudantes distintos nas matrículas | 80 |
| institutional_classes | 6 |
| staff_administrative_records, fonte fictícia exata | 16 |
| professional_census_declarations, operação fictícia 2026 | 7 |
| institutional_engagements | 34 |
| Pessoas distintas dessas atuações | 7 |
| institutional_student_persons | 74 |

As 192 matrículas se dividem em 56 da operação `5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20`,
56 da operação `7a2f0000-0000-4000-8000-000000002027` e 80 sem operação.
Das 80 sem operação, 56 têm origem literal "Escola de teste movida para 2027" e 24 têm origem nula:
20 registros do exercício TESTE OPERACAO 2026, três registros dos testes de CPF e um cadastro sem marca de teste.
Não existem matrículas dos mesmos estudantes em outra escola, nem vínculos estudante-pessoa compartilhados com estudantes fora deste recorte.
Isso não comprova sozinho que todas as pessoas sejam fictícias.

## Proveniência profissional
Os sete declarantes do Censo estão vinculados à operação fictícia 2026 e ao localizador "Escola de teste".
Todos os 34 engagements pertencem a essas sete pessoas; não possuem engagements fora desta escola.
Há sete vínculos funcionais com origem exata `teste-99999901` e matrícula funcional prefixada `TESTE-`.
Quatro pessoas têm identificador institucional de teste; as outras três não possuem identificador institucional.
Há **sete user_person_links** dessas pessoas: referência a conta não pode ser apagada por inferência.
Pessoas vinculadas a contas e eventuais referências externas exigem tratamento explícito; não serão removidas automaticamente.

## Dependências identificadas por consultas de colunas e catálogo de FKs
O catálogo completo de FKs de public foi consultado. A expansão estrutural dos quatro roots
(students/classes/enrollments/engagements) alcança 199 tabelas, incluindo referências de autoria a fatos
institucionais protegidos. Essa expansão **não é uma autorização de exclusão** nem uma lista de linhas a apagar.
Também foram pesquisadas referências sem FK por colunas de aluno, turma, pessoa, atuação,
matrícula, episódio e vínculo funcional. Contagens abaixo não devem ser somadas: um mesmo fato
pode aparecer em mais de um recorte.

| Tabela dependente | Linhas no recorte consultado |
|---|---:|
| class_enrollment_episodes | 207 |
| class_enrollment_episode_endings | 93 |
| cycle_participations | 59 |
| school_enrollment_endings | 65 |
| school_enrollment_entry_origins | 24 |
| student_class_bond_observations | 50 |
| student_registration_observations | 56 |
| student_identity_versions | 24 |
| student_movement_events | 10 |
| student_consent_events | 2 |
| student_home_hospital_care_events | 3 |
| student_protection_events | 2 |
| student_protection_access_log | 1 |
| student_vaccination_status_events | 2 |
| enrollment_wizard_draft_events, escola inteira | 62 |
| enrollment_wizard_draft_events, existing_student_id do recorte | 24 |
| institutional_class_record_versions | 6 |
| institutional_class_period_organization_versions | 3 |
| class_journeys | 6 |
| class_offering_versions | 6 |
| class_schedules | 3 |
| class_specific_matrix_associations | 6 |
| institutional_engagement_scope_classes | 22 |
| class_schedule_block_engagements | 75 |
| teaching_assignments, turma | 99 |
| teaching_assignment_versions, atuação/vínculo lógico | 101 |
| professional_functional_links | 7 |
| professional_postings, vínculo lógico | 7 |
| institutional_person_identifiers, pessoas candidatas | 76 |
| user_person_links, pessoas candidatas | 7 |
| sg_students | 50 |
| sg_classes | 6 |
| sg_staff | 16 |
| statistical_map_freezes | 1 |
| school_vacancy_requests | 1 |
| school_official_letters | 1 |
| school_official_letter_cancellations | 1 |
| exact_lookup_events | 9 |

`sg_students`, `sg_classes` e `sg_staff` foram confirmadas como tabelas, não views;
também precisam de proveniência e dependências próprias antes de eventual remoção.
Há um espaço ACV e três principals escolares, que não são automaticamente alvo da limpeza de alunos/servidores.
A auditoria recursiva por **linha** dos filhos desses fatos, conteúdo JSON/snapshots, anexos privados
e critérios de exclusão de pessoas ainda não foi fechada. **Não há prova de zero órfãos**.

## Fontes reais preservadas: baseline SHA-256
Hash calculado sobre `to_jsonb(row)::text`, ordenado por ID, separado por newline e codificado em UTF-8.

| Fonte | Linhas | SHA-256 |
|---|---:|---|
| Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx | 1797 | 16061cbd43255ef4e7526b6473ed28c1b84fa7b7cb2f1bfdcbee9a8d89ab5471 |
| Relacao_Funcionarios_SEMED_por_Setor.xlsx | 219 | 70cfe4f2af3823decb98aae04e65d0b89867c4ab038afe97ba6a665a253183ba |

Existem 55 outras escolas. Nesta consulta, matrículas e turmas fora da escola teste somaram zero;
isso é o baseline observado, não uma declaração de completude das importações oficiais.

## Bloqueios da inspeção anterior (histórico)
1. O estudante `est-c27b3e44-328d-40e8-937d-ba82ba6f70bb` foi criado pelo formulário institucional
   em 02/11/2026, rascunho `417c6339-4d7a-4219-b045-e6abae47c2d3`.
   O evento confirma `student_created=true` e `person_reused=false`, mas não declara que seja fictício.
   A identidade aponta para o rascunho; não há operação técnica nem observação de importação.
   Excluir só pelo nome ou pela escola violaria a validação de proveniência solicitada.
2. O canal de leitura usa `supabase_read_only_user`. As funções técnicas existentes são de `postgres`
   com ACL somente `{postgres=X/postgres}`. O CLI Cloud oferece consultas somente leitura;
   o canal de mudança de dados disponível aceita DML direto, proibido neste pedido.
   O canal de migration aceita DDL, não a execução de limpeza como mudança de dados.
   Não foi encontrada ferramenta disponível para invocar uma operação owner-only nessas condições.

## Resultado e próximos passos
- Registros removidos: **0**. Operation id de limpeza: **nenhum**.
- Migration de exclusão: **não criada/aplicada**, para não introduzir executor destrutivo com escopo ainda não comprovado.
- Confirmar explicitamente se o estudante indicado é fictício; finalizar dependências por linha e referências externas.
- Com canal técnico owner-only disponível, construir/testar a operação estreita com switch, hash,
  advisory lock, estado esperado, ledger append-only e idempotência, sem mudar o papel da aplicação.
- Executar somente essa função fora de migrations e repetir consultas, hashes e verificação de órfãos.
- Não houve publicação.

Consulta de baseline reutilizável: `scripts/test-school-cleanup-baseline.sql`.

## Verificação desta rodada
- A consulta de baseline foi repetida: mesmas duas versões da escola, INEP, totais e SHA-256 das duas fontes reais.
- `npm run verify -- --only=migrations,diff`: FAIL em migrations devido ao arquivo preexistente
  `0374_docserv_school_test_staff_visibility.sql` fora do journal; diff PASS. Não se alterou história de migrations para contornar a falha.
- `git diff --check`: exit 0.
- Último build automático observado às 18:58:19 UTC: build OK.
- Não foram modificadas regras nem código executável da aplicação; testes de limpeza não foram executados,
  pois não existe executor de limpeza criado nesta rodada. Não se declarou PASS de exclusão ou de ausência de órfãos.
## Escopo ampliado — 23/11/2026, 18:59 UTC
- O proprietário autorizou a exclusão da própria escola `inep-99999901` e de todo dado fictício associado.
- Nova expansão por chaves exatas e FKs encontrou **1.612 linhas candidatas em 56 tabelas**, sem referência de outra escola.
  Inclui 80 alunos, 192 matrículas, 6 turmas, 34 atuações, 7 declarações, 16 registros da fonte fictícia,
  a escola, seu identificador e 2 versões cadastrais, além de 7 vínculos conta-pessoa e 3 principals/eventos de contas escolares.
- Há fatos protegidos por gatilhos de imutabilidade, incluindo congelamento do Mapa e identificadores de pessoa; o executor não pode desativá-los.

## Bloqueio da execução anterior (histórico; substituído pela prova abaixo)
- A conexão técnica disponível no sandbox é `sandbox_exec`; ela não é proprietária nem prova o destino pelo gate de ambiente.
- O canal de leitura é somente leitura; o canal de dados aceita apenas DML direto, proibido neste pedido.
- O canal de migration aplica somente DDL e não pode executar a limpeza como alteração de dados.
- Por isso, nenhuma migration destrutiva foi aplicada e nenhuma linha foi removida. Operation id de limpeza: **nenhum**.
- Os 7 vínculos conta-pessoa e os 3 principals escolares estão no inventário ampliado; as contas Auth não foram alteradas.
- A expansão de 1.612 linhas é parcial: faltam os filhos dos filhos, referências sem FK e anexos. Não representa escopo final autorizado nem prova de ausência de órfãos.
- SELECT final: escola 1; versões 2; identificador 1; alunos 80; matrículas 192; turmas 6; registros fictícios de servidores 16; atuações 34; declarações profissionais 7. Nenhum desses totais chegou a zero.
- As 55 demais escolas e as fontes reais de 1.797/219 linhas permanecem intactas; os dois SHA-256 acima foram reproduzidos. As duas operações de origem permanecem.
- Nenhum executor/migration de limpeza foi criado ou aplicado, pois o inventário ainda não é completo e não existe canal de invocação owner-only confirmado. Nenhum teste de execução/rollback foi declarado como realizado.

## Prova atual — operação restrita e tentativa no Cloud
- Aplicada `drizzle/migrations/0633_test_school_99999901_fail_closed_cleanup.sql` pelo canal de migrations do projeto. DDL apenas: a instalação não executou exclusões.
- `technical_cleanup_test_school_99999901(text,jsonb)` é SECURITY DEFINER, search_path vazio, EXECUTE somente postgres; não recebeu permissões de PUBLIC/anon/authenticated/service_role.
- A invocação disponível é um único comando com payload fechado em `technical_test_school_cleanup_commands`; o trigger INVOKER exige o proprietário técnico antes de chamar a função. Nenhum DML de domínio foi enviado diretamente.
- O comando foi efetivamente tentado no Cloud, pelo canal de mudança de dados da plataforma, sem conta humana ou chave de aplicação. Portanto, o impedimento anterior de canal **não é mais o bloqueador comprovado**.
- A transação recusou antes de qualquer exclusão: `technical:cleanup-retained-audit-reference:institutional_sector_provisioning_events:institutional_sector_provisioning_events_principal_id_fkey`.
- Existem 3 eventos imutáveis de provisionamento apontando, por FK obrigatória, para os 3 principals dessa escola; eles apontam por FK para a escola. Excluir os principals ou a escola mantendo essa trilha como está viola a integridade referencial. Não se apagou auditoria, não se alteraram FKs nem se desativaram triggers.
- Além disso, os registros escolares e matrículas têm guards imutáveis; a operação recusa esses guards, em vez de contorná-los. Ela não declara prontidão de exclusão enquanto essas condições persistirem.
- A expansão por linha interrompeu no primeiro impedimento; não equivale a inventário final de todas as dependências, arquivos ou referências sem FK.

## Verificação após a tentativa
| Entidade | Restante |
|---|---:|
| Escola | 1 |
| Versões / identificadores da escola | 2 / 1 |
| Alunos distintos | 80 |
| Matrículas | 192 |
| Turmas | 6 |
| Fonte fictícia de servidores | 16 |
| Atuações | 34 |
| Declarações profissionais | 7 |
| Comandos / operações de limpeza persistidos | 0 / 0 |

- Operation id de limpeza: **nenhum**, pois a transação inteira foi revertida; as 2 operações de origem permanecem.
- As 55 outras escolas permanecem. As fontes reais de 1.797 e 219 linhas reproduziram os mesmos hashes acima.
- Não há comprovação de zero resíduos ou zero órfãos; os dados de teste continuam presentes.
- 12 verificações transacionais de recusa/idempotência/reversão passaram em PostgreSQL descartável; 13 testes focais de invariantes passaram. Não houve teste positivo de exclusão integral.
- Lint focal e diff passaram; build automático OK. `verify` passou em limpeza-isolada e segurança, mas a integridade das migrations ainda acusa o arquivo preexistente `0374_docserv_school_test_staff_visibility.sql` fora do journal. Não se reescreveu história para ocultar essa falha.
- SHA-256 da migration 0633 congelado: `67664494e5bdf44f5285c6283c2795259d82b52a408b04645c913b192212178e`.
- Sem publicação. A continuidade exige uma solução explícita que preserve a auditoria e suas referências, não relaxar controles para executar exclusões.
