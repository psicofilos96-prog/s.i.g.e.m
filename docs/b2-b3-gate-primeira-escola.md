# Gate B2/B3 — primeira escola real

Data: 2026-10-04. Base: `6804c52` e migrations até `0056`. Auditoria de código,
não homologação nem teste operacional da Cloud. Nenhum dado real foi importado.

## Ordem e contratos de escrita

| Elo | Fonte canônica e leitura | Writer único | Capacidade / escopo | Prova existente |
| --- | --- | --- | --- | --- |
| Unidade | `institutional_school_*`, versões e vínculo; leitura temporal B2.1 | `register_school_record_version`, `record_school_link` | `manter-cadastro-unidade-escolar` / rede | `supabase/tests/b2_1_school_registry.sql` |
| Ano | `institutional_academic_years` e versões | `register_academic_year_version` | `manter-anos-e-periodos-letivos` / rede | `supabase/tests/b2_4_academic_period_organizations.sql` |
| Organização e períodos | `institutional_period_organizations`, `institutional_academic_periods` e versões | `register_period_organization_version`, `register_academic_period_version` | mesma capacidade / rede | mesmo teste B2.4 |
| Turma | `institutional_classes` e versões; `class_at(validOn, knownAt)` | `register_institutional_class`, `record_institutional_class_version` | `manter-cadastro-de-turmas` / escola | testes B2.5.1/2 |
| Oferta/turno e organização da turma | versões B2.7 e `institutional_class_period_organization_versions` | `record_class_offering_version`, `record_class_shift_version`, `record_class_period_organization_version` | capacidades escolares próprias, incluindo `manter-organizacao-de-periodos-da-turma` | testes B2.5.3 e B2.6 |
| Estudante | `institutional_students`, `student_identity_versions`, identificadores oficiais | `register_student`, `record_student_identity_version` | `cadastrar-estudante-na-rede`, `manter-identidade-cadastral-do-estudante` / rede | `supabase/tests/b2_2_student_registry.sql` |
| Matrícula | `school_enrollments`; `cycle_enrollments_at(validOn, knownAt)` | `register_school_enrollment` | `manter-matricula-e-enturmacao` / escola | `supabase/tests/b3_1_cycle_enrollment_chain.sql` |
| Participação | `cycle_participations`; `cycle_participations_at` | `declare_cycle_participation` | mesma capacidade / escola | mesmo teste B3.1 |
| Alocação | `class_enrollment_episodes`; `class_allocations_at` | `record_class_allocation` | mesma capacidade / escola | testes B3.1/3.2 |
| Posição curricular | `allocation_curricular_positions` e eixos; `allocation_curricular_positions_at` | `record_allocation_curricular_position` | capacidade escolar de enturmação | `supabase/tests/b3_3_allocation_curricular_position.sql` |

Os nomes acima são contratos encontrados no repositório. Cada writer deve ser
confirmado na Cloud atual quanto a GRANT, RLS, `search_path`, capability e
escopo antes de inserir dados. Existência de migration ou teste com fixture não
prova que uma sessão real já possa executar a cadeia.

## Preparação da primeira carga

1. Reconciliar a lista oficial de escolas com fonte, data de referência,
   identificadores e vigência. O JSON do Censo 2026 é proposta, não cadastro
   automaticamente vigente. Registrar o ato/origem aplicável no writer B2.1.
2. Confirmar ano letivo, organização e períodos válidos para a escola piloto;
   aproveitar os períodos de 2027 já existentes quando aplicáveis, sem inferir
   um calendário da existência do ano.
3. Homologar os valores de catálogo necessários para oferta e turno antes de
   atribuí-los à turma. Criar uma única turma piloto com vínculo explícito à
   organização de períodos.
4. Reconciliar identidade e identificadores do primeiro estudante para evitar
   duplicidade. Registrar matrícula, participação e alocação na ordem acima.
5. Registrar posição curricular somente com eixos/valores homologados. A
   proposta D1 de 22 posições não substitui essa decisão.

Cada etapa usa ID lógico estável, versão/base esperada onde o writer a exige,
vigência e proveniência. Repetir importação deve procurar identidade existente
e confrontar origem e base, nunca criar duplicata por ausência de consulta.
Correção de dado oficial ocorre por nova versão/retificação, preservando a
anterior. Falha durante uma operação transacional não autoriza escrita direta
na tabela. Antes de carga real, executar smoke com fixture em transação e
`ROLLBACK`, conferir contagens e ausência de resíduos. Esse smoke ainda não
foi executado nesta Cloud por falta de sessão autorizada para os writers.

## Gate de operação e fronteira normativa

O piloto só inicia após ativação B1, política homologada, atuação efetiva,
prova de ACL/RLS e smoke de rollback na Cloud. A escola deve ter fonte oficial
reconciliada; dados de outra vigência não viram fato atual por conveniência.
Para posição curricular e projeção posterior, continuam pendentes D1 e as
decisões R2–R5 aplicáveis. E1–E4, jornada e grade permanecem fora deste gate
até haver competência e norma próprias. Nenhuma matriz padrão ou regra de
aplicabilidade é inferida.

**Primeiro dado real a solicitar:** a lista oficial vigente de unidades
escolares, com identificadores (incluindo INEP quando houver), fonte/ato de
referência e data de vigência, para reconciliar antes de escolher uma escola
piloto. Não importar a lista em lote neste gate.
