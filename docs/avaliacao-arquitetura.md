# Módulo 12 — Arquitetura do domínio de avaliação (Etapa 12A)

Código: `src/features/assessment/` — `assessment-types.ts` (tipos), `assessment-rules.ts` (regras puras e seletores), `assessment-repository.ts` (contrato + memória), `assessment-fixtures.ts` (dados demonstrativos), `document-dependencies.ts` (mapa de documentos).

## Vocabulário

- **Configuração avaliativa**: define estratégia, escalas, estrutura de períodos e regras para um escopo (etapa/turma) em um ano letivo. Único lugar onde segmentos diferem.
- **Estratégia**: quantitativa, conceitual, descritiva, híbrida, acompanhamento. Referências arquiteturais.
- **Ano letivo / Período avaliativo**: entidades com ID; o período tem sequência, rótulo livre e datas. Nunca "bimestre1".
- **Instrumento**: o que o professor usou para avaliar (tipo configurável). Pertence a uma atuação pedagógica, turma e período.
- **Lançamento**: registro individual do aluno num instrumento; guarda a colocação acadêmica da época (matrícula, vínculo letivo, participação, alocação).
- **Resultado**: informação derivada por regra (instrumento, período, componente, final). Sem regra homologada: `sem-regra-homologada`.
- **Situação acadêmica**: `nao-determinada` ou `nao-aplicavel`; nunca calculada nesta etapa.
- **Nota / conceito / média**: não são entidades; nota e conceito são tipos de valor de lançamento; média seria uma regra de consolidação futura.
- **Fechamento**: apenas identidade reservada (`ClosingRecordPlaceholder`).

## Relações

Ano letivo → Estrutura de períodos → Período. Configuração → (estrutura, escalas, regras, pendências). Instrumento → (configuração, período, atuação pedagógica, turma). Lançamento → (instrumento, aluno, colocação). Resultado ← regra + lançamentos.

## Reuso (sem segunda fonte de verdade)

- Etapa por turma: `diaryStageForClass`; vigência: `assignmentActiveOn`/`dateInRange`; datas da trajetória: `normalizedStudentDate` (Diário).
- Atuação pedagógica: `pedagogical-data.ts` (mesmo vínculo do Diário). `recordingReadiness` valida profissional + atuação + turma + componente/campo + vigência + período; `authorizationFinal` é sempre `false`.
- Trajetória do aluno: `studentPlacements` achata matrícula → vínculo → participação → alocação. `eligibilityInPeriod` classifica cobertura (integral, ingresso posterior, saída anterior, parcial, sem vínculo) sem aplicar regra de aproveitamento.

## Educação Infantil

Configuração `acompanhamento` com escala só descritiva, `allowsGrades=false`, `allowsPromotionDecision=false`. Evidências (`DevelopmentEvidenceRef`) referenciam registros de `infant-experiences.ts` por ID, sem copiá-los. Quais registros serão oficiais: pendência `pn-ei`.

## Frequência

Independente. `academicStanding` ignora a frequência demonstrativa; nenhum resultado oficial é produzido. Integração futura dependerá de `pn-frequencia`.

## Regras conhecidas

Nenhuma regra acadêmica homologada. Invariantes estruturais: IDs estáveis; períodos sem sobreposição e dentro do ano letivo; um lançamento por aluno e instrumento; valor compatível com as escalas da configuração.

## Pendências normativas

`PENDING_NORMATIVE_RULES`: períodos, escala, consolidação, arredondamento, recuperação, situação, frequência, conselho, movimentação, EI, EJA, AEE/complementares.

## Adiado deliberadamente

Telas, lançamento completo, fórmulas, recuperação, conselho, fechamento, documentos, versionamento de configuração além de `version`, persistência, permissões reais.

## Próximas etapas previstas

12D concluída: percurso avaliativo por aluno como projeção pura, sem estado nem escrita. Cada instrumento das turmas do aluno no ano é classificado para ele (registrado, não registrado com motivo, pendente, planejado, não elegível por ingresso posterior/saída anterior). Pendência = elegível na data + instrumento aplicado + lançamento vazio ou em rascunho. Contagens são de itens, nunca de valores. Leitura histórica pelo `EntryContextSnapshot`; rótulo atual só como referência. Configuração de acompanhamento (EI) mostra experiências e observações do Diário.

