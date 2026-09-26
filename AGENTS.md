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
