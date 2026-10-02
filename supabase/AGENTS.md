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
- Turmas, atuações e pessoa do Diário vêm só de `src/features/diary/institutional-teaching.ts`: laboratório sem sessão; com sessão, `institutional_engagements` (a mesma atuação que autoriza) + identidade de `institutional_classes` projetada por `class_at`/`class_shift_at` (B2.7; turno ausente = null, etapa/oferta legadas = null)/componentes/períodos, sem fallback — porque lista paralela de "turmas do professor" criaria segunda verdade. Aula prevista com sessão vem só de `institutional_class_schedule_slots` (`teachingClassBlocks`); sem grade ⇒ nenhuma aula prevista, nunca o horário do laboratório.