12D.1 — Saneamento pré-consolidação (concluída):
- Identidade de componente/campo: `CurriculumRef` = `{ kind: "matriz", componentId }` (código canônico, ex.: `mat`, `cie`, via `fieldId` da atuação) ou `{ kind: "atuacao", assignmentId }` quando a fixture não tem código canônico (ex.: "Linguagens" demonstrativo, campos de EI genéricos). Nunca o rótulo. O rótulo segue apenas no snapshot. Nenhum componente foi duplicado.
- Configuração temporal: instrumento guarda `configurationId`+`configurationVersion`; o lançamento repete ambos no `EntryContextSnapshot`. O percurso lê cada item pela sua configuração; configurações diferentes coexistem sem conversão (`mixedConfigurations`); versão divergente é sinalizada e o valor é mostrado pelo rótulo gravado (`entry.valueLabel`), sem reinterpretação.
- Autoria: `AuthorshipStamp` (profissional, atuação, nome exibido, data) em `createdBy`, `author` e `EntryRevision.correctedBy`, com `valueLabel` do valor substituído. Identidades apenas demonstrativas.
- Sem prazo: estado "em aberto" (antes "pendente"); nenhum "atrasado"/"fora do prazo".
- 2026: `periodSource = "legado-demonstrativo"`, `official: false` em cada item; nenhum calendário fictício nem homologação retroativa.
- Persistência: continua inexistente; persistência real é pré-requisito para qualquer uso produtivo.

Pontos em aberto para a consolidação: códigos canônicos faltam para vários rótulos demonstrativos (identidade provisória pela atuação); a combinação entre configurações diferentes não tem regra; não há prazo de lançamento nem estado "encerrado" do instrumento; a matriz não publica um catálogo global de componentes (os códigos são por linha de matriz).

Próximo: consolidação após homologação, fechamento e documentos (ver `document-dependencies.ts`).


## Calendário escolar da rede (12B.1)

- Propriedade exclusiva da Supervisão de Ensino. Um calendário por (ano letivo, modalidade); escolas referenciam o mesmo `calendarId` (nenhum tipo tem `unitId`).
- Estados: `rascunho` (editável pela Supervisão) → `em-revisao` (bloqueado; pode voltar a rascunho) → `homologado` (snapshot congelado, imutável) → `arquivado`. Não há retorno de homologado a rascunho; retificação futura exigirá versionamento normativo com auditoria.
- Única escrita: `mutateCalendar` (recusa perfil sem capacidade e estado imutável). Auditoria: criado/alterado/revisão/homologado (quem, quando, o quê).
- Motor (`calendar-engine`): precedência sobrescrita > evento > FL > feriado > herdado > recesso > férias > fim de semana > letivo; "conta como letivo" é atributo do tipo. Mesma grade alimenta tela, impressão e PDF.
- Validações da `policy` pertencem ao calendário (ex.: CC na sexta, ≥100 por semestre em 2027), não ao sistema.
- Duplicação: novo rascunho no ano seguinte; datas fixas mantêm dia/mês, móveis recalculadas pela Páscoa; colisões listadas para decisão — nada é corrigido automaticamente.
- Períodos (12B.2): quantidade, nomes, datas, ordem e agrupamento (`periodGroups`, opcional) são dados do calendário; nenhum número por modalidade. Dias letivos sempre derivados. A data do Conselho é o dia CC resolvido dentro do período — não é campo do período.
- Avaliação: guarda `calendarPeriodId` e resolve datas no calendário (`calendar-assessment-link`). Só calendários publicados alimentam outros módulos (`calendar-queries`).

## Instrumentos e lançamentos (12C)

Código: `assessment-instruments.ts` (domínio puro), `assessment-instrument-store.ts` (estado temporário por aba), `assessment-instrument-pages.tsx` (telas). Rotas: `/diario/turmas/$turmaId/avaliacao` (layout), `.../avaliacao/` (lista por período), `.../avaliacao/instrumentos/novo`, `.../avaliacao/instrumentos/$instrumentoId` (pauta).

