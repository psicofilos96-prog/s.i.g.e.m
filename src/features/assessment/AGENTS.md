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
- `useClassConfigurationState` com sessão em `loading` devolve `SESSION_PENDING_STATE` e nunca configuração do laboratório; chave inclui `userId`, porque escolher laboratório antes da confirmação vaza fixture para a sessão.
- Todo chamador de `useAssessmentNormativeSource` passa `normativeSessionArgs(authority)` do mesmo snapshot de sessão da tela, porque booleano `cloud` isolado trata loading como sem sessão e omite `userId` da chave.
- B4.6.2b.2: ciclos só via `resolveCyclesForOrigin`; com sessão sem fonte homologada de definição de ciclos o resultado é indisponível (nunca fallback anual, calendário local ou `cycles[0]`), porque ausência de fonte não é ausência de ciclos. Consultas institucionais usam `useAcademicReferenceDate` (informada prevalece; hoje operacional é só referência de consulta), porque data fixa de laboratório na sessão seleciona versão errada.
- B4.6.2b.3: períodos B2.4 carregam `provenance` (versões, validOn, knownAt único) e são "institucional-b2.4", nunca legado; calendário é dependência separada — indisponível gera `calendario-institucional-indisponivel`, nunca "não homologado", porque falta de leitura não é prova de estado. Sem dias letivos, previsto é null (nunca contar todos os dias nem zero).
- B4.6.2b.3.1: frase de origem do período só via `period-source-presentation.ts`; previsto indisponível é `null` também nos totais/fatos/consolidação (nunca 0), porque ausência somada como zero falsificaria a carga.
- B4.10.0a: espelhos globais (fechamento, situação, Conselho) só hidratam por `useContextGate` + `mirrorOwnership` e a escrita exige espelho do mesmo dono, porque resposta tardia de outro contexto corromperia base esperada e tela. B4.10.0a.1: base esperada/capacidades são carga da revisão aceita do store (nunca estado da montagem) e a leitura do fechamento é staged (fechamentos+capacidades aceitos juntos), porque aplicar parte antes de falha posterior contradiz "erro nunca hidrata".
- B4.6.3d: consolidação do ciclo recebe `calendarRange` só com sessão; indeterminado ⇒ `calendario-institucional-nao-resolvido` (nunca "não homologado") com contribuições apenas dos fechamentos oficiais, porque leitura negada não é ausência de homologação nem motivo para recalcular.
- AA.2: completude, fingerprint e conferência são calculados só no banco (`assessment_instrument_governance_state`); a tela (`assessment-governance-panel.tsx`) envia cabeça+fingerprint esperados, e oficialização/publicação ficam fechadas sem competência/regra homologada, porque fingerprint da tela poderia divergir dos fatos.
