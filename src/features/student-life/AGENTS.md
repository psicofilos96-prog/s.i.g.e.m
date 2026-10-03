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

## B3 — Cadeia institucional 13B/13C (`cycle-enrollment-source.ts`)
- Inscrição letiva = `school_enrollments` (ano oficial em `academic_year_id`; `cycle_id` deprecado) → participação = `cycle_participations` (natureza do catálogo `natureza-da-participacao-educacional`) → alocação = `class_enrollment_episodes.participation_logical_id`; mesma tabela evoluída, porque tabela paralela criaria segunda verdade.
- Leitura só por `cycle_enrollments_at`/`cycle_participations_at`/`class_allocations_at`/`student_movements_known`/`class_capacity_at` (SECURITY INVOKER, `validOn`/`knownAt`); gravação só por `constitute_cycle_enrollment`, `record_cycle_enrollment_ending`, `declare_cycle_participation`, `record_class_allocation`, `record_class_allocation_ending`, `record_class_capacity`, `record_movement_type_definition`, porque "última versão" local reescreveria o passado.
- Términos são versões (`*_ending_versions`, anulação/retificação por nova versão); os escritores antigos ficaram sem EXECUTE, porque não validam ano/turma/participação.
- Sem política homologada, sobreposição de participações, segunda alocação da mesma participação, oferta da inscrição e movimentação entre alocações falham fechadas, porque cardinalidade/coexistência/fronteira temporal é norma.
- Capacidade = `class_capacity_records` temporal; ocupação = contagem de `class_allocations_at`, nunca persistida nem usada para bloquear sem política.
- B3.1: a cadeia pai→filho é verificada por recusa e nunca corrigida por cascata (`*:child-participation-outside`, `*:child-allocation-outside`, `participation:has-allocations`, `*:open-beyond-participation`), porque encerrar filhos automaticamente seria norma.
- B3.1: turma em alocação, término de alocação e capacidade é validada por `class_fact_context` no intervalo do registro; escola/ano pela maior versão com `valid_from <= data`, porque "head" por supersessão ou "hoje" substituiria a vigência.
- B3.1: tipos de movimentação só por `movement_types_at(on, knownAt)` (maior versão homologada com `valid_from <= on`, conhecida em `created_at`); `record_student_movement` só aceita essa versão, porque leitura direta da tabela aceitaria versão substituída ou futura.
- Leituras de apoio da tela B3 (ano letivo, turma) seguem a mesma regra por data (`academicYearsOn`, `activeClassesOn` via `class_at`); só servem para rótulo/opção, o escritor revalida.
- B4.2.5: resolução curricular só pela fonte `curricular-resolution-source.ts` (estados em dicionário fechado; desconhecido ⇒ `nao-mapeado`, nunca ausência; `knownAt` capturado uma vez por carregamento), porque RPC espalhada em componente divergiria dos estados do banco. Painel é somente leitura até existir writer e competência (R5).