- **Cadeia canônica**: Ano letivo → calendário homologado → período oficial → instrumento → lançamentos. O instrumento guarda `calendarPeriodId`; datas e rótulos são sempre resolvidos no calendário.
- **Período derivado da data**: `resolveInstrumentPeriod` obtém o período pela data de aplicação. Com `calendarId`, o calendário precisa existir e estar publicado; senão o fluxo é bloqueado com motivo explícito. Sem `calendarId`, o resultado é `periodSource = "legado-demonstrativo"` e `official = false` (cenário 2026) — nunca uma segunda fonte permanente de períodos.
- **Instrumento genérico**: título, tipo (apenas os de `allowedInstrumentTypeIds`), data, descrição opcional, atuação pedagógica, turma, componente/campo. Não existe peso, pontuação máxima, quantidade mínima, nem contribuição para média. `status` (`planejado` | `aplicado`) é ciclo de UX e é independente do estado dos lançamentos.
- **Capacidade vem da configuração**: `instrumentFlowAvailable` exige tipos permitidos e escalas. Nenhuma tela decide por nome de etapa; a EI sai do fluxo porque sua configuração não tem tipos nem escala numérica (`allowsGrades = false`, `usesPedagogicalRecords = true`).
- **Pauta**: `instrumentRoster` separa elegíveis na data de aplicação (pauta) de casos apenas informativos (ingresso posterior, saída anterior) — estes não geram pendência.
- **Lançamento**: `status` própria, `context` (`EntryContextSnapshot`: aluno, unidade, turma, componente, atuação, profissional, período e rótulos da época) e `history` (`EntryRevision[]`). Correção exige justificativa e preserva a versão anterior; renomear período, tipo ou instrumento depois não reescreve o passado.
- **Não registrado**: estado semântico com motivo obrigatório. Nunca equivale a 0, ausência, falta, dispensa ou recuperação.
- **Fora de escopo mantido**: média, soma, peso, arredondamento, recuperação, substituição, resultado final, aprovação/reprovação, dependência, frequência oficial, Conselho e documentos oficiais.

## Motor de composição e consolidação (12E)

Código: `assessment-composition-types.ts` (modelo declarativo), `assessment-composition.ts` (motor puro), `assessment-composition-fixtures.ts` (modelos demonstrativos), `assessment-composition-projection.ts` (ponte com os lançamentos de 12C/12D). Auditoria estática: `assessment-composition-audit.test.ts`.

- **Fórmula como dado**: `CompositionModel` declara categorias (por identidade de tipo de instrumento), pesos, quantidade mínima, agregação por categoria, agregação do período, agregação anual e `requiresAllPeriods`. O motor não conhece bimestre, escala, nota de corte, recuperação, frequência, conselho, dependência, etapa ou componente.
- **Bloqueio informativo**: sem modelo homologado — ou com modelo de outra configuração/versão, sem categorias, com ponderação sem pesos, com arredondamento não homologado, ou com registros de configurações diferentes — `consolidateAnnual` devolve `bloqueado` com motivos e `pendingRuleIds`. Nenhum cálculo ocorre. As fixtures são demonstrativas, logo o SIGEM hoje sempre bloqueia.
- **Acumulado parcial ≠ resultado anual**: enquanto faltar qualquer dado exigido pela configuração, o retorno é `acumulado-parcial` (`final: false`, `official: false`, rótulo explícito "não é resultado anual"). `resultado-anual-original` só existe com os dados completos, e só é `official` com período de calendário homologado e modelo homologado.
- **Momento do arredondamento**: `roundScore` é o único ponto que arredonda, e só arredonda quando a política lista aquele `RoundingPoint` (`instrumento`, `categoria`, `periodo`, `componente`, `anual`). Categorias, subtotais e acumulados parciais preservam a precisão interna (`raw`) e expõem `rounded: false`. Modos configuráveis: sem arredondamento, meio acima, meio par, truncar, passo.
- **Ausência de dado**: lançamento em rascunho/vazio e "não registrado" com motivo entram em `missing` e nunca são convertidos em zero. Nada é qualificado como atrasado ou fora do prazo — não existe regra de prazo.
- **Valores administrativos**: `origin` (`diario`, `transferencia-externa`, `regularizacao-administrativa`) e `originMetadata` são preservados no lançamento. Valores de transferência externa participam da composição **somente** quando `administrativeEntries.accepted` e a origem está em `acceptedOrigins`; entram como qualquer valor válido, sem conversão, equivalência ou fórmula especial. Não admitidos, viram `origem-nao-admitida` em `missing`.
- **Semânticas não numéricas**: escala conceitual ou descritiva e configurações de acompanhamento (EI) devolvem `nao-aplicavel`; nenhuma equivalência numérica é presumida.
- **Fora de escopo mantido**: recuperação, aprovação/reprovação, dependência, efeito da frequência, decisão de Conselho, documentos oficiais, persistência e autorização real.

