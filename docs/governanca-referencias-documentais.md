# Governança das referências documentais (Frente A)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Decisão do proprietário: documento/ato externo **não é autorização** para cadastrar ou versionar fatos no SIGEM.
Autorização continua sendo sessão + capability homologada + escopo + vigência + base esperada + unicidade + auditoria.
A referência documental, quando informada, é **fonte/proveniência** do conteúdo e é preservada como foi digitada.

Migrations: `0103_optional_document_refs_sweep` (remove gates e torna colunas anuláveis) e
`0104_fix_optional_document_refs_nullif` (correção técnica da 0103: `NULLIF` é construção SQL).
Migrations antigas não foram editadas. Teste de banco: `supabase/tests/a_0103_optional_document_refs.sql`.

Classificação: **1** = gate artificial removido · **2** = fonte material preservada · **3** = história de instalação preservada.

## Matriz

| Objeto (writer) | Campo | Antes | Depois | Classe | Justificativa |
|---|---|---|---|---|---|
| Estudante (`register_student`) | `student_identity_versions.originating_act_ref` | `student:act-required` | opcional, branco → NULL | 1 | Identidade cadastral exige capability de rede, não documento |
| Componente (`register_curricular_component_version`) | `curricular_component_versions.originating_act_ref` (NOT NULL removido) | `component:act-required` | opcional | 1 | Idem |
| Turma (`register_institutional_class`, `record_institutional_class_version`) | `institutional_class_record_versions.originating_act_ref` | `class:act-required` | opcional | 1 | Carga de turmas não depende de ato |
| Organização de períodos da turma (`record_class_period_organization_version`) | `originating_act_ref` | `class-period:act-and-reason-required` | só motivo obrigatório (`class-period:reason-required`) | 1 | Motivo é auditoria; ato não |
| Atuação (`record_engagement`, `end_engagement`) | `institutional_engagements`/`engagement_endings.act_ref` (NOT NULL removido) | `engagement:act-required` | opcional | 1 | Vínculos/profissionais dependem de capability |
| Vínculo entre unidades (`record_school_link`) | `institutional_school_links.originating_act_ref` (NOT NULL removido) | `school:act-required` | opcional | 1 | Coerente com 0098 |
| Ano / organização / período letivo (`register_academic_year_version`, `register_period_organization_version`, `register_academic_period_version`) | `originating_act_ref` (NOT NULL removido) | `year/organization/period:act-required` | opcional | 1 | Estrutura letiva é decisão interna |
| Calendário (`record_calendar_version`, `record_calendar_day_type_version`, `record_calendar_council_configuration`, `record_calendar_composition_norm_version`, `save_network_calendar`) | `originating_act_ref`/`act_ref` (NOT NULL removido) | `calendar*:act-required` | opcional | 1 | Supervisão constrói sem Portaria (decisão vigente) |
| Homologação do calendário (`homologate_calendar_version`, `homologate_network_calendar`, `homologate_calendar_composition_norm`) | `homologation_act_ref` (NOT NULL removido) | `*-homologation:act-required` | opcional | 1 | Homologação = decisão da autoridade designada |
| Catálogo (`record_attribute_value_version`) | `act_ref` | `catalog:homologation-act-required` | opcional | 1 | Base esperada e capability permanecem |
| Tipo de movimentação (`record_movement_type_definition`) | `homologation_act_ref` | ato ou vigência obrigatórios | só vigência (`movement-type:homologation-valid-from-required`) | 1 | Vigência é regra temporal real |
| Reset de credencial (`record_credential_reset`) | `account_credential_events.act_ref` | `account:act-required` | opcional | 1 | Ação administrativa exige capability |
| Jornada / horário da turma | `originating_act_ref` | sentinela `decisao-interna-sem-documento-fonte` se ausente | inalterado | 2 | Já opcional; sentinela é proveniência explícita |
| Matrizes/correspondências/associação E4 | `originating_act_ref`, `specific_act_ref`, `homologation_act_ref` | já opcionais | inalterado | 2 | Fonte material do conteúdo |
| Normas de avaliação / tipos de ocorrência / mapa | `homologation_act_ref` | NOT NULL / CHECK, sem writer humano ativo | inalterado | 2 | Norma homologada carrega sua fonte; revisar quando houver writer |
| Política de capabilities | `homologation_act_ref` | exigido só com origem `ato-administrativo` | inalterado | 2 | Origens `decisao-do-proprietario`/`ativacao-inicial` já dispensam ato |
| Resultados avaliativos (`register_assessment_results`) | `rectification-act-required` | exigido | inalterado | 2 | É o objeto de retificação (motivo/autoria), não documento externo |
| Instalação (`install_sigem`, `sigem_installation_acts`) | `act_ref` | `install:act-required` | inalterado | 3 | Instalação já ocorreu (ativação sem ato externo, 0053); história preservada |

CHECKs `btrim(x) <> ''` foram mantidos: aceitam NULL e continuam recusando texto vazio, de modo que a
normalização branco → NULL é a única forma de "não informar".

## Prova
- Banco (rollback): estudante sem referência grava NULL; branco vira NULL; referência informada é preservada
  literalmente; sem capability e sem sessão continuam recusados; nenhum `act-required` resta fora de
  `install_sigem` e `register_assessment_results`.
- UI: rótulos "Referência documental/fonte (opcional)" no calendário, turmas, oferta/turno, encerramento
  de atuação e reset de credencial; nenhum formulário bloqueia por ausência de referência.

## Execução técnica
Nenhuma operação técnica nova foi necessária nesta frente. Cargas futuras (turmas, matrículas, profissionais,
jornadas) usam operações específicas da camada 0100 sobre estes mesmos writers/cores, sem DML direto.
