# B4.6.0 — Auditoria e contrato do calendário institucional (somente documentação)

Status: **contrato proposto, não implementado.** Nenhuma migration, tabela, função, capability ou policy foi criada.
A B4.6.1 só começa depois da conferência deste contrato pela supervisão.

## 1. Auditoria do estado atual (código + banco, 2026-10-03)

| Item | Achado |
|---|---|
| Banco | 0 tabelas e 0 funções `public` com "calend" no nome. Ano/organização/períodos já existem em B2.4 (`institutional_academic_years`/`_year_versions`, `institutional_period_organizations`/`_organization_versions`, `institutional_academic_periods`/`_period_versions`, `class_period_organization_at`). |
| Policies | v1=108 regras, v2=117 regras, ambas `draft`. Nenhuma capability de calendário. As próximas são `manter-anos-e-periodos-letivos`, `manter-organizacao-de-periodos-da-turma`, `reabrir-periodo-fechado` e `registrar-norma-homologada`. Nenhuma pode ser reutilizada para o calendário, porque o significado não cobre conteúdo de calendário. |
| Rotas | `calendario-escolar.index`, `.$calendarioId.index` e `.$calendarioId.documento` renderizam `CalendarListPage`/workspace/`CalendarPrintView` com perfil vindo de search e atores demonstrativos. Não há fronteira institucional nem distinção entre sessão e laboratório. |
| Persistência | `calendar-store` e `calendar-image-assets` usam memória/localStorage. `CalendarModality` é fechado (`regular`/`eja`/`eja-fase-1`) e `forYear(ano, modalidade)` existe só no laboratório. |
| Catálogo/motor | `calendar-catalog` injeta `DAY_TYPES` quando não há tipo próprio. `calendar-engine.resolveCalendar` tem padrão embutido (fim de semana = FDS, demais = VAZIO), precedência fixa por kind e consultas por código/sigla. **Nada disso vale como norma institucional.** |
| Consumidores | `calendar-queries` e `calendar-assessment-link` recriam períodos/projeções a partir da fixture. Quem os usa: `attendance-closing-pages`, `cycle-closing-pages`, `assessment-instruments`, `assessment-rule-model`/`-pages`, `cycle-configuration` e `recovery-journey-lab`. Risco: o calendário subordinar ou duplicar B2.4. |

## 2. Contrato

1. **Conteúdo ≠ apresentação.** O calendário normativo guarda só fatos: faixas, eventos, atribuições de dia e referências. Layout, cores, fontes, simbologia, logos e impressão pertencem à B4.7. Nenhum campo de conteúdo carrega aparência, e nenhuma aparência carrega significado.
2. **Identidade + versões append-only.** Cada versão registra:
   - calendário lógico e número de versão;
   - `supersedes_version_id` com tipo constituição, sucessão ou retificação (cadeia linear);
   - ato/fonte obrigatório, vigência (`valid_from`/`valid_until`), justificativa quando aplicável e `recorded_by`;
   - `created_at` (= knownAt).

   Corrigir não reescreve o passado: a leitura por knownAt reproduz o que se sabia. A homologação fica num ledger próprio (versão + sequência + predecessor, como na B4.2.1/1.1), **sem writer** até haver competência exata.
3. **Ano, organização e períodos só por IDs B2.4.** O calendário referencia ano e organização de períodos e não é fonte de nome, data ou quantidade de períodos. O reader valida a vigência das referências em todo o intervalo, incluindo mudanças intermediárias (por segmentos, como B4.1.1). Referência inativa ou ambígua falha fechada. Não se fixa número de períodos (2/3/4).
4. **Tipos de dia/evento abertos.** Cada tipo tem identidade e versões com configuração semântica declarada (por exemplo: efeito letivo declarado, conta como dia letivo, natureza). Não há valores semeados, feriados, datas ou efeitos inventados. Efeito letivo **ausente** é estado próprio (`nao-declarado`), nunca false, true ou zero. O motor só aplica primitivas sobre dados homologados.
5. **Representação estrutural.** São filhas imutáveis da versão:
   - (a) faixas de datas `[início, fim]` com tipo;
   - (b) eventos pontuais ou em faixa com tipo;
   - (c) atribuições explícitas de dia;
   - (d) regras de precedência/composição, **só se declaradas e homologadas**.

   Sem regra declarada, concorrência na mesma data ⇒ `conflito-sem-regra` (fail-closed), nunca a prioridade do laboratório. Data sem declaração ⇒ `nao-declarado`, nunca dia letivo ou fim de semana automático. A B4.6.1 não implementa motor de precedência; apenas guarda e lê a estrutura.
