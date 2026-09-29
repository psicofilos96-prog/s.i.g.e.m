<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Configurabilidade Normativa (princípio transversal do SIGEM)

Toda norma escolar é DADO configurado, homologado e versionado; nunca código. A cadeia é sempre:
`fato → capacidade do motor → configuração → homologação → aplicação → resultado versionado`.

- Motores só conhecem primitivas (comparar, compor, somar, dividir, agregar, tratar ausência de dado). Nenhum motor conhece etapa, modalidade, segmento, ano, escola, cargo, colegiado, patamar, fórmula, prazo ou efeito institucional.
- Enumerações permanecem abertas (identificadores) quando não há necessidade estrutural de fechá-las; listas de interface são opções, não limites do domínio.
- Configurabilidade ≠ edição irrestrita: liberdade estrutural coexiste com governança (rascunho → revisão → homologação), vigência, versionamento imutável, competência institucional e auditoria.
- Sem regra homologada o sistema não conclui: impedimentos são exibidos por extenso; dado ausente nunca vira zero.
- Renomeações e migrações preservam IDs, versões, snapshots e proveniência; a nomenclatura de ciclo substitui "anual", com adaptador de compatibilidade na leitura (`adoptCycleNomenclature`).
- Auditoria automática do princípio: `src/features/assessment/normative-configurability.test.ts`.

## Colegiados e deliberações (`src/features/collegial/`)

Infraestrutura genérica de colegiados fica em `src/features/collegial/`, separada
de `assessment/`, porque a mesma máquina de sessão → pauta → deliberação → ata
atenderá outros colegiados além do Conselho de Classe.

- Sessão, pauta, deliberação e ata são entidades distintas; colegiado não é
  sinônimo de "alterar situação de aluno".
- Requisitos de composição, quórum, forma de decisão, assinatura e provocação
  formal são opcionais na configuração: nada declarado ⇒ nada exigido.
- Competência para produzir situação acadêmica vem apenas do `DeliberationBody`
  da regra de situação homologada (12I), nunca da configuração do colegiado.
- Ata encerrada é imutável: correção gera nova versão encadeada. Formatação,
  A4 e PDF pertencem ao Capítulo 15.

## Encerramento do ciclo e da turma (`src/features/cycle-closing/`)

O encerramento vive em módulo próprio, fora de `assessment/`, porque é
orquestrador de integridade e não motor acadêmico: ele não calcula nota,
frequência, situação nem deliberação.

- Requisito é resolvido por avaliador registrado (`evaluatorId`); nunca
  `switch (requirement.kind)` — nova exigência entra como avaliador registrado.
- Avaliadores nativos são primitivas genéricas; `sourceKind`, estados, capacidades
  e naturezas de ato são identificadores abertos, declarados por configuração.
- Situação acadêmica terminal é exigência opcional da política; nenhuma situação
  é criada para permitir o encerramento.
- Snapshot guarda fatos materializados e referências com versão. Congelamento em
  memória é defesa da implementação; a imutabilidade real virá de persistência
  append-only versionada.

## Projeções canônicas (`src/features/academic-projections/`)

Módulo separado porque é fronteira de publicação, não motor: uma verdade
institucional (encerramento) publica projeções canônicas, e nenhum consumidor
reconstrói fatos por conta própria.

- Consumidores (13, 14, 15, 18, 26) leem SEMPRE a projeção; o CIECE deriva seus
  fatos dela, nunca diretamente do encerramento — raiz única evita divergência.
- A projeção rica é o contrato primário; o formato tabular é adaptador derivado.
- `projectionSchemaVersion` evolui independentemente do `closingVersion`, para que
  o contrato de consumo mude sem tocar na história congelada.
- `isCurrentClosingVersion` é derivado da cadeia de encerramentos, nunca campo
  persistido, porque estado duplicado divergiria da cadeia real.
- Naturezas (`dimensionKindId`, `issueTypeId`, `sourceTypeId`) são identificadores
  abertos; o projetor não conhece componente, frequência nem módulo.

## Vida Escolar (`src/features/student-life/`)

Fundação do Capítulo 13, separada de `students/`, `enrollments/`, `academic-links/`,
`allocations/` e `transfers/` (protótipos 8A–8F, consumidos por adaptadores até
sua remoção futura), porque identidade e vínculo institucional são domínio, não tela.

- Entidades = estado institucional vigente consultável; eventos = ledger histórico
  imutável que explica como esse estado foi produzido. Nenhuma mudança de estado
  ocorre sem o fato histórico, o ato originador e a proveniência correspondentes.
- Nada derivável é persistido: data de primeiro ingresso, vigência atual e
  contagem de episódios são projeções do ledger, nunca campos editáveis.
