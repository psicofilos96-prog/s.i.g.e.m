# SIGEM — Memória de continuidade técnica (2026-10-03)

Registro de continuidade **dentro do repositório**. Não é promessa de memória externa: quem retomar deve reler este arquivo, os `AGENTS.md` e as fontes duráveis abaixo.

## Sequência auditada
1. Sincronização reconciliada em `7129c0c` (B4.5 recuperada/mesclada; Cloud com 0021/0022).
2. B4.5.1: cache estrito por conta/pessoa e mapper fail-closed — `51d05b2`.
3. B4.5.2: TIME até microssegundos e `block_minutes` conforme o SQL — `d885459`.
4. B4.6.1: estrutura do calendário (0023), readers públicos fechados (`access-denied`) — `a7a8e70`. Auditoria técnica aceita; não é homologação institucional.
5. B4.6.2a (esta entrega; base auditada `a7a8e70`): source tipada + fronteira de sessão nas três rotas do calendário + casos SQL `year-inactive`/`organization-inactive`.
   - O commit é criado automaticamente; o hash não fica registrado aqui.

6. B4.6.2a recebida/auditada em `aab9aba`.
7. B4.6.2a.1: `isKnownAt`/`instantMicros` validam data e hora por componente (sem normalizar 2026-02-30), aceitam T/espaço, frações até 6 dígitos, offset Z/±hh/±hhmm/±hh:mm e 24:00:00 só com zeros, e comparam em microssegundos UTC (BigInt).
   - Residual técnico: o parser B4.5 (`person-schedule-source.ts`) também usa `Date.parse` para instantes. Fica para correção dirigida; não há leitura indevida comprovada.
8. B4.6.2b.0: auditoria de consumidores (`docs/b4-6-2b-auditoria-consumidores-calendario.md`), só diagnóstico. Achados:
   - A1: os fechamentos com sessão dizem "não homologado" sem terem lido o calendário;
   - A2: períodos B2.4 rotulados como demonstrativos;
   - A3: o encerramento do ciclo usa observações do calendário do laboratório com sessão;
   - A4: durante a verificação de sessão, a configuração do laboratório é usada;
   - A5: localStorage é lido com sessão;
   - A6: ciclos sem origem.
   - Próximo patch: Patch 1 (fechamentos de frequência e período com origem explícita e motivo "calendário institucional indisponível").

## Testes reais e gates desta entrega
- Cloud: `supabase/tests/b4_6_1_calendar_structure.sql` → `b46-tests-ok` (rollback). As 9 tabelas de calendário ficaram vazias depois. Policies v1/v2 = 108/117 draft.
- Código: testes novos e afetados, suíte completa isolada, typecheck, build e diff-check com exit code real (ver relatório da entrega). SQL B4.4/B4.5 não foi repetido (não alterado).

## Escopo concluído em B4.6.2a
- `calendar_at`/`calendar_day_at` tipados, só `access-denied`, qualquer outra forma é erro visível.
- `/calendario-escolar`, `/$id` e `/$id/documento`:
  - sessão incerta ⇒ nada monta;
  - sem sessão ⇒ laboratório;
  - com sessão ⇒ consulta institucional somente leitura, sem demo, `?perfil`, impressão ou ações.
- Cache por userId + modo + ID + validOn + knownAt.

## Próximos passos (nenhum iniciado)
- **B4.6.2b**: migrar os consumidores do laboratório (Diário, frequência, avaliação, fechamento; lista em `docs/b4-6-2a-calendario-source-rotas.md`).
- **B4.6.1b**: aplicabilidade/D5.
- **Decisões institucionais abertas:**
  - D4 — leitura de rascunho;
  - competência de consulta do conteúdo homologado;
  - R5 — homologação;
  - D6 — publicação.
- **B4.7**: apresentação/impressão institucional. **B4.8 / B4.9 / B4.10**: integrações.

