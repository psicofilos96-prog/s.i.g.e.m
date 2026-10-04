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