- Três naturezas de identificação distintas: ID técnico interno imutável,
  identificador institucional exibível (padrão configurável) e identificador
  externo de outro sistema — este nunca é chave primária.
- "Vínculo institucional com a unidade" (duradouro) ≠ "matrícula letiva" (inscrição
  por ciclo, 13B). A palavra "matrícula" não representa os dois conceitos.
- Unicidade é temporal e contextual: proibida a sobreposição de episódios de
  vigência, nunca `unique(studentId, schoolId)` eterno.
- Estados, motivos, transições, exigências, tipos de evento, schemas de payload,
  naturezas de participação e atributos cadastrais são configuração; o motor só
  conhece primitivas e não conhece horário, capacidade, etapa ou modalidade.
- Diagnósticos são estruturados por código; mensagem humana é apresentação.
- Identidade e vínculo não carregam prontuário, documentos, ocorrências ou dossiê
  (minimização LGPD); consumidores leem `StudentReference`.
- Fatos acadêmicos oficiais entram apenas pela fronteira canônica da 12L (13E);
  nunca por 12G, 12H, 12I ou estruturas internas do Diário.

## Inscrição Letiva (13B — `src/features/student-life/cycle-enrollment-*.ts`)

- Matrícula inicial e rematrícula produzem a MESMA entidade (`AcademicCycleEnrollment`);
  o que difere é o rito configurado, porque duplicar entidade duplicaria a verdade.
- `CycleParticipation` é entidade temporal própria consultada por `cycleEnrollmentId`,
  nunca subdocumento: participação inicia, encerra e é retificada independentemente.
- Cada contexto `unidade + ciclo + oferta` tem sua própria inscrição; coexistência
  entre unidades é decidida por política, para que nenhuma inscrição pertença a duas escolas.
- `validUntil` é só fim de vigência; motivo, rito e ato moram no evento/transição.
- Efeito de requisito é `requirementEffectDefinitionId` configurado com capacidades
  declaradas; enumerar efeitos em TypeScript engessaria a norma no código.
- Referências temporais e curriculares são versionadas em `EnrollmentDefinitionSnapshot`;
  matrizes são lista, pois o motor não pode depender de existir exatamente uma.
- Nada derivável é publicado: "ingresso tardio" e contagem de pendências são
  interpretações do CIECE a partir das datas e dos requisitos atômicos.

## Enturmação e Movimentações (13C — `src/features/student-life/class-allocation-*.ts`)

- Enturmação é `ClassAllocation`: relação temporal entre `CycleParticipation` e `classId`,
  nunca atributo do aluno nem da turma, porque composição de turma é história, não estado.
- `AcademicClass` é a turma canônica e NÃO carrega capacidade nem contagem; capacidade é
  `ClassCapacityRecord` temporal versionado, pois lotação muda sem alterar a turma.
- Turma ≠ agrupamento interno: posição curricular de turma multietapa vem do
  `ClassGroupingDefinition`, então `academicOrganizationId` é opcional na turma.
- Movimentar é operação atômica que devolve PLANO (origem encerrada + destino constituído);
  destino inadmissível não encerra nada, para nunca existir aluno sem turma por falha parcial.
- O fim da vigência da origem vem da política temporal declarada (offset, inclusividade,
  coexistência na data); o motor não aplica "um dia antes" nativo.
- Cardinalidade é por participação; coexistência entre participações distintas é outra
  política — confundir as duas proibiria AEE legítimo.
- Ocupação e capacidade usam fato/avaliador/efeito declarados; sem registro de capacidade o
  resultado é inconclusivo e nunca há `exceedingCount` ou flag derivada publicada.
- Adaptadores traduzem `DemonstrationClass` preservando `classId`, porque Diário e Capítulo 12
  já consomem esse identificador.

## Mobilidade e Transferências (13D — `src/features/student-life/transfer-*.ts`)

Transferência é processo institucional bitemporal, não transação de formulário:
identidade permanente, versões de representação encadeadas e ledger de transições
como única fonte do estágio vigente.

- Origem e destino são polos SIMÉTRICOS e polimórficos (tipo cadastrado + schema +
  atributos). O motor não conhece "interno", "externo" nem instituição; categorias
  novas entram por configuração.
- Ausência de contexto é fato epistêmico estruturado (motivo, declarante, papel,
  ato, proveniência); jamais um booleano. "Destino conhecido?" é projeção.
- Nenhuma flag semântica de estágio: transição → efeitos configurados → executores
  registrados. Efeito inédito entra por registro de executor, nunca por `switch`.
