# Auditoria pré-Cloud do Diário (somente leitura)

Nenhum código produtivo alterado. Mapa: entidade → fonte atual → destino → versionada? → relação principal → atômica? → migra?

## 1. Fatos oficiais (append-only)

| Entidade | Fonte atual | Destino proposto | Versionada | Relação principal | Atômica | Migra |
|---|---|---|---|---|---|---|
| AssessmentEntryVersion (resultado avaliativo) | `fieldVersionStore` (memória) | `assessment_entry_versions` append-only, `unique(logical_entry_id, version)`, `supersedes_version_id` | Sim, cadeia | instrumento, estudante | Sim (lote tudo-ou-nada) | Não (laboratório) |
| Ato de retificação avaliativa | dentro do store de versões | `assessment_rectification_acts` | Imutável | versão nova + anterior | Junto da versão | Não |
| Registro de aula (LessonRecordVersion) | `lessonVersionStore` / `localLessonStore` | `lesson_record_versions` append-only + `lesson_rectification_acts` | Sim | turma, aula | Sim | Não |
| Chamada (AttendanceRecord) | `attendanceStore` (history embutido) | `attendance_record_versions` append-only | Sim (hoje `history[]` — persistir como cadeia sem mudar o contrato de leitura) | aula, estudante | Sim (chamada inteira) | Não |
| Fechamento de frequência | `attendanceClosingStore` | `attendance_closings` | Sim | turma, período | Sim | Não |
| Fechamento de período | `periodClosingStore` (grava `usedEntryVersions`) | `period_closings` + `period_closing_used_versions` | Sim | turma, componente, período | Sim | Não |
| Parecer descritivo EI | `descriptiveReportRepository` (contrato já pronto) | `descriptive_report_versions` | Sim, cadeia | estudante, turma, período | Sim | Não |
| Registro qualitativo EI | `infantExperienceStore` | `infant_experience_records` | Não hoje | turma, objetivos BNCC | Não | Não |
| Sessão/pauta/deliberação/ata | `collegialStore` | `collegial_sessions`, `agenda_items`, `deliberations`, `minutes_versions` | Ata encerrada imutável, correção = nova versão | sessão | Sim (encerramento) | Não |
| Situação acadêmica oficial | `academicStandingStore` + `academic-standing-registration.ts` | `academic_standing_registrations` | Sim | estudante, ciclo, regra histórica | Sim (lote aborta inteiro) | Não |
| Encerramento do ciclo/turma | `cycleClosingStore` (snapshot) | `cycle_closings` + snapshot JSON imutável | Sim | turma, ciclo | Sim | Não |

## 2. Rascunhos recuperáveis

| Entidade | Fonte | Destino | Migra |
|---|---|---|---|
| Rascunho de lançamento (Pauta 2.0) | `assessment-entry-draft.ts` | `assessment_entry_drafts` (por autor, sobrescrevível) | Não |
| Rascunho de chamada / registro / parecer | estado dos workspaces | tabelas de rascunho por autor | Não |

## 3. Configuração e regras

| Entidade | Fonte | Destino | Versionada | Migra |
|---|---|---|---|---|
| Regras de avaliação/situação | `assessmentRuleRepository` | `assessment_rules` (rascunho→homologação, versão imutável, `configuration_id/version`) | Sim | Não — regras atuais são de laboratório |
| Configuração do ciclo | `cycle-configuration.ts` | `cycle_configurations` | Sim | Candidata |
| Instrumentos | `instrumentStore` | `assessment_instruments` | Não hoje | Não |
| Catálogo BNCC EI (93 objetivos) | `bncc-infant-objectives.data.ts` | `curriculum_objectives` (referência oficial) | Por edição BNCC | **Sim (dado real)** |
| Calendários | `calendarRepository` + localStorage | `calendars` | Sim | Candidata (conteúdo não homologado) |
| Identidade institucional | `identityStore` + localStorage | `institution_identity` | Não | Candidata |

## 4. Não persistir

- Projeções: Mesa/Avaliação do período, explicabilidade, divergências, filas de Direção/Orientação, projeções canônicas, histórico e versão vigente (sempre derivadas da cadeia).
- Estado de interface: busca, filtros, período na URL, painel aberto, estudante selecionado, pilha de desfazer.
- Fixtures: `assessment-entry-field-fixture.ts` (Ana Clara Souza), `recovery-journey-lab.ts`, turmas/estudantes demonstrativos, perfis de `lesson-correction-config.ts` — **descartáveis**, ficam só em laboratório.

## 5. Garantias no banco (não só na tela)

- Tabelas de versões: sem UPDATE/DELETE (RLS + trigger); `unique(logical_id, version)` impede duas oficializações simultâneas.
- Correção: inserir só se `supersedes_version_id` for a vigente e o fechamento vigente for o conferido — função SQL transacional que compara fingerprint e recusa.
- Lote: uma função SQL por lote (tudo-ou-nada).
- Na aplicação permanecem: matemática, resolvers de correção, avaliadores e projeções (inalterados).

## 6. Autorização

Capacidades já existem no domínio; as telas usam perfis demonstrativos. Falta **política definida** para: usuário autenticado → pessoa institucional → atuações → capacidades. Não será inventada; cargo não vira autorização.

## 7. Menor sequência

1. Ativar Lovable Cloud e autenticação.
2. Tabelas de pessoa institucional, atuação e concessão de capacidade (vazias, sem política inventada).
3. Adaptadores de repositório por store, mantendo as mesmas interfaces (começando pelo parecer EI, que já tem contrato).
4. Funções transacionais para oficializar, corrigir e registrar lotes.
5. Laboratório continua em memória, isolado da base institucional.

## Decisões irreversíveis pendentes (motivo da parada)

- Modelo de vinculação usuário → pessoa → capacidades.
- Identificador institucional de escola/turma/estudante na base real (hoje apenas IDs demonstrativos).

## 8. Decisão de autorização (homologada pelo usuário)

Cadeia canônica: usuário autenticado → pessoa institucional → atuação/vínculo vigente → contexto da atuação (escola, turma, componente, período, vigência) → política homologada de capacidades → capacidades efetivas.

- Capacidade nunca vem do cargo nem de lista manual por usuário.
- A política associa natureza de atuação → capacidades + escopo; é DADO homologado e versionado. Sem política homologada, nenhuma capacidade (falha fechada).
- Delegação, substituição e exceção serão entidade separada (origem, escopo, vigência, auditoria), não fonte normal.
- Cadastros reais: ainda não existem; a base começa vazia e o laboratório permanece em memória.

Capacidades já exigidas pelo domínio (identificadores abertos, sem associação inventada):
retificar-encerramento-turma, reabrir-turma-encerrada, conferir-encerramento, configurar-encerramento, consultar-encerramento, executar-retificacao-de-registro-de-aula, entregar-pauta-docente, entregar-pauta-de-frequencia, deliberar-situacao, consultar-auditoria-de-situacao, configurar-colegiado, consultar-colegiado, conduzir-sessao.
