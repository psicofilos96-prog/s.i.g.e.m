## Frequência: ciclos irmãos e correção (6D.1.1 — `src/features/diary/attendance*.ts`)

- Frequência e registro de aula são ciclos IRMÃOS do mesmo contexto letivo:
  `attendanceBlocker` não impede a chamada por registro em rascunho, porque a
  conclusão do registro é exigência do fechamento oficial (12H.1), não da chamada.
- `Pendente`/`Em elaboração`/`Concluída` e a versão vigente são PROJEÇÕES
  (`lessonCyclePhase`, `attendanceCycleView`) derivadas dos fatos; nenhum estado
  novo é persistido, e `Retificada` não existe como estado ontológico.
- Marcações admitidas continuam `Presente`, `Ausente` e ausência de marcação;
  `ATTENDANCE_CORRECTION_MARKS` não inventa "falta justificada".
- `resolveAttendanceCorrection` (Attendance Correction Resolver) decide
  admissibilidade, capacidade, marcações e rito a partir do fechamento vigente e
  das capacidades de 12H.1, com `provenance` em cada exigência; a tela só projeta.
  Sem fechamento vigente não há motivo obrigatório inventado.
- `attendanceStore.rectify` cria versão seguinte encadeada e guarda a anterior em
  `history`; chamada em elaboração é editada (Desfazer), nunca retificada.

## Attendance Workspace 2.0 (6D.1.3 — `src/features/diary/attendance-pages.tsx`)

- A tela tem quatro zonas fixas nesta ordem: contexto compacto → `AttendanceQuickBar`
  (balanço + busca + lote) → lista nominal → barra de conclusão persistente. Nada
  explica o modelo acadêmico antes do trabalho: o professor cai dentro da lista.
- O rascunho de cada aula vive em `AttendanceSlotBoard`, remontado por `key={slot}`;
  o acumulado por aula fica no workspace, então trocar de aula nunca destrói marcações.
- Aula geminada é conveniência explícita: `applyMarks` aplica as marcações da aula
  anterior como UMA operação reversível (`Desfazer`), sem herança silenciosa e sem modal.
- Concluir exige marcação de todos; a barra explica por extenso quantos faltam e
  oferece "Marcar pendentes como presentes" — ausência de marcação nunca vira presença.
- Chamada concluída é imutável na tela: a correção institucional pertence à 6D.1.4 e
  ao `resolveAttendanceCorrection`; aqui só se declara a fronteira, sem simular auditoria.
