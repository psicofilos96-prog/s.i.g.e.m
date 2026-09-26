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