- O efeito sobre participações e sobre o vínculo escolar vem de política sobre FATOS
  publicados pelo motor; participação sem regra deixa o plano inconclusivo e, por
  atomicidade, nenhuma vigência é encerrada.
- O intervalo institucional de transição é entidade própria com natureza cadastrada;
  o motor não presume duração nem consequência e nunca imputa falta ou abandono.
- Situação de vida escolar NÃO é atribuída por código: é projeção de política
  versionada sobre o fato de mobilidade, reproduzível e com proveniência da regra.
- A 13D é mobilidade; continuidade acadêmica é 13E e lê a fronteira canônica da 12L.
  A 13D não cria turma, alocação nem inscrição no destino (competência 13B/13C).

## Continuidade Acadêmica (13E — `src/features/student-life/continuity-*.ts`)

- Fonte acadêmica entra por `sourceTypeDefinitionId` aberto com adaptador tipado; a 13E lê
  a fronteira canônica da 12L e nunca estruturas internas do Diário.
- Obrigação de continuidade NÃO guarda estado: estado é projeção do ledger de eventos
  institucionais, para que a história explique cada mudança.
- Consequência é `consequenceDefinitionId + executorId + parameters` por registro; executor
  ausente devolve inconclusivo, pois presumir efeito criaria norma em código.
- Equivalência curricular é N:M entre referências de qualquer natureza, autorizada por
  capacidade institucional e congelada na versão da matriz de destino.
- Contexto avaliado ≠ resolução produzida; ausência de resolução terminal é admitida, porque
  percurso qualitativo não tem aprovação/reprovação.
- A 13E não constitui inscrição, participação nem alocação (competência 13B/13C); há teste de
  fronteira que falha se um símbolo dessas etapas for referenciado.

## Dossiê e Prontuário (13F — `src/features/student-life/dossier-*.ts`)

- O dossiê AGREGA e referencia; nunca grava matrícula, turma, mobilidade, continuidade
  ou resultado, porque duplicar esses fatos criaria segunda fonte de verdade.
- Titularidade é plural (`subjectReferences[]`): documento e registro podem referir-se a
  vários alunos, pessoas, processos e entidades; não existe `studentId` obrigatório.
- Documento institucional, representação e ativo digital são entidades distintas, para que
  o mesmo documento tenha várias vias sem se multiplicar.
- Parentesco não confere poder: relação pessoal e `StudentResponsibilityAssignment` são
  separados, e não existe `isLegalGuardian`.
- Acesso é `fatos → política → efeito configurado → executor registrado`, com redação por
  atributo; efeito sem executor falha fechada, pois presumir liberação vazaria conteúdo.
- Autorização precede a projeção e a busca: nada não autorizado entra em timeline, snippet,
  metadado ou contagem, evitando descoberta indireta.
- Auditoria e ciclo de vida são consequências de política aplicável a QUALQUER recurso
  governado, nunca flags do recurso; o motor só propõe, nunca exclui.
- Timeline usa `sourceTypeDefinitionId` resolvido por catálogo e superação derivada; capítulos
  do plano de desenvolvimento não são conceitos institucionais.
- Ao CIECE vão fatos atômicos autorizáveis, nunca agregações; quem conta é o CIECE.

## Portal e projeções operacionais (13G — `src/features/workspace/`)

- Portal não é domínio nem fonte de verdade: é projeção operacional autorizada
  (`agente + capacidades efetivas + escopo institucional + finalidade + contexto`),
  porque toda fila/card persistido criaria segunda verdade institucional.
- Autoridade vem de capacidades declaradas, nunca de papel/perfil; `WorkspaceAccessContext`
  é o contrato, e falha fechada vale também para ações, não só para dados.
- Autorização precede projeção, contagem e indexação de busca; ID técnico não é
  critério comum de atendimento, para não permitir descoberta por inferência.
- Processos, predicados de fila, janelas temporais e seções da ficha entram por registro
  configurado; o núcleo não conhece matrícula, turma, transferência nem documento.
- Pendência não tem catálogo próprio: agrega diagnósticos dos domínios com política,
  versão e executor competente preservados.

## Orientação Pedagógica (13H — `src/features/pedagogical-guidance/`)

Módulo próprio porque acompanhamento pedagógico é domínio novo, e não uma tela
sobre o Diário: ele referencia fatos canônicos e acrescenta apenas os fatos que
pertencem ao acompanhamento.

- Princípio formal: nenhuma inferência do motor de sinais constitui diagnóstico,
  classificação pessoal, ocorrência disciplinar, decisão, abertura de
  acompanhamento ou consequência institucional.