## Configuração, versionamento e homologação das regras avaliativas (12F)

Código: `assessment-rule-types.ts` (entidade e vocabulário), `assessment-rule-governance.ts` (capacidades, mutações, transições, duplicação, criação), `assessment-rule-validation.ts` (validação estrutural), `assessment-rule-model.ts` (ponte com o motor 12E e resolução por contexto), `assessment-recovery.ts` (prevalência configurável), `assessment-rule-preview.ts` (prévia, comparação, simulação), `assessment-rule-store.ts` (estado temporário por aba), `assessment-rule-fixtures.ts`, `assessment-rule-view.ts`, `assessment-rule-pages.tsx` (telas). Rotas: `/regras-avaliativas`, `/regras-avaliativas/$regraId`, `.../editar`, `.../comparar`. Testes: `assessment-rule-governance.test.ts` (41 casos).

- **Fonte única**: `InstitutionalAssessmentRule` reúne os metadados da configuração avaliativa (12A/12B) e o modelo de composição (12E). `compositionModelFromRule` deriva o `CompositionModel`; não existe segunda fonte paralela de fórmula.
- **Governança exclusiva da Supervisão**: `ruleCapabilities` decide ver, editar, enviar à revisão, homologar, arquivar, duplicar e excluir. Escola e professor só consultam regras homologadas.
- **Estados**: `rascunho` → `em-revisao` → `homologada` → `arquivada`. Revisão bloqueia edição; homologada é congelada (`deepFreeze`) e nunca volta a rascunho — só duplicação gera nova versão (`version + 1`, `originRuleId`/`originVersion`). Exclusão apenas de rascunho nunca utilizado.
- **Capaz ≠ configurada ≠ homologada**: o domínio representa muitas formas (prevalência, agregações, tetos, quantidade de períodos, momentos de arredondamento); a regra configurada é dado; só a homologada alimenta o motor (`ruleFuelsEngine`, `officialModelFromRule`). Nenhuma regra real da rede está homologada nas fixtures.
- **Prevalência configurável**: `RecoveryPrevalence` admite maior resultado, menor resultado, substituição direta, último resultado e média entre resultados. O resultado original é sempre preservado ao lado do pós-recuperação.
- **Identidade estável**: renomear ou reordenar categoria preserva o identificador; a recuperação referencia categorias e tipos por ID. Quantidade mínima indefinida permanece indefinida (aviso, nunca preenchimento automático). Campos opcionais são limpos explicitamente (`null`), nunca presumidos.
- **Validação estrutural**: `validateRule` separa erros bloqueantes (contexto, calendário, escala, categorias, períodos de outro calendário, ponderação sem pesos, referências inexistentes, arredondamento sem nota) de avisos. Revisão e homologação são recusadas com erro pendente.
- **Resolução por contexto**: `resolveApplicableRule` escolhe a regra homologada por ano letivo, vigência, turma e etapa; ambiguidade devolve `sem-regra-homologada`. A página de avaliação da turma mostra a regra aplicável ou o painel neutro de bloqueio.
- **Prévia, comparação e simulação**: `describeRule` traduz a regra em linguagem natural sem afirmar situação acadêmica; `compareRules` compara por identificador, não por nome; `simulateRule` usa apenas valores fictícios digitados, sem tocar em dados de aluno.
- **Fora de escopo mantido**: aprovação/reprovação, frequência normativa, Conselho, dependência, boletim, ficha individual, folha final, fechamento anual, backend, persistência e autenticação real.

## Rascunho institucional incompleto e primeira regra real em elaboração (12F.1)

Código: `assessment-rule-pending.ts` (pendências normativas), `assessment-rule-types.ts` (`prevalence`/`aggregation`/`eligibility` opcionais, `SUPERVISION_RECOVERY_PREVALENCES`), `assessment-composition-types.ts` (`maxScore` e `instrumentTypePolicy` por categoria, `annualAggregation` opcional), `assessment-composition.ts` (teto por categoria; consolidação anual bloqueada sem fórmula), `assessment-recovery.ts` (recuperação não aplicada sem prevalência/fórmula), `assessment-rule-validation.ts` (`pending`/`requiredPending`, `ok` exige ausência de pendência obrigatória), `assessment-rule-governance.ts` (transições recusadas com pendência obrigatória; `createRule` não presume consolidação anual), `assessment-rule-pages.tsx` (painel "Definições pendentes", aviso "Regra em elaboração", prevalências curadas, teto da categoria), `assessment-rule-fixtures.ts` (`rav-ef-anos-finais`). Testes: `assessment-rule-pending.test.ts` (15 casos).