## Fontes duráveis e regras de retomada
- `docs/sigem-memoria-fontes-historicas.md` e `docs/sigem-memoria-setorial-e-auditoria.md`: contexto histórico e setorial, não estado atual.
- O repositório é a única fonte do estado; o modelo abandonado não é importado (regras, dados ou código).
- Não forçar permissões, capabilities, policies nem normas: sem decisão institucional explícita, a escrita e a consulta continuam fechadas.

## B4.6.2b.1 (base auditada 7e4edd9)
Patches 3 e 4 + parser B4.5 entregues (ver `docs/b4-6-2b-auditoria-consumidores-calendario.md`). Pendentes: Patches 1, 2, 5, Patch 4b (chamadores diretos), A6. Sem SQL; capabilities/consulta/D4/D5/R5/D6 intactas. Não iniciar B4.7.

## B4.6.2b.1.1 (base auditada d892692)
Um snapshot de autoridade no encerramento; provas com contexto resolvido; Patch 4b fechado (todos os chamadores auditados). Pendentes: Patches 1/2/5, A6.

## B4.6.2b.1.2 — aceitação de respostas do encerramento (sobre 2bf80e1)
- Base 2bf80e1 conferida (origem/snapshot no corpo, atores neutros, source normativa com pending/userId, testes deferred).
- Bug corrigido: `useCloudCycleClosing.refresh` hidratava o store global incondicionalmente; resposta tardia de A podia substituir snapshots de B.
- Correção (só TS/leitura): contexto = userId + classId + enabled (userId vem do snapshot da fronteira); ref de contexto ativo + geração; cleanup invalida pendentes; refresh de contexto velho/desmontado não consulta nem invalida o novo; erro em qualquer consulta não hidrata (nem [] nem parcial); policies só visíveis para o contexto carregado sem erro. clone→RPC→refresh e autorização backend inalterados.
- Prova: `cycle-closing-cloud-acceptance.test.tsx` (hook real + store real; IDs de snapshot asseridos).
- Fora de escopo (auditoria B4.10): demais syncs globais (useCloudClosingSync, useCloudStanding, useCloudCollegial e outros) não foram revistos; não se alega aplicação protegida como um todo.
- Pendentes: Patches 1/2/5, A6.

## B4.6.2b.2 — consumidores: data acadêmica, fronteira de ciclos (A6), projeção (sobre c567ab8)
- Data: `src/features/academic/academic-reference-date.ts`. Data informada (URL `data`) prevalece; inválida ⇒ indisponível sem consulta (fonte normativa bloqueada, fatos de período desabilitados). Com sessão e sem data: "hoje operacional" capturado uma vez por montagem — só referência de consulta, nunca norma/prazo. Laboratório mantém `DIARY_REFERENCE_DATE`. Aplicado em encerramento (antes sem `academicDate`), consolidação, situação acadêmica e projeção; `diaryContext` recebe a mesma data.
- Ciclos (A6): `resolveCyclesForOrigin`. Laboratório = legado. Institucional = indisponível por extenso (`INSTITUTIONAL_CYCLES_UNAVAILABLE`): sem fallback "Consolidação Anual"/todos-os-períodos, sem calendário local, sem afirmar que não há ciclos, sem `cycles[0]`. Consequência honesta: com sessão, encerramento/consolidação/situação/projeção ficam indisponíveis até existir fonte homologada de definição de ciclos (decisão de agrupamento de períodos em ciclos segue aberta; nada persistido foi criado).
- Projeção: verifica sessão, `cloudClosing.ready`/`error` antes de ler store ou afirmar ausência de política/catálogo.
- Testes: `academic-reference-date.test.ts`, `academic-projection-session.test.tsx`, `cycle-closing-session-boundary.test.tsx` (inspetor/A→B exercitados com fonte de ciclos HIPOTÉTICA só de teste; novo caso A6 e casos de data com parâmetro real da timeline).
- Limitações: projeção com data inválida ainda chama a fonte normativa com data ausente (timeline real retorna indisponível sem RPC; normas são lidas); outras telas (fechamento de período, avaliação do período, diário) não usam o hoje operacional — sem data seguem indisponíveis na timeline B2.4. `diaryContext` em outras telas continua com default de laboratório.
- Pendentes: Patches 1/2 (próximos), A6 parcial (fonte institucional de ciclos), B4.10 (syncs globais).

