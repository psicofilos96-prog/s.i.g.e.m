# Frente BT — Writers governados para regras institucionais

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Base: HEAD `4515cd3a871644642b8af0e1e8c5eeea3b4085a7`. Fecha o STILL_TECHNICAL da BQ.0 (seção I, item 2).
**BT não configura 2027.** Nenhuma regra real foi criada, e nenhuma capacidade foi concedida a perfil algum.

## Contratos (fase 0)

As seis tabelas já existiam e estavam vazias. Os motores as leem pelo status homologado:

| Domínio | Tabela consumida | Status do motor | Consumidores |
|---|---|---|---|
| correcao-diario | `diary_correction_policies` | `homologada` | `applicable_diary_policy(_on)`, `diary-cloud.ts` |
| correcao-avaliacao | `assessment_correction_policies` | `homologated` | `register_assessment_results` |
| fechamento-ciclo | `cycle_closing_policies` | `homologada` | `record_cycle_closing`, `cycle-closing-cloud.ts` |
| calculo-frequencia | `attendance_calculation_policies` | `homologada` | trigger `require_homologated_attendance_policy`, `assessment-normative-sources.ts` |
| tipo-ocorrencia-frequencia | `attendance_occurrence_types` | `homologada` | `record_attendance_occurrence`, `attendance-occurrences-cloud.ts` |
| configuracao-colegiado | `collegial_body_configurations` | `homologated` | `collegial_conduct_authority`, `can_read_collegial`, `collegial-cloud.ts` |

Nenhum consumidor foi alterado: o writer só insere linhas já homologadas, no formato que o motor espera. As tabelas consumidas continuam sem DML para os papéis do app, com os guards de imutabilidade originais.

## Modelo de governança (fases 1–2) — migrations `0203`, `0204` (aditivas)

- `institutional_rule_drafts`: ledger append-only de rascunhos com `unique(domain, logical_id, version)`. Guarda payload, vigência, motivo, fonte opcional e autoria (`recorded_by` = auth.uid, `recorded_person_id`, `recorded_engagement_id`).
- `institutional_rule_homologations`: ledger append-only dos atos de homologação (um por rascunho), com a autoria do homologador.
- O guard `forbid_mutation` bloqueia UPDATE/DELETE nos dois ledgers. RLS está ligada sem policy, e não há grants para anon/authenticated.
- Ao homologar, a linha é inserida na tabela consumida com o status do motor e `homologation_act_ref = 'sigem-homologacao:<id do ato>'`. Esse é o ato interno do SIGEM, não um ato externo fabricado (decisão do proprietário: documento oficial é só fonte opcional).
- Em diário e avaliação, `supersedes_version_id` aponta para a última versão homologada do mesmo identificador.
- Base esperada: a cabeça é a maior versão entre os rascunhos e a tabela consumida. Uma divergência dá `institutional-rule:stale-head`.
- Segregação: quem redigiu não homologa (`institutional-rule:segregation`), igual às regras do Mapa.
- Lock: `pg_advisory_xact_lock` por domínio + identificador.
- Vigência explícita é obrigatória em diário, avaliação, cálculo de frequência e tipo de ocorrência. Fechamento e colegiado não têm vigência própria (o motor cita a versão), e informar vigência nesses dois é recusado.
- O contrato do payload é fechado por domínio: campo desconhecido, enum fora da lista, curinga, capacidade fora do formato slug, turma inexistente e payload acima de 64 KB são recusados. O conteúdo de `definition` é interpretado pelo motor do domínio, que falha fechado.

### Endpoints (únicos com EXECUTE para `authenticated`; anon sem EXECUTE)

| Domínio | Rascunho | Homologação |
|---|---|---|
| Diário | `record_diary_correction_policy_draft` | `homologate_diary_correction_policy` |
| Avaliação | `record_assessment_correction_policy_draft` | `homologate_assessment_correction_policy` |
| Fechamento | `record_cycle_closing_policy_draft` | `homologate_cycle_closing_policy` |
| Cálculo de frequência | `record_attendance_calculation_policy_draft` | `homologate_attendance_calculation_policy` |
| Tipo de ocorrência | `record_attendance_occurrence_type_draft` | `homologate_attendance_occurrence_type` |
| Colegiado | `record_collegial_body_configuration_draft` | `homologate_collegial_body_configuration` |

Também há dois endpoints comuns:

