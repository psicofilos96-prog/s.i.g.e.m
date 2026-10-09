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

## Primitivas de estado (`src/components/sigem/states.tsx`)

- Estado versionado, ausência, proveniência, aviso, ação perigosa, conflito otimista, carregamento e erro usam estas primitivas, porque padrões repetidos por tela divergem.
- Identidade institucional (emblema, localidade, órgão) vive só em `src/config/institution.ts`, porque componentes genéricos precisam servir a outra rede.
- Cores apenas por tokens semânticos; cores cruas do Tailwind são barradas por teste.

## Orientação por rota (NUX.4.1 — `src/config/route-guides.ts`)

- `TaskGuide` das rotas principais é renderizado pelo AppShell a partir de um registro único, nunca copiado por tela, para que onde estou/o que fazer/próximo passo não diverja; o texto só orienta e nunca afirma estado de dado.

## Vocabulário da interface (NUI.2 — `src/config/ui-vocabulary.ts`)
- Rótulos de ação, estados de tela e status equivalentes têm uma forma canônica em pt-BR nesse registro, guardada por varredura em `ui-vocabulary.test.ts`, porque variações por tela confundem quem usa várias estações; status desconhecido nunca é traduzido por palpite.
- Rótulo e cor de estado vêm só de `src/config/state-presentation.ts` (fase → tom), sobre o valor canônico do banco/ledger; desconhecido nunca é traduzido, porque estado inventado na tela divergiria da origem.
- NUI.3: mapa local de status em tela só é lido por `knownLabel` (desconhecido = "Situação não reconhecida", nunca o código cru); o catálogo de `components/sigem/ui-vocabulary.ts` é fachada do registro único, para que exista uma só forma canônica.

## Estados de ausência (NEMPTY.3 — `AbsenceState` em `states.tsx`)
- Ausência usa um dos cinco tipos de `ABSENCE_TEXT` (sem dado, não configurado, sem permissão, nenhum resultado, nenhum registro) e zero só aparece quando observado (`FactValue`), porque zero no lugar de ausência afirma fato inexistente.
- NDEDUP.1: paginação de lista já lida usa `OffsetPager` (list-pager.tsx) e aviso neutro em caixa usa `NoteBox` (patterns.tsx); cards/cabeçalhos locais que carregam regra do domínio ficam locais, porque unificar só o idêntico preserva diferença de negócio.

## Cadastros editoriais (ONDA 1 — `registry-layout.tsx`)
- Listas de cadastro usam `RegistryHero`/`RegistryToolbar`/`RegistryList` (tabela no computador, cartões no celular), porque cada tela com seu próprio arranjo voltava a parecer HTML cru; contagem só vem do dado lido.