- Cadeia obrigatória `definição → avaliação → ocorrência`; a ocorrência congela
  versão e fatos, para que mudar a configuração nunca reescreva o histórico.
- Estado de sinal e de caso são projeções do ledger; nenhum campo de estado é
  persistido, e ausência de acompanhamento nunca é fato positivo.
- Caso admite múltiplos sujeitos e pode nascer sem sinal; responsabilidade é
  temporal e distinta de participação; plano evolui por versão encadeada.
- Encerrar ≠ resolver, e resultado observado ≠ eficácia: estado, motivo,
  observação e avaliação de efetividade são registros independentes.
- Comunicação exige responsabilidade vigente com capacidade (13F); relação
  pessoal não confere poder e capacidade não declarada falha fechada.
- A tela é segunda perspectiva do Workspace Projection Framework (13G): nenhuma
  fila, contagem ou visão de turma cria segunda verdade, e indicadores são CIECE.

## Decisão institucional e Direção Escolar (13I — `src/features/institutional-decisions/`, `src/features/school-leadership/`)

Regra transversal: **hierarquia organizacional não implica autorização informacional
nem competência operacional. Toda visualização, decisão, ato ou alteração
institucional decorre de capacidade explícita, escopo, vigência, finalidade e
política aplicável.** O cargo é rótulo de leitura (`positionLabelSnapshot`), nunca
critério de autorização — duas pessoas com o mesmo cargo têm capacidades diferentes.

- Domínio (`institutional-decisions/`) e perspectiva (`school-leadership/`) são
  separados: decisão institucional serve qualquer instância decisória, não só a Direção.
- Cadeia obrigatória `fato → política que exige a decisão → alternativas admissíveis
  → competência exercida → decisão fundamentada → ato → efeitos`; sem regra exigente
  nada é decidido.
- Decisão nunca reescreve o fato que a motivou: ela o referencia e congela o
  instantâneo (`consideredFactSnapshot`); `unchangedProcess` prova a preservação.
- Falha fechada: definição não homologada, fundamentação ausente, capacidade
  faltante ou executor de ato não registrado ⇒ nenhuma decisão é registrada.
- Substituição temporária da Direção é nova concessão com vigência própria
  (`delegationOfGrantId`), nunca troca de regra nem cargo herdado.
- Exceção autorizada não altera a regra geral (`exceptionPreservesGeneralRule`);
  configuração local só muda dentro de override declarado, com delegação vigente,
  restrição por executor registrado e homologação superior quando exigida.
- Estado do processo e versão vigente da decisão são projeções da cadeia; nenhum
  campo de estado é persistido, e retificação não reaproveita o ato anterior.
- A tela é terceira perspectiva do Workspace Projection Framework (13G): filas,
  conformidade, navegação e histórico são projeções de itens AUTORIZADOS, contam
  objetos concretos e nunca publicam taxa, série, ranking ou indicador (CIECE, Cap. 14).
- Conteúdo confidencial da Orientação (13H) não chega à Direção por hierarquia:
  exige capacidade específica declarada, com supressão por campo caso contrário.

## Gramática "Decidir" — Mesa de Decisão (6B.3.1 — `src/components/sigem/decision-desk.tsx`, `src/features/school-leadership/leadership-presentation.ts`)

- `DecisionDesk` é superfície única, nunca wizard: motivo, fatos, alternativas,
  efeitos e rito coexistem, porque decidir não é executar um procedimento linear.
- A primitiva não conhece nenhum verbo decisório (autorizar, indeferir, devolver):
  consome `DecisionOptionView[]` projetado da configuração, para que nova
  alternativa entre por configuração e nunca por código.
- Rito é condicional: fundamentação, declaração de competência e ato só existem
  quando a definição do tipo de processo os exige; exigência de um processo não
  vira ritual universal.
- `projectAuthorizedDecisionFacts` suprime o fato cuja sensibilidade não é
  autorizada e o fato cuja ausência não é revelável (`absenceRevealable: false`),
  preservando a proteção contra inferência; sensibilidade não mapeada falha fechada.
- `leadership-presentation.ts` resolve apresentação de definição + diagnóstico +
  contexto com fallback humano seguro, e nunca afirma responsável a partir de
  identificador técnico — sem rótulo humano declarado, nada é dito no Nível 1.
- "Providências das turmas" lista objetos concretos com exigência declarada; taxa,
  série, ranking e indicador permanecem exclusivos do CIECE (Cap. 14).

## Gramática "Acompanhar" — Follow-up Workspace (6B.3.2 — `src/components/sigem/follow-up-workspace.tsx`, `src/features/pedagogical-guidance/guidance-presentation.ts`)