- `preview_institutional_rule_draft`: valida o conteúdo sem gravar.
- `institutional_rule_versions_at(domain, on, knownAt)`: leitor temporal. Os estados são projetados: `rascunho`, `rascunho-superado`, `homologada-futura`, `vigente`, `expirada` e `superada`. Sem capacidade, devolve `access-denied`, nunca lista vazia.

Os helpers internos `institutional_rule_*` e `*_core` não têm EXECUTE para nenhum papel do app. Todo DEFINER usa `search_path = ''`.

## Capacidades

A capacidade é exigida em escopo de rede (`has_network_capability`). Nenhuma capacidade recebeu regra de policy, e a policy v8 não foi alterada.

| Domínio | Rascunho | Homologação | Origem |
|---|---|---|---|
| Diário | `configurar-politica-correcao-diario` | `homologar-politica-correcao-diario` | nova |
| Avaliação | `configurar-politica-correcao-avaliacao` | `homologar-politica-correcao-avaliacao` | nova |
| Fechamento | `configurar-encerramento` | `homologar-encerramento` | reutilizada (`cycle-closing-store.ts`) |
| Cálculo de frequência | `configurar-politica-calculo-frequencia` | `homologar-politica-calculo-frequencia` | nova |
| Tipo de ocorrência | `configurar-tipos-ocorrencia-frequencia` | `homologar-tipos-ocorrencia-frequencia` | nova |
| Colegiado | `configurar-colegiado` | `homologar-colegiado` | reutilizada (`collegial-store.ts`) |

## Leitores e consumidores (fase 3)

Os motores continuam lendo só linhas homologadas. Sem regra homologada, eles seguem falhando fechado (`policy-not-homologated`, `correction-…`, `configuration-not-homologated`, `occurrence-type-not-homologated`). Nenhum padrão é fabricado.

## Tela (fase 4)

A rota `/regras-institucionais` (`src/features/institutional-rules/`) mostra uma seção por domínio:

- estado por extenso (não configurado, contagem de vigentes/rascunhos, acesso negado, sem sessão, falha);
- histórico com o estado projetado de cada versão;
- pré-visualização, rascunho e homologação;
- erros por `userErrorText`: autorização, conflito, dependência normativa e validação, nunca SQL ou stack.

Hoje toda conta vê "Acesso negado", porque nenhuma capacidade foi concedida. A tela não aparece no menu, o que deve ser decidido na BQ.1.

## Testes (fase 5)

- `supabase/tests/bt_institutional_rule_writers.sql`, executado como owner em uma transação revertida por erro marcador. Resultado: `BT_EXECUTADO_OK base={0,0,0,0,0,0,8,1659}`; depois, resíduo zero confirmado. O teste cobre:
  - (1) ACL pelos endpoints públicos: sem sessão, sem pessoa, sem capacidade em rede e em escola (todos os 12 writers + leitor + preview);
  - (2) núcleo com UUIDs sintéticos (`00000000-b7b7-4e11-8000-0000000000a1/b2`, pessoas órgão "TESTE SINTÉTICO BT", atuações de tipo já existente sem as capacidades novas): payload inválido, vigência, escopo (turma inexistente), domínio, autoria ausente;
  - fluxo v1 → leitura → stale → autohomologação recusada → homologação → consumidor `applicable_diary_policy_on` → asOf/knownAt → v2 → consumidor v2 → v1 preservada como `superada`;
  - UPDATE/DELETE recusados; homologação dos 6 domínios gravando o status do motor; `collegial_conduct_authority` lendo a configuração homologada;
  - policy e regras inalteradas.
- O caminho positivo **autenticado** pelos endpoints fica para a BQ.1, porque depende da policy homologada conceder as capacidades. Não forjamos policy.
- `src/features/institutional-rules/institutional-rules.test.ts` (7 testes): seis domínios, reutilização de capacidade, sem grant/policy/DML, estados explícitos, base esperada, categorias BK.

## Gates

Registrados no adendo BT de `docs/bq0-preflight-configuracao-2027.md`.

## Continua HUMAN_CONFIGURATION / INSTITUTIONAL_RULE

- Quem recebe cada capacidade e em que tipo de atuação: BQ.1 (decisões 1–7 da BQ.0).
- O conteúdo das regras (famílias, exigências, prazos, fórmulas, tipos de ocorrência, composição de colegiados): BQ.5, por decisão da SEMED.
- Entrada da tela no menu: BQ.1.
