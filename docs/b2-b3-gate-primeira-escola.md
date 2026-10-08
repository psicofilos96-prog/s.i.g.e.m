# Gate B2/B3 — primeira escola real

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Data: 2026-10-04. Base: migrations até `0058` e snapshot pós-ativação de
`docs/b1-4-fechamento-operacional.md`. A v3 está homologada na Cloud segundo
verificação externa. Esta auditoria de código não substitui um teste operacional
dos writers com sessão real. Nenhum dado real foi importado.

A verificação na Cloud confirmou o hardening B1.4 e a regressão B2.5:
B2.5.1 passou no estado pós-ativação; B2.5.2 passou em privilégios, cadeia,
histórico (24 cenários) e contexto de ano (26); B2.5.3 passou em 23 cenários.
Os grants destrutivos detectados anteriormente foram removidos pela `0057`;
o EXECUTE residual de `service_role` nos dois writers de turma foi removido e
registrado na `0058`. B2.1, B2.2, B2.4, B2.6, B3.1, B3.2 e B3.3 também
alcançaram seus marcadores de sucesso. A Cloud voltou a 0 escolas, 0 turmas e
0 estudantes após as provas, sem política sintética residual. A cadeia B2/B3
está tecnicamente apta até a fronteira normativa; falta agora dado oficial
reconciliado para iniciar a primeira escola real, não um reparo estrutural B2/B3.

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

Com a v3 homologada e a atuação de rede do Administrador Geral verificadas
externamente, dados oficiais de unidade escolar, ano/períodos e identidade do
estudante podem ser preparados para entrada assim que fonte, vigência e
proveniência forem reconciliadas e os writers forem validados na sessão real.
Turma, oferta/turno, matrícula e posição ainda dependem dos antecedentes da
cadeia e dos valores institucionais homologados correspondentes.

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
na tabela. Antes de carga real, manter o mesmo padrão das provas: qualquer ensaio sintético
deve ocorrer em transação descartável e terminar com conferência explícita de
resíduos. A cadeia crítica foi exercitada pelos testes B2/B3, incluindo
turma → matrícula → participação → alocação em B3.1; as provas B2.5 pós-hardening
foram repetidas e a conferência final retornou 0 escolas, 0 turmas e 0 estudantes.
Isso não desfaz nem repete a ativação já comprovada.

## Gate de operação e fronteira normativa

Ativação B1, política v3 homologada, atuação do Administrador Geral e ACL/RLS
críticas do gate foram verificadas na Cloud. O bloqueio para o piloto passou a
ser a fonte oficial reconciliada e as decisões normativas aplicáveis aos passos
posteriores; dados de outra vigência não viram fato atual por conveniência.
Para posição curricular e projeção posterior, continuam pendentes D1 e as
decisões R2–R5 aplicáveis. E1–E4, jornada e grade permanecem fora deste gate
até haver competência e norma próprias. Nenhuma matriz padrão ou regra de
aplicabilidade é inferida.

**Primeiro dado real a solicitar:** a lista oficial vigente de unidades
escolares, com identificadores (incluindo INEP quando houver), fonte/ato de
referência e data de vigência, para reconciliar antes de escolher uma escola
piloto. Formato recomendado: CSV UTF-8 com uma linha por unidade e colunas
`identificador_oficial`, `inep` (se houver), `nome_oficial`, `inicio_vigencia`,
`fim_vigencia` (se houver), `fonte`, `referencia_ato` (quando aplicável) e
`data_referencia_fonte`; anexar o documento fonte separadamente. Campo vazio
não autoriza inferir valor. Duplicatas por identificador ou divergências entre
fonte e cadastro existente vão para reconciliação, sem gravação automática.
Não importar a lista em lote neste gate.