- Superfície de acompanhamento longitudinal: nem wizard (Secretaria) nem mesa
  (Direção). A pessoa é o sujeito visual e o sinal é acontecimento do percurso,
  nunca rótulo, score ou classificação de risco.
- Nenhuma prioridade é atribuída pela interface: quando existe motivo
  institucional (prazo do plano, prazo de política), ele aparece por extenso;
  a ordem das caixas é a da configuração. Abrir na primeira caixa com item é
  apresentação e não ordenação por gravidade.
- Estados não são enumerados no frontend: `resolveGuidanceStateLine` deriva a
  frase dos fatos do item (espera declarada, conclusão registrada) com fallback
  sereno, porque enumerar engessaria a norma no código.
- Ações chegam projetadas (`resolveGuidanceAction` sobre `WorkspaceActionDescriptor`):
  nenhuma primitiva conhece verbo, e falta de capacidade falha fechada com
  explicação, sem conceder autoridade.
- Ausência é ausência: `NO_ACTIVE_FOLLOW_UP_NOTE`, `NO_PACT_NOTE` e
  `NO_AUTHORIZED_CONTACT_NOTE` nunca afirmam que "está tudo bem" e fato sem valor
  jamais vira zero.
- Contato é autorização temporal e contextual (`projectAuthorizedContacts` sobre
  `personsHoldingCapacity` da 13F), nunca selo permanente de um familiar.
- `buildGuidanceTimeline` compõe referências aos registros canônicos, sem ledger
  paralelo e sem transcrever conteúdo restrito quando a capacidade não foi dada.
- Identificador sem rótulo humano declarado não é traduzido: permanece apenas na
  proveniência (Níveis 2/3), para que a interface nunca invente sentido.

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

## Primitivas de alta velocidade da chamada (6D.1.2 — `src/components/sigem/attendance-speed.tsx`)

- As primitivas são agnósticas ao Diário: recebem `SpeedRosterPerson[]`,
  `SpeedMarkOption[]` e callbacks; não conhecem 12H.1, stores, capacidades,
  aula geminada nem fechamento, para que a ergonomia nunca vire norma.
- Nenhuma marcação é inventada: `AttendanceRow`/`AttendanceQuickBar` só exibem as
  opções declaradas em `markOptions`; sem `bulkMark` não existe ação em lote.
- O balanço é derivado do rascunho corrente em `useSpeedDraft`; nenhum agregado
  é persistido e ausência de marcação nunca é convertida por inferência.
- `markUnmarkedAs` é ato explícito e reversível: `useSpeedDraft` guarda pilha de
  rascunhos anteriores. Desfazer pertence ao rascunho; depois de concluir, a
  correção é do `resolveAttendanceCorrection`.
- `useSpeedKeyboard`: ↑/↓ movem o foco, as teclas de `markOptions` marcam e
  avançam, Delete/Backspace limpa e MANTÉM o foco (apagar é corretivo).
- Identificador institucional só aparece na busca, em homônimos
  (`speedHomonymIds`) ou no detalhe; a lista habitual prioriza número e nome.

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

## Resultados avaliativos versionados (6D.3.1 — `src/features/assessment/assessment-entry-versions.ts`, `assessment-correction.ts`)

- A entidade é resultado avaliativo, não "nota": `EntryValue` mantém numérica,
  conceitual, descritiva e "não registrado" sem privilégio nem conversão entre elas.
- Cada versão é fato independente e encadeado (`logicalEntryId` + `supersedesVersionId`);
  nenhum `history[]` embutido, porque v2 aponta para v1 e não a contém.
- Cadeia, vigência e histórico são projeções; estado duplicado divergiria da cadeia.
- Dados de retificação vivem no ato (`AssessmentRectificationAct`), pois só existem
  quando houve correção.
- Concluir rascunho não cria nova versão: a transição rascunho → registrado é o
  nascimento do fato oficial v1.
- `resolveAssessmentCorrection` não conhece cargos nem enumera rito: projeta
  admissibilidade, naturezas, exigências e bloqueios a partir de capacidades,
  configuração, política homologada e fechamento vigente; sem política, falha fechada.
- `rectifyAssessmentEntry` rejeita base superada e alteração factual nula, para nunca
  existir versão fantasma nem correção obsoleta concorrente.
- Escala continua validada por `validateEntryValue`, e composição segue exclusiva de
  `assessment-composition.ts`; a 6D.3.1 não calcula nem fecha.
- `assessment-entry-adapter.ts` lê o lançamento legado sem descartar revisão e sem
  atribuir política que ninguém homologou.