6. **Aplicabilidade (D5).** O recorte usa referências canônicas abertas (escola, oferta/eixo B2.6, organização B2.4, posição individual B3.3), sem enum de modalidade. O calendário de turma ou aluno nunca é escolhido por nome, etapa inferida, escola ou primeira ocorrência. Sem semântica de aplicabilidade homologada, a aplicação fica `bloqueada:aplicabilidade-nao-homologada`. Uma turma multietapa pode exigir composição; mais de um candidato ⇒ `ambiguo`, sem calendário dominante.
7. **Autorização.** Hoje a única leitura legítima disponível é a de B2.4 (anos/períodos), que não autoriza ver rascunho de calendário. Separação proposta:
   - metadados de existência;
   - rascunho/versão não homologada: só para quem tiver competência de construção — decisão D4 aberta (a fonte histórica indica Supervisão);
   - conteúdo homologado: leitura de consulta — o escopo de quem consulta é decisão aberta.

   Sem contrato institucional exato, os readers retornam `access-denied` em linha única, sem revelar existência, conteúdo ou contagem, para toda versão não homologada. O conteúdo homologado também fica `access-denied` até se decidir quem consulta. Nenhuma capability ou policy é criada.
8. **UI e integrações.** Com sessão, a UI consome só a futura source institucional: sem localStorage, sem demonstração e sem perfil por URL. Sem sessão, o laboratório é preservado. Conteúdo não homologado não alimenta calendário oficial, Diário, frequência nem CIECE. Na B4.10 os consumidores distinguem `indisponivel` (sem permissão/bloqueado/inconsistente) de `ausente` (legível, sem declaração), sem fallback para fixture.

## 3. Decomposição

- **B4.6.1 — estrutura + readers (primeiro escopo implementável; não depende de D4/D5).**
  - Migration aditiva 0023 com estas tabelas:
    - `institutional_calendars` (id, criado_em);
    - `calendar_versions` (cadeia linear, ato, vigência, refs B2.4 de ano/organização, recorded_by, created_at);
    - `calendar_day_type_identities` e `calendar_day_type_versions` (semântica declarada, com efeito letivo `declarado-sim`/`declarado-nao`/`nao-declarado`);
    - `calendar_version_ranges`, `calendar_version_events` e `calendar_version_day_assignments` (filhas imutáveis);
    - `calendar_version_homologations` (ledger com predecessor e sequência +1 por trigger).
  - Triggers `forbid_mutation` em todas as tabelas. Sem INSERT/UPDATE/DELETE para anon, authenticated ou PUBLIC; `service_role` só para teste.
  - Readers `SECURITY INVOKER` com `search_path=''` e EXECUTE só para authenticated:
    - `calendar_at(_calendar_id, _on, _known_at)`;
    - `calendar_day_at(_calendar_id, _date, _known_at)`, que devolve as declarações cruas e o estado `declarado`/`nao-declarado`/`conflito-sem-regra`/`referencia-b2-4-invalida`.
  - Enquanto D4/D5 e a competência de consulta estiverem abertas, os readers devolvem `access-denied` para qualquer conta. A estrutura e o fail-closed são provados por teste SQL transacional com fixtures de teste e rollback (ACL, append-only, cadeia, vigência B2.4 com mudança intermediária, data não declarada, concorrência sem regra, knownAt).
  - Sem writers e sem dados.
- **B4.6.2 — source TS + UI read-only.** Source tipada (validOn/knownAt únicos, estados fechados, unknown ⇒ erro). Rotas com sessão mostram estado institucional (inicialmente `access-denied`/indisponível), sem localStorage; laboratório sem sessão preservado. Os consumidores de `calendar-queries`/`calendar-assessment-link` param de usar a fixture com sessão.
- **B4.6.3 — governança/escrita.** Writers de rascunho, retificação e homologação, só depois de D4 (competência de construção), R5 (competência de homologação) e da capability exata nas policies.
- **B4.7 — apresentação.** Layout, simbologia, logos e impressão sobre versão homologada.

Ajuste proposto: separar a **B4.6.1b — aplicabilidade D5** (estrutura de recorte + resolver turma/aluno → calendário com estados `bloqueado`/`ambiguo`) da B4.6.1, porque ela depende de B2.6/B3.3 e de semântica homologada.

## 4. Decisões institucionais em aberto

- **D4:** quem constrói/mantém rascunho do calendário (capability exata).
- **R5:** quem homologa versão de calendário.
- Quem consulta calendário homologado (rede, escola, docente, estudante) e se metadados de existência são públicos internamente.
- **D5:** semântica de aplicabilidade (por oferta, organização, posição individual; composição em turma multietapa).
- Catálogo semântico de tipos de dia/evento (efeito letivo, contagem), que é norma e não deve ser semeado.
- Regras de precedência entre declarações concorrentes.
- **D6:** publicação formal versus homologação.
- Policy v2 continua draft.