- Sair com rascunho não concluído avisa com honestidade epistêmica ("alterações ainda
  não concluídas"), sem prometer persistência que não existe.

## Versionamento e correção do registro de aula (6D.2.1 — `src/features/diary/lesson-versions.ts`, `lesson-correction.ts`)

- Cada versão é fato independente e encadeado (`LessonRecordVersion` com
  `logicalRecordId` + `supersedesVersionId`); nenhum array `history` dentro do
  objeto vigente, porque v2 aponta para v1 e não a contém.
- Histórico, versão vigente e contagem são projeções da cadeia (`lessonHistory`,
  `currentLessonVersion`); estado duplicado divergiria da cadeia real.
- Dados de retificação vivem no ato (`LessonRectificationAct`), nunca como
  propriedades universais do registro, pois só existem quando houve correção.
- `resolveLessonCorrection` não conhece cargos: recebe agente + capacidades +
  política homologada + fechamento vigente e projeta `canCorrect`,
  `admissibleChanges`, `requiredCapabilities`, `requiredRitual`,
  `blockingReasons` e `disclosableReasons`; sem regra homologada, falha fechada.
- Fechamento oficial altera o contexto normativo consultado, nunca implica
  justificativa por si: o rito é o que a regra vigente declarar.
- Sem alteração efetiva (`lessonFactsDelta` vazio) não há nova versão; base já
  substituída falha fechada, impedindo correção obsoleta concorrente.

## Retificação do registro de aula na interface (6D.2.3 — `src/features/diary/lesson-correction-panel.tsx`, `lesson-correction-config.ts`)

- A correção é orientada pela DIFERENÇA, não pelo formulário: a conferência
  exibe apenas os aspectos de `lessonFactsDelta`, porque campo intocado não é
  decisão a confirmar.
- A superfície não enumera exigência: justificativa e demais requisitos vêm de
  `projection.requiredRitual`; campo editável vem de `admissibleChanges`.
- Partida sempre da versão vigente (`lessonVersionStore.chain` +
  `currentLessonVersion`); a v1 é história e nunca base de nova correção.
- `shared`/`individual` não aparecem ao professor: a escolha é dita como
  "um registro para as aulas" / "um registro para cada aula", reaproveitando
  `splitSharedContent`/`mergeIndividualContent` para nunca perder texto.
- Identificadores técnicos (capacidade, regra, fechamento) ficam em disclosure
  de Nível 3 ("Detalhes normativos"); o Nível 1 fala em autorização institucional.
- `lesson-correction-config.ts` é configuração/dado (perfis, regras homologadas,
  fechamentos) e repositório de versões em memória; nenhuma norma no componente.

## Fronteira de sessão do Diário (B4.10.0c — `diary-session.tsx`, `diary-session-state.ts`)

- Um controlador por aba, montado na rota `/diario` antes de qualquer consumidor: incerteza nunca abre laboratório; só ausência confirmada de sessão abre.
- Leituras institucionais são puras e lançam em qualquer erro (capacidades inclusive); aplicação só pela geração corrente do contexto `userId#revisão`, porque resposta tardia não pode hidratar outra sessão.
- Escrita exige espelho aceito; releitura pós-RPC só no contexto que a iniciou. Rascunhos ficam particionados por laboratório/conta na memória da aba.
- Atuação institucional não declara papel: usar `UNREGISTERED_PEDAGOGICAL_ROLE`, nunca inferir.

## Consumidores fora de /diario (B4.10.0c.1 — `diary-persistence-mode.ts`, `DiaryLaboratoryGate`)

- O modo inicial do módulo é `pendente`: antes de qualquer fronteira nada é laboratório nem institucional. Testes de unidade estabelecem o laboratório explicitamente (`src/test/setup.ts`), porque o produto falha fechado.
- Rota fora de /diario que usa estado do Diário em execução passa pelo MESMO controlador: `DiaryLaboratoryGate` só o monta com sessão confirmadamente ausente; conta recebe recusa sem hidratação e incerteza nunca abre laboratório.
- Rotas que só importam constantes/funções puras do Diário não ganham fronteira; após sair de /diario o modo fica pendente, o que é correto enquanto não houver consumidor em execução.

## Referência temporal do Diário (B4.10.0d — `diary-session.tsx`, `diary-data.ts`, `institutional-teaching.ts`)

- Com conta, o contexto do controlador é `userId#revisão@data`: data `data` da URL válida prevalece; sem ela, hoje operacional capturado UMA vez por vida do controlador; inválida ⇒ erro sem consulta, nunca data substituta. Laboratório mantém a data fixa legada.
- UM `knownAt` por lote, capturado antes das leituras e guardado em `DiaryReference`; roster, atuações, `class_at`/`class_shift_at` e a grade B4.4 usam o mesmo valor, e a aplicação nunca recaptura instante.
- Consumidores pegam a data por `diaryQueryDate`/`diaryToday`; com sessão, `DIARY_REFERENCE_DATE`/`normalizeReferenceDate` nunca são fallback.
- Versões sem reader bitemporal (componentes, ano, escola) são filtradas explicitamente por vigência ≤ data e registro ≤ knownAt; encerramento de atuação só conta se registrado até knownAt; atuação que começa depois da data é "Futura".
- Domingo é dia estrutural (ISO 7 → `sun`): bloco cadastrado é preservado; nenhum bloco, regra ou dia letivo é gerado.

## Precisão temporal das fontes (B4.10.0d.1 — `institutional-teaching.ts`, `students/institutional-temporal.ts`)

- "Conhecido até knownAt" compara `instantMicros` (µs, offset respeitado); knownAt inválido falha antes de qualquer consulta e registro com instante inválido nunca é conhecido, porque `Date.parse` trunca µs.
- Situação institucional de matrícula/vínculo/alocação é `temporalSituation` na data (Futura/Vigente/Encerrada/Abertura não registrada, fim inclusivo): projeção temporal, não situação administrativa; enums demonstrativos ficam separados.
- Vários episódios vigentes na data (ex.: regular + AEE) não elegem dominante: `currentClassId` fica nulo; natureza institucional fica em `natureValueId`, nunca convertida em Regular/Complementar.

## Cadeia institucional do roster (B4.10.0f — `students/institutional-chain.ts`)

- `projectInstitutionalChains` é adaptador PURO: inscrição (cabeça por logical_id) → participação própria → lista das suas alocações; nenhuma entidade por turma, participação sem alocação continua visível e várias alocações não elegem dominante.
- Vínculo conferido por `participation.enrollment_logical_id` canônico, nunca por `allocation.enrollment_id` (versão da época da escrita).
- Cabeça duplicada ⇒ exceção (lote recusado); pai ilegível/outro aluno/outra escola e alocação legada sem participação ⇒ `ChainDiagnostic` com evidência, nunca relação válida; a chamada da turma afetada fica bloqueada (`roster-chain`).
- `studentsForClassOn`/`allocationWindows` institucionais exigem a cadeia inteira vigente na data (`institutionalChainActiveOn`); abertura ausente não é vigência. `academicLinks` institucional é só agrupamento de apresentação.
- Fechamento/entrega de frequência recebem `rosterChainDiagnostics` no contexto pelo produtor canônico (motor puro nunca lê global); diagnóstico da turma no período ⇒ pendência bloqueante de integridade da fonte, nunca total conclusivo.

## Aula prevista depende do calendário (B4.6.3d — `lesson-records.ts`)

- Fora do laboratório, aula prevista só existe via `plannedLessonsResolution` (adaptador central, knownAt do contexto aceito); grade estrutural é `scheduleBlocksFor` e nunca vira previsão, porque grade não é calendário. Indeterminado ⇒ agenda "Na grade", previsto null com motivo, nada gerado.

## Diário do Professor 2027 (Frente W — migrations 0135–0136, `src/features/teacher-diary/`)
- Aula e chamada gravam só por `record_lesson_version_v2`/`record_attendance_version_v2`: regência canônica ou substituição vigente da própria pessoa natural na data, capability na mesma atuação, ano `operacional`, dia letivo do calendário único homologado e período único; lotação nunca abre Diário, porque autoridade docente vem da atribuição.
- Grade é esperado e aula é fato: nenhum bloco vira aula sem registro, e a chamada só existe sobre aula `w/1` registrada.
- Elegíveis da chamada = alocação vigente na data da aula, congelados na 1ª versão; ausência de marcação nunca é falta; marcações só do catálogo existente.
- Referências curriculares (Y) entram por ID em `lesson_curricular_references`, opcionais; nenhuma média, peso ou regra final nasce aqui (AA).
- Writers v1 aposentados (EXECUTE revogado); DML direto revogado de anon/authenticated/service_role nas tabelas do Diário.
- W.2 (`0149`): política de correção do Diário é resolvida na data da aula (`applicable_diary_policy_on`), nunca no relógio civil; professor lê só a própria regência (`my_diary_slots_at`, `my_diary_lessons`) e gestão lê `diary_school_overview_at` (existência/versões/contagens, sem texto nem marcações), porque leitura administrativa não pode virar autoria nem exposição.
- Prova positiva do Diário: `supabase/tests/w2_diary_e2e.sql`, executado pelo `supabase--run_sql` (o psql do sandbox não grava tabelas institucionais); termina em RAISE, nada persiste.

## Dia do professor (NDOC.UX — `teacher-day.ts`, `DiaryHomePage`)

- A home segue `TEACHER_DAY_STEPS` (próxima aula → registrar → chamada → planejamento → pendências) e os filtros de contexto ficam recolhidos, porque o professor entra pelo dia, não pela configuração; a sequência só navega, nenhuma regra é decidida nela.

## Autosave e impressões (NDIARY.FINAL.2 — `lesson-draft-cloud.ts`, `diary-prints.ts`)
- Rascunho de aula vive só em `lesson_record_drafts` (append-only, autor), retry pela mesma seq, porque rascunho no navegador seria segunda verdade.
- Impressões e fontes do relatório leem com a sessão do usuário e nunca têm coluna de professor, porque exportar não pode ampliar acesso nem criar ranking docente.

## R2 (Diário/pedagogia)
- Etapa só escolhe perfil versionado (`diary/stage-engine.ts`); regra de aprovação e escala nascem pendentes e bloqueiam resultado oficial, porque norma não pode nascer no código.
- Gabarito por versão A–H é derivado do gabarito canônico pelo mapeamento reversível (`teacher-assessment/variant-key.ts`); correção é proposta e só grava com confirmação humana sobre a impressão aprovada pela OP.
- Bordas de PDF só por `PRINT_TABLE_CSS` (pt, separate), porque 1px cinza some ao reduzir o zoom.

## Regras dos modelos da rede (`network-model-rules.ts`)
- Regras de nota/frequência/aprovação só entram com referência arquivo/aba/célula do modelo da rede e perfil versionado, porque regra sem fonte seria norma inventada.