- Mesa Avaliativa do Período (`assessment-period-workspace.tsx`) só renderiza `AssessmentPeriodProjection`: nunca calcula, edita célula ou decide ação — lançamento é da Pauta 2.0 e correção do `AssessmentCorrectionPanel`, para não haver segunda implementação.
- 6D.3.3.3c: `composition-explanation-panel.tsx` só apresenta `CompositionExplanationProjection` (repassada como `PeriodStudentProjection.explanation`); teto/arredondamento vêm dos booleanos projetados, nunca de comparação de números — a UI não pode recalcular.
- 6D.3.3.4: período e busca da Avaliação do período vivem na URL (`periodo`, `q`) como estado de navegação; a busca só é restaurada quando o período coincide, e a matriz sempre reprojeta fatos oficiais.

- 6D.3.3.5: a pauta de lançamento (`assessment-entry-field-page.tsx`, rota `/avaliacao/pauta/$instrumentoId`) é a ÚNICA superfície de lançamento; a página antiga do instrumento é somente leitura, porque duas superfícies criariam fatos paralelos.
- 6D.3.4.1: `assessment-canonical-inputs.ts` é a ÚNICA tradução versão oficial vigente → entrada do motor, usada pela Avaliação do período e pelo Fechamento; o fechamento grava `usedEntryVersions` (IDs imutáveis) para que correção posterior nunca mude a referência histórica.
- 6D.3.4.2: requisitos de fechamento vêm só de `rule.closingAdmissibility` avaliada por avaliadores registrados (`period-closing-admissibility.ts`); sem política homologada o fechamento falha fechado, porque exigência universal no código seria norma escondida.
- 6D.3.4.3: divergência pós-fechamento é projeção (`period-closing-divergence.ts`) derivada só de `supersedesVersionId`; impacto rematerializa com a regra/configuração HISTÓRICAS do ato (ausentes ⇒ impact-undetermined) e regularização vem de política homologada, nunca criando fechamento sem ato humano.
- 6D.3.4.3b: toda superfície de correção monta o contexto por `buildAssessmentCorrectionContext` (fechamento vigente pelas chaves canônicas do instrumento) e relê-o antes do registro, porque projeção contra fechamento superado não pode virar fato.

- 6D.3.4.4: `closing-workspace-presentation.ts` só compõe projeções canônicas de fechamento em frases; a tela nunca cria requisito, rito ou cálculo.
- 6D.3.5.3: `assessment-period-result.ts` (`projectCanonicalPeriodResult`) é a ÚNICA fronteira composição → recuperação periódica → resultado do período, consumida pela Avaliação do período e pelo Fechamento, para que as duas nunca divirjam.

- 6D.3.5.3b: vínculo regra↔configuração é explícito (`rule.configurationId` + `rule.configurationVersion`), nunca `rule.id/version`; ausência ou divergência torna o resultado indisponível em `canonicalResultBlocks`, e `pn-consolidacao` é derivado dos fatos do modelo, não da lista manual, para não haver duas fontes normativas.
- 6D.3.5.4: divergência pós-fechamento tem duas origens (`version-succession`, `new-relevant-fact`); fato novo = cadeia oficial vigente fora de `usedEntryVersions` cujo tipo pertence ao universo da regra HISTÓRICA (`historicalRelevantInstrumentTypeIds`), sem regra histórica a relevância é indeterminada, porque recuperação nasce v1 e não substitui nada.
- 6D.3.5.5: `recovery-explanation-presentation.ts` só formata `ExplainedRecovery` em três níveis; nunca recalcula, porque a explicação não pode divergir do recibo.
- 6D.3.5.6: Recuperação Final é identificada só por `finalRecovery.instrumentTypeIds` (vazio ou sobreposto à composição ⇒ insuficiência); a tela lê o recibo via `final-recovery-presentation.ts` e lança pela Pauta 2.0, porque segundo editor ou heurística criaria verdade paralela.
- 6D.3.5.4/0: recuperação de estudante inequivocamente não elegível pela regra histórica não gera `new-relevant-fact`; elegibilidade indeterminada torna relevância/impacto indeterminados.
- 6D.3.5.7: fixtures de laboratório da recuperação vivem em `recovery-laboratory.ts` + rota `/laboratorio/recuperacao`, separadas das regras reais; sem divulgação de valores, até "alterado/mantido" é ocultado porque revela a relação entre valores.
- 6D.4.1: deliberações do Conselho têm fonte única no `collegial-store`; a situação acadêmica as lê por `collegial-standing-bridge.ts` e o motor valida competência — duas listas divergiriam.
- 6D.4.1b: só deliberação congelada na versão vigente de ata ENCERRADA alimenta a situação (`officialStandingDeliberationFor`); sessão aberta é preparação.
- 6D.4.3: divergência pós-situação é projeção (`academic-standing-divergence.ts`); impacto só com a regra histórica exata, nunca altera o registro.
- 6D.4.4: registro da situação oficial usa só `academic-standing-registration.ts` (fingerprint na conferência, reconstrução no ato, lote aborta inteiro se um divergir), porque segundo mecanismo de concorrência divergiria de Pauta/Fechamento.
- 6D.4.5: encerramento lê `terminalStandingId` apenas do registro oficial vigente (`studentsWithOfficialStanding`); projeção nunca libera o encerramento.
- 6D.5.1: objetivos curriculares vivem só em `curriculum-objectives-repository.ts` (dado BNCC em `bncc-infant-objectives.data.ts`); o Diário consulta e nunca copia, e complementação da rede tem identidade própria, porque duas listas divergiriam da fonte.
- 6D.5.2: parecer descritivo da EI vive em `src/features/diary/infant-descriptive-report.ts` atrás do contrato `DescriptiveReportRepository` (troca para persistência sem reescrever o domínio); rascunho → conferir (não registra) → oficializar versão imutável encadeada, e política adicional ausente não inventa rito.
- 6D.5: grupo BNCC (EI01/02/03) é declarado explicitamente no agrupamento da turma (`curriculumAgeGroupIds`); nunca inferido do nome da turma.

