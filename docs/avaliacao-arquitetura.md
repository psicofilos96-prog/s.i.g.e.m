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

Fragilidades conhecidas para a consolidação: a configuração vem da turma de contexto (aluno que muda entre configurações diferentes no ano não tem regra de combinação); o filtro por componente usa rótulo textual (falta ID de componente no instrumento); o estado do instrumento é binário (sem "encerrado"), então pendência não distingue prazo; instrumentos 2026 são legado sem `calendarPeriodId`; o responsável é identificado pela atuação, sem nome em snapshot; nenhuma persistência nem autoria real das correções.

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