- **Ausência ≠ configuração provisória**: campos indefinidos permanecem indefinidos e são listados como pendências (obrigatórias ou opcionais). O sistema nunca preenche fórmula, teto, prazo, mínimo ou prevalência.
- **Rascunho incompleto**: existe, é editável e é consultável, mas não vai a revisão nem é homologado enquanto houver pendência obrigatória.
- **Regra real em elaboração** (`rav-ef-anos-finais`, Anos Finais): cadastrados apenas os limites confirmados — AV1 30, AV2 30, Instrumentos Variados 35, Participação 5, total do período 100, recuperação periódica sobre AV1+AV2 com teto 60 e prevalência "maior resultado" (valor configurável). Indefinidos: consolidação anual, fórmula e elegibilidade das recuperações, recuperação final, mínimos por categoria, restrição de tipos e momento do arredondamento.
- **Curadoria de interface**: a Supervisão escolhe entre "maior resultado" e "substituição direta"; o domínio continua capaz de representar as demais formas de prevalência.
- **Bloqueios de cálculo**: sem consolidação anual definida, o anual devolve `bloqueado`; sem prevalência/fórmula, a recuperação não é aplicada e declara o motivo.

## Padrão de datas do SIGEM (convenção global)

| Uso | Formato |
| --- | --- |
| Interno (domínio, URL, ordenação) | AAAA-MM-DD |
| Visual | DD/MM/AAAA |
| Dia + mês | DD/MM |
| Mês + ano | MM/AAAA |
| Data + hora | DD/MM/AAAA HH:mm |
| Textual | D de <mês> de AAAA |

Toda conversão passa por `src/lib/academic-date.ts` (`formatAcademicDate`, `formatDayMonth`,
`formatMonthYear`, `formatLongDate`, `formatDateTime`, `formatDateRange`, `parseBrazilianDate`).
Campos de data usam `DateInput` (exibe dd/mm/aaaa, entrega ISO). Um teste de saneamento
impede texto ISO literal em telas e `<input type="date">` direto.

## Identidade Institucional

Ativos de identidade institucional são dados centralizados do SIGEM. Nenhum módulo ou documento deve incorporar logos institucionais diretamente quando elas puderem ser resolvidas pelo módulo de Identidade Institucional (`src/features/identity`). Resolução por tipo, proprietário e data (`resolveIdentity`); histórico nunca apagado; perfis são demonstrativos até existir autenticação/RBAC; arquivos ficam no navegador (limite 2 MB, PNG/JPEG; SVG recusado) até existir storage no servidor.

## Etapa 12G — Fechamento do período avaliativo

Arquivos: `period-closing-types.ts` (estados, capacidades, escopo, pendências,
`PeriodClosingRecord`, `ClosingSourceReference`), `period-closing.ts` (domínio
puro: pendências, materialização pelo motor, cadeia de versões, transições),
`period-closing-store.ts` (única escrita: capacidade + estado + bloqueios),
`period-closing-pages.tsx` e a rota
`/diario/turmas/$turmaId/avaliacao/fechamento`.

Princípios aplicados:

- Entrega docente, conferência institucional e fechamento oficial são momentos
  diferentes e podem existir separadamente; nada de professor → fechado.
- Competência por capacidade atômica; os perfis da tela são demonstrativos e não
  substituem autorização real.
- Nenhuma segunda fonte editável: os lançamentos (12C) seguem sendo os fatos; o
  fechamento materializa apenas o que o motor (12E) derivou, com referências
  (`entryIds`, regra, versão, calendário, configuração) para auditoria.
- O resultado é o "resultado consolidado oficial do período". Resultado anual,
  recuperação final, frequência, Conselho e situação acadêmica pertencem a
  etapas posteriores.
- Versão vigente é derivada da cadeia (`currentClosing`); não existe campo
  editável de vigência. `closingChainIssues` impede duas vigentes.
- Documentos futuros gravam `ClosingSourceReference` (versão que os originou); a
  governança documental de "desatualizado/substituído" não é implementada aqui.
- Validação histórica: `assignmentActiveInPeriod` considera a vigência da atuação
  no intervalo do período, não o estado atual.