## Persistência e autorização (Lovable Cloud)

- Capacidade efetiva = `effective_capabilities()`: atuação vigente × política de capacidades HOMOLOGADA; cargo é só `position_label_snapshot`, porque cargo não é autorização.
- Política homologada e suas regras são imutáveis por trigger; nova norma = nova versão encadeada.
- Tabelas de fatos oficiais serão append-only com `unique(logical_id, version)` e correção por função transacional, para que concorrência não dependa da tela.
- Laboratório/fixtures permanecem em memória e nunca entram na base institucional.
- Autorização da sessão passa só por `src/features/authority/session-authority.ts` (tela) e `has_capability`/`effective_capabilities` (banco); oficialização é função SQL com lock por fato lógico, porque a tela nunca é garantia.
- Parecer EI: `descriptive-report-cloud.ts` adapta a cadeia do banco ao `DescriptiveReportRepository`; sem login, o laboratório em memória continua.
- Pauta no Cloud: `register_assessment_results` é o ÚNICO caminho de gravação de resultados (lote tudo-ou-nada, lock por instrumento, base esperada por resultado, `plan_id` único = idempotência); com sessão a Pauta lê só o banco (`assessment-results-cloud.ts`), porque cópia local concorrente criaria segunda verdade.
- Fechamento no Cloud: `record_period_closing_act` grava ato + versão numa transação (capacidade, transição, justificativa, último ato e fechamento vigente revalidados); com sessão o `periodClosingStore` é espelho somente leitura (`hydrate`), porque duas cadeias divergiriam.
- Resultados revalidam no banco o fechamento vigente do instrumento (turma+período+componente; ambíguo ⇒ recusa) e a política de correção homologada aplicável; a tela só coleta.
- Instrumentos com sessão nascem só em `assessment_instruments` (ID `ins-<uuid>`); resultados têm FK para o instrumento, para não haver referência órfã do navegador.
- Conselho no Cloud: domínio (`collegial-store`) valida num clone e `collegial-cloud.ts` envia a diferença a `record_collegial_session_event`/`record_collegial_deliberation`/`close_collegial_minute`; sessão é ledger append-only e "concluída" é projeção da ata, porque estado duplicado divergiria.
- Condução do colegiado no banco exige TODAS as `conduct_capabilities` da configuração homologada; nenhuma declarada ⇒ falha fechada, porque autoridade nunca é presumida.
- Situação oficial no Cloud: só `register_academic_standings` grava (lote tudo-ou-nada, base por estudante, plan_id determinístico, ata citada deve ser a vigente e conter a deliberação); capacidade própria `registrar-situacao-academica`.
- Status de instrumento é ato append-only (`apply_assessment_instrument`); status vigente = último ato, nunca campo da definição.
- Com sessão, telas derivam botões de `sessionActor()` (capacidades efetivas); perfis demonstrativos só existem sem sessão.
- Estudantes do Diário vêm só de `src/features/students/institutional-roster.ts` (`rosterStudents()`): laboratório sem sessão, banco (`class_enrollment_episodes` + encerramentos como fato próprio) com sessão, lista vazia se não houver fonte — porque cópia por módulo ou fixture com login criaria segunda verdade.
- Turmas, atuações e pessoa do Diário vêm só de `src/features/diary/institutional-teaching.ts`: laboratório sem sessão; com sessão, `institutional_engagements` (a mesma atuação que autoriza) + `institutional_classes`/componentes/períodos, sem fallback — porque lista paralela de "turmas do professor" criaria segunda verdade. Aula prevista com sessão vem só de `institutional_class_schedule_slots` (`teachingClassBlocks`); sem grade ⇒ nenhuma aula prevista, nunca o horário do laboratório.