## B4.6.2b.3 — Patches 1/2: proveniência B2.4, calendário como dependência, política de frequência (sobre 353c34d)
- Proveniência: `OfficialTimeline.provenance` (`institucional-b2.4`, validOn, knownAt ÚNICO capturado no início e repassado a TODAS as leituras, versões do ano/organização/períodos); a estrutura avaliativa carrega `provenance`. Nenhum ato/homologação novo é declarado.
- `resolveInstrumentPeriod`: estrutura com proveniência B2.4 ⇒ `source: "institucional-b2.4"`, `official:false`, `calendarDependency:"indisponivel"`, sem consultar calendário; data civil estrita; data em >1 período (B2.4, calendário ou legado) ⇒ falha, nunca o primeiro. IDs/`periodSource` históricos preservados (sem renomear nem recalcular).
- Calendário institucional indisponível: pendência própria `calendario-institucional-indisponivel` (frequência e período) — "indisponível para consulta", nunca "não homologado". Fechamento de período não força mais `officialPeriod` com sessão.
- Previstos: `plannedUnits` sem `isSchoolDay` ⇒ `null`; tela mostra "Informação indisponível" e o fechamento oficial ganha bloqueio `unidades-previstas-indisponiveis`. Afeta também o laboratório sem calendário homologado (antes contava todos os dias).
- Fronteiras de sessão: frequência (loading ⇒ só verificação; signed-out ⇒ lab com `useNetworkCalendars`; signed-in ⇒ corpo institucional sem calendário local, remontado por conta) e período (loading ⇒ verificação; corpo recebe o mesmo snapshot). Ambas usam `useAcademicReferenceDate`; data inválida bloqueia sem consulta.
- `useAttendancePolicySource({cloud,pending,userId,date})` sobre `useInstitutionalRequest`: chave conta+data, resposta antiga/unmount ignorada, erro ≠ ausência. Callers: situação acadêmica e frequência (ambos com gate de erro).
- Projeção: data inválida desabilita encerramentos e normas (hooks mantidos).
- Escrita: protocolos inalterados (`attendance-closing-store` continua exigindo calendário oficial; backend revalida).
- Limitações: knownAt é instante do cliente (relógio pode divergir do servidor); `useCloudPeriodFacts` e diário não foram revistos para proveniência; syncs globais (B4.10) intactos; calendário institucional continua sem fonte (decisão aberta). Pendentes: fonte institucional de ciclos (A6), calendário institucional, B4.10.

## B4.6.2b.3.1 — correção dirigida (auditoria de ef509de)
- Origem do período: `period-source-presentation.ts` é a única frase de `PeriodSource`; B2.4 aparece como "Período institucional (B2.4) · calendário institucional indisponível para consulta" no instrumento e na trajetória do estudante. `official` continua só `calendario-homologado`; ausente/legado seguem demonstrativos, sem reetiquetar histórico.
- Ausência ≠ zero no motor: `ScopeAttendanceTotals`/fato de frequência/consolidação têm `plannedUnits`/`plannedWithoutExecutionUnits` `number | null`; consolidação usa `addKnown` (null propaga). Lista conhecida vazia = 0. Recibos históricos numéricos inalterados; fechamento oficial continua bloqueado sem previstos.
- `loadOfficialTimelineForClass`: data via `isCivilDate` e `knownAt` via `isKnownAt` antes de qualquer RPC; proveniência inclui `classAssociation {id, version}` (sem id/versão ⇒ indisponível, nada fabricado); identidades de organização e períodos filtradas por `created_at <= knownAt` (identidade futura não entra nem torna indisponível). `useAttendancePolicySource` só consulta com data civil válida.
- Testes: mocks exigem `created_at` (ausente não passa no filtro); cenários de identidade/organização futura, associação sem versão, data/instante inválidos sem RPC.
- Limitação mantida: `knownAt` padrão é relógio do cliente. Patches 1/2: revisados nesta correção; aguardam nova auditoria antes de serem dados como fechados.