## CIECE — fatos canônicos (14.1 — `src/features/ciece/`)

- `CanonicalFact` é fato atômico, nunca indicador: separa identidade, disponibilidade e conteúdo (sem presumir número); agregação/contagem/taxa é recusada por `validateFact`, porque total é derivação e não fonte.
- `FACT_CATALOG` declara UMA fonte, granularidade e semântica temporal por tipo; duplicidade é erro, para que Mapa, painel, relatório e Censo partam da mesma verdade.
- Situação acadêmica vem só do registro oficial 12I; enturmação com login só do episódio no banco; contagens da 12L/Conselho são proveniência — elimina as três fontes paralelas da auditoria 14.0.
- Adaptadores são puros sobre o objeto de domínio; o carregador converte linha do banco no MESMO objeto, e a paridade é semântica (ignora IDs técnicos), para não haver dois caminhos de cálculo.
- `occurredAt` ≠ vigência (`validFrom`/`validTo`) ≠ versão do registro; vigência nunca é inferida de uma data.
- Dimensões ausentes (INEP, código de rede, endereço, distrito, zona, turno, nascimento, sexo) ficam em `INSTITUTIONAL_DIMENSION_GAPS`; o CIECE não as copia nem inventa.
- Visitas Recebidas: registro institucional próprio da escola (um evento por visita, tipos configuráveis); o Mapa só projeta. Fonte canônica futura, não implementada.
- 14.1.1: escola = `institutional_schools.id` (identidade permanente); atributos em versões encadeadas append-only, INEP/código de rede em identificadores únicos imutáveis; gravação só por `register_school_record_version` com capacidade `manter-cadastro-unidade-escolar`; o CIECE resolve dimensões por `schoolId` na leitura (`school-dimensions.ts`), porque copiar criaria segunda verdade.
- 14.2: `src/features/ciece/indicator-engine.ts` é o ÚNICO motor de indicadores (fato → população declarada → indicador por avaliador registrado); recibo é projeção não persistida com cobertura, estados de ausência e referências de auditoria, porque resultado gravado ou cálculo em tela criaria segunda verdade.
- 14.3: toda consulta do CIECE passa por `analytic-boundary.ts` (`queryAnalytic`) chamado no servidor por `ciece-query.functions.ts`; autorização (capacidade+escopo contido) e divulgação (política homologada versionada, limiar só como parâmetro) são etapas distintas e a resposta é construída sem factRefs brutos, porque dado que chega ao navegador já vazou.
- 14.4: superfícies do CIECE (`src/features/ciece/surface/`) só recebem `AnalyticResponse` + catálogo publicado por `describeCieceSurface`; cada nível (agregado, decomposição, proveniência) é nova consulta, e o laboratório (`/laboratorio/ciece`) é recusado com login, porque tela com fatos ou regra própria criaria segunda verdade.
- 14.3.1: supressão complementar suprime grupos até a UNIÃO suprimida ter >1 grupo e atingir o mínimo declarado; se impossível, só a decomposição é recusada, porque total − visíveis revelaria o grupo protegido.
- 14.5: estudante (`institutional_students`) ≠ matrícula (`school_enrollments` + `school_enrollment_endings`) ≠ enturmação (`class_enrollment_episodes`, a mesma do Diário) ≠ movimentação (`student_movement_events`, tipo homologado em `movement_type_definitions`); correção é nova linha com `supersedes_id` e leitura usa `currentVersions`, porque edição destrutiva apagaria a história.
- 14.6: matrícula/movimentação entram no MESMO motor 14.2 por tipos temporais genéricos (fotografia = estoque; intervalo, início/fim de vigência no intervalo = fluxo); movimentação vira um fato por polo institucional (origem/destino) e saldo só pelo avaliador `saldo-entre-selecoes` declarado, porque diferença de contagens inferiria movimentação.
- 14.7: sexo administrativo (`student_identity_versions`) e turno (`class_shift_versions`) são fontes próprias com valores do catálogo homologável `attribute_value_definitions`; o motor os usa só por junção declarada em `dimension-links.ts` (tipo de fato + chave + temporalidade), e data de nascimento não entra no fato, porque copiar atributo ao fato criaria segunda verdade e expor dado pessoal sem regra violaria minimização.
