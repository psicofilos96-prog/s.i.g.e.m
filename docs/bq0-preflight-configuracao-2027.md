# BQ.0 — Pré-flight da configuração institucional controlada 2027

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Data: 2026-10-06 (19:13–19:40 UTC). Software auditado: `ae56fb3d`, mais uma correção pequena (seção I.3). Migrations 0000–0200, nenhuma nova.
Fontes desta auditoria: apenas leitura do banco e do repositório. Não houve configuração, homologação, atribuição, importação nem fixture.
Sem PII: pessoas aparecem só pelo tipo de atuação.

## A. Snapshot real

| Item | Estado |
|---|---|
| Ano 2026 (`ano-431e…`) | estado `historico-importado` (baseline Educacenso 2026); 698 turmas, todas no ano 2026, em 55 escolas, vigência aberta desde 2026-08-31 |
| Ano 2027 (`ano-500f…`) | versão 1, 2027-01-01→12-31, ativo; nenhum estado operacional registrado |
| Organizações de períodos 2027 | 3 (Ensino Regular/anual: 3 períodos; EJA semestral: 4; EJA Fase I/anual: 3) = 10 períodos; 10 ligações de rede período↔calendário; 1 ligação ano civil |
| Calendário 2027 | 3 calendários lógicos; 4 versões; 4 homologações; 1.460 atribuições de dia; 52 eventos; 14 tipos de dia; 4 configurações de conselho; 4 snapshots; 1 norma de composição homologada; 1 designação de autoridade |
| Turmas × 2027 | 0 turmas 2027; 0 vínculos turma→organização (`institutional_class_period_organization_versions` = 0); 0 grades |
| Escolas | 55 com versão cadastral; nenhuma configuração específica de 2027 |
| Políticas | 8 versões da `politica-capacidades-diario`: v1 e v2 em rascunho; v3–v8 homologadas (v3 ativação inicial; v4–v8 decisão do proprietário). Vigente: v8 desde 2026-10-05, 271 regras |
| Regras v8 por tipo de atuação | administrador-geral 110 · secretaria-escolar 37 · direcao-escolar 36 · gestao-pedagogica-da-rede 23 · professor 19 · orientacao-pedagogica 17 · cadastro-institucional-da-rede 13 · ciece-auditoria-coordenacao 9 · ciece-estatistica 5 · rh-profissionais-da-rede 2 |
| Atuações reais | 2, ambas de órgão institucional e em rede, vigentes desde 2026-10-04 sem fim: `administrador-geral-do-sigem` e `autoridade-calendario-da-rede` (Supervisão) |
| BM | `consultar-desempenho-educacional`, `manter-metrica-desempenho`, `manter-painel-inteligencia`: 0 regras |
| NAE/Cozinha | 22 capabilities de alimentação no código: 0 regras; 0 cozinhas; 0 registros mestres; 0 fatos |
| Família | writer `record_guardian_authorization_v3` (v1 sem EXECUTE): capability `manter-autorizacao-de-responsavel` sem regra; 0 autorizações |
| AEE | tabelas `aee_*` e writer `record_aee_service`; capability `registrar-sessao-aee` sem regra; nenhum tipo de atuação AEE; 0 registros |
| Currículo | 0 componentes, 0 matrizes/versões/homologações, 0 E2/E3/E4, 0 posições curriculares, 0 edições de referência BNCC/SAEB, 0 valores de catálogo |
| Templates/documentos | 0 templates de documento escolar; 0 templates de notificação; 0 documentos da base de conhecimento |
| Fontes/imports | 0 lotes de importação; 0 importações de censo. Em `docs/data/`: staging de escolas do Educacenso 2026, contrato D1 CME 3/2026 e fonte de matrizes CME 3/2026 (ainda não aplicada) |
| Regras institucionais | 0 políticas de correção do diário, 0 de correção de avaliação, 0 de fechamento de ciclo, 0 de cálculo de frequência, 0 configurações de colegiado, 0 regras do Mapa, 0 políticas de designação de turma; retenção = `RETENTION_UNDECIDED` |

**Atividade externa durante a BQ.0.** Às 19:13:39 UTC a conta real do Administrador Geral (atuação `4627…`) salvou e homologou a versão 2 do calendário EJA semestral (`9e65…`, retificação de `e442…`). Mudou exatamente um dia, 2027-05-26 (tipo de dia trocado). O ato foi gravado pelos writers oficiais, com base esperada. Não foi obra de teste nem da BQ.0. Ver seção E e a decisão 1.

## B. Matriz já configurado / decidir / fonte / validar

| # | Domínio | Estado atual | Origem | Vigência | Usar em 2027? | Ação | Classe | Writer/preview/reader | Pré-requisitos |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Perfis/atuações | 2 atuações de órgão | ativação + designação | 2026-10-04→ | SIM (as 2) | registrar pessoas e atuações reais por escola/turma | HUMAN_CONFIGURATION | `register_person`, `record_engagement`/`end_engagement`; `effective_capabilities` | BQ.1 (regras) e lista nominal da SEMED |
| 2 | BM | capabilities sem regra | código | — | NÃO | decidir tipos/escopos | INSTITUTIONAL_MODEL_PENDING | `register_capability_policy_draft_expected` → `preview_capability_policy` → `homologate_capability_policy_expected` | decisão 4 |
| 3 | NAE/Núcleo/Cozinha | 22 capabilities sem regra; não há tipo de atuação Núcleo/Cozinha | código | — | NÃO | decidir tipos de atuação e regras | INSTITUTIONAL_MODEL_PENDING | mesmo trio de política; `record_meal_kitchen` | decisão 5 |
| 4 | Família writer | capability sem regra | código | — | NÃO | decidir quem concede | INSTITUTIONAL_MODEL_PENDING | trio de política; `record_guardian_authorization_v3` | decisão 6 |
| 5 | AEE | modelo de dados existe; sem tipo/regra | código | — | DEPENDE | decidir se adota | INSTITUTIONAL_MODEL_PENDING | trio de política; `record_aee_service` | decisão 7 |
| 6 | Calendário/ano 2027 | 3 calendários homologados (EJA na v2) | Supervisão 04/10 + Adm. Geral 06/10 | 2027 | SIM, tecnicamente | conferência humana; ratificar autoria da v2 | SUBJECTIVE_HUMAN_VALIDATION | `calendar_list_at`/`calendar_days_at`; `save_network_calendar`/`homologate_network_calendar` | decisão 1 |
| 7 | Períodos/organizações | 3 organizações / 10 períodos 2027 | 04/10 | 2027 | SIM | ligar turmas 2027 às organizações | HUMAN_CONFIGURATION | `record_class_period_organization_version` | turmas 2027 (item 10) |
| 8 | Matrizes curriculares | nenhuma | fonte CME 3/2026 em `docs/data` | — | DEPENDE | importar pelo D1 após decidir aplicabilidade a 2027 | OFFICIAL_SOURCE + HUMAN_CONFIGURATION | D1 → `record_curricular_matrix_version`; `curricular_matrix_version_homologations` | componentes (`register_curricular_component_version`) e decisão 8 |
| 9 | Catálogos/BNCC/SAEB | nada carregado | — | — | NÃO | carregar edições oficiais | OFFICIAL_SOURCE | writers v2 de referência curricular; `record_attribute_value_version` | arquivos oficiais |
| 10 | Educacenso 2027 | só baseline 2026 (escolas + turmas) | INEP 2026 | 2026 | NÃO para 2027 | turmas 2027 por cadastro ou fonte 2027 | OFFICIAL_SOURCE + HUMAN_CONFIGURATION | `register_institutional_class`/`record_institutional_class_version`; `stage_import_batch` | decisão 9 |
| 11 | DP | DP_FILE_CONTRACT_PENDING | — | — | NÃO | receber a planilha oficial | OFFICIAL_SOURCE | staging D-import | arquivo real |
| 12 | Custos alimentação | inexistente | — | — | NÃO | fonte oficial de custo | OFFICIAL_SOURCE | `record_meal_master` (referência contratual) | item 3 |
| 13 | Correção do diário | 0 políticas; **sem writer** | — | — | NÃO | ver seção I | INSTITUTIONAL_RULE + **defeito técnico** | inexistente | writer governado |
| 14 | Correção de avaliação | 0; **sem writer** | — | — | NÃO | idem | INSTITUTIONAL_RULE + **defeito técnico** | inexistente | idem |
| 15 | Retenção | indecidida (nada é descartado) | código | — | SIM (reter) | decidir prazos | INSTITUTIONAL_RULE | `RetentionConfig` (configuração) | decisão jurídica |
| 16 | Fechamento | atos existem (`record_period_closing_act`, `record_cycle_closing`); 0 políticas de fechamento de ciclo; **sem writer** | — | — | NÃO | idem | INSTITUTIONAL_RULE + **defeito técnico** | inexistente para a política | idem |
| 17 | Regras NAE | nenhuma | — | — | NÃO | adesão, desperdício, estoque mínimo, prazo NC, baixa teórica, transferência | INSTITUTIONAL_RULE | `record_meal_master` (espécies homologáveis) | item 3 |
| 18 | Templates/documentos | 0 | — | — | NÃO | criar templates oficiais | HUMAN_CONFIGURATION | `record_school_document_template_version`, `record_notification_template` | modelos da Secretaria |
| 19 | Ajuda/conteúdo | 0 documentos | — | — | NÃO | carregar conteúdo | HUMAN_CONFIGURATION | `record_kb_document_version` | — |
| 20 | Portal público | readers anon intencionais; sem conteúdo institucional | — | — | DEPENDE | decidir o que publicar | HUMAN_CONFIGURATION | `public_portal_*` | decisão 10 |
| 21 | Validação UX | — | — | — | — | homologação humana por perfil | SUBJECTIVE_HUMAN_VALIDATION | harness por perfil | BQ.2 |
| 22 | Concorrência | não provada em paralelo | BP | — | — | prova em banco descartável antes de produção | VERIFICATION_LIMITATION | branch descartável | pré-produção |

Também são regras institucionais sem writer: cálculo de frequência (`attendance_calculation_policies`), tipos de ocorrência (`attendance_occurrence_types`) e configuração de colegiado (`collegial_body_configurations`). Ver seção I.

## C. Ordem operacional (DAG)

```text
D0 decisões 1–3 (autoria do calendário, menor privilégio, tipos de atuação)
 └─ BQ.1 política v9 (regras novas) ─┬─ BQ.2 pessoas/atuações reais
                                     └─ (paralelo) BQ.3 conferência calendário 2027
BT writers de regras institucionais (seção I) ── antes de BQ.5
BQ.4 componentes → matrizes (D1/CME) → homologação → E2/E3/E4
BR fontes oficiais: Educacenso 2027 → turmas 2027 → organização da turma → grade → enturmação
BQ.5 regras acadêmicas (correção, frequência, fechamento, colegiado, Mapa)  [requer BT]
BQ.6 NAE (cozinhas, mestres, regras)  [requer BQ.1 Núcleo/Cozinha]
BQ.7 templates / ajuda / portal       [paralelo após BQ.1]
Homologação por perfil + UX + concorrência descartável  [após BR e BQ.5]
```

As turmas 2027 dependem de fonte ou cadastro humano (BR). O vínculo turma→organização, a grade, a matriz por turma (E4) e a enturmação só começam depois delas.

## D. Dossiê de capabilities (sem decidir)

| Capability | Protege | Efeito | Escopos suportados | Tipos que tecnicamente poderiam receber | Risco | Menor privilégio | Decisão SEMED |
|---|---|---|---|---|---|---|---|
| `consultar-desempenho-educacional` | `inst_assessment_results_at` e readers BM | lê resultados por escola/rede | escola, rede | direção, gestão pedagógica, orientação, CIECE | exposição de desempenho individual | escola para a direção; rede só para a gestão | quem lê, em que escopo |
| `manter-metrica-desempenho` | métricas BM | define fórmula/métrica | rede | gestão pedagógica, CIECE coordenação | métrica vira norma | só rede, separada de quem consulta | quem define métricas |
| `manter-painel-inteligencia` | editor/queryRef BM | publica painéis | rede | gestão pedagógica | painel amplia a leitura | só rede, com o reader inalterado | quem publica painéis |
| `manter-unidades-de-alimentacao`, `manter-catalogo-tecnico-alimentar`, `manter-referencias-contratuais-alimentacao`, `administrar-janela-de-pedido-alimentar`, `analisar-pedido-alimentar`, `aprovar-inventario-alimentar`, `exportar-relatorios-alimentacao` | writers NAE.1–NAE.6 | estrutura e decisão do Núcleo | rede | não há tipo Núcleo; hoje só administrador-geral seria compatível | concentração no admin | criar tipo próprio do Núcleo | criar tipo Núcleo? quem? |
| `conferir-conteudo-tecnico-alimentar`, `homologar-conteudo-tecnico-alimentar` | ciclo rascunho→conferida→homologada | dupla checagem por pessoas distintas | rede | tipo Núcleo (2 pessoas) | uma pessoa só anularia a dupla checagem | separar conferir de homologar | quem confere e quem homologa |
| `registrar-execucao-alimentacao`, `registrar-estoque-alimentar`, `conferir-recebimento-alimentar`, `registrar-nao-conformidade-alimentar`, `registrar-programacao-de-entrega-alimentar`, `registrar-pedido-alimentar`, `registrar-cardapio-alimentar`, `registrar-previsao-alimentar`, `gerir-documentos-alimentacao` | Estação Cozinha e writers NAE.2–NAE.5 | fatos operacionais por escola/data | escola | não há tipo Cozinha; direção/secretaria tecnicamente compatíveis | escrita por setor errado | tipo Cozinha por escola | criar tipo Cozinha? escopo por escola ou por cozinha? |
| `consultar-alimentacao-escolar` | readers NAE | leitura operacional | escola, rede | direção, Núcleo | baixo | escola | quem consulta |
| `consultar-restricao-alimentar`, `registrar-restricao-alimentar` | restrições (dado sensível) | manejo sem diagnóstico | escola | Cozinha, secretaria | dado de saúde de menor | separar consultar de registrar | quem vê e quem registra |
| `manter-autorizacao-de-responsavel` | `record_guardian_authorization_v3` | concede/revoga acesso da Família | escola | secretaria-escolar, direção | IDOR familiar por concessão errada | escola, nunca rede | quem concede, com que documento |
| `registrar-sessao-aee` | `record_aee_service`/sessões | registro AEE | escola | nenhum tipo AEE; professor tecnicamente compatível | dado sensível | tipo AEE próprio | adotar AEE? com qual tipo? |
| `exportar-auditoria` | exportação de auditoria | exporta trilha | rede | CIECE coordenação, admin | vazamento em massa | rede, tipo dedicado | quem exporta |

Atribuir tudo ao administrador-geral não é recomendado: concentraria a escrita operacional fora do setor competente.

## E. Calendário 2027 (só leitura)

- Cabeças: Ensino Regular v1 (`6c93…`), EJA semestral v2 (`9e65…`, retificação da v1 `e442…`) e EJA Fase I v1 (`a149…`). Todas homologadas com sequência 1, efetivas a partir de 2027-01-01.
- Cada versão tem 365 dias atribuídos e 13 eventos. A v2 da EJA difere da v1 só em 2027-05-26 e tem 4 períodos, 1 configuração de conselho e 1 snapshot próprios.
- **Coerência técnica OK.** As cadeias estão íntegras (supersedes, sequência, base esperada), a vigência cobre o ano civil, os períodos estão dentro do ano e as ligações de rede batem com as 3 organizações. Nenhum dia ficou sem tipo.
- **Inconsistência objetiva.** O texto do ato da v2 dizia "exercido pela Supervisão Escolar", mas o ato foi feito pela atuação do Administrador Geral. Isso é um defeito de software no texto do editor (corrigido em I.3). O ato gravado continua verdadeiro na coluna de atuação e não foi reescrito (é append-only).
- **Conflito com regra do projeto.** A memória do projeto diz "SÓ a conta Supervisão constrói/altera/homologa". Porém a v8 concede `construir`/`homologar-calendario-da-rede` ao administrador-geral e à gestão pedagógica. Resolver isso exige nova política (BQ.1, decisão 1); não alterei nada.
- Dias letivos e totais: o motor só os calcula por calendário aplicável a uma alocação. Como não há turmas 2027, não há totais por turma. A conferência humana do conteúdo (datas, feriados, eventos) fica para a Supervisão.

## F. Currículo 2027

Não existe nada carregado: componentes, matrizes, homologações, E2/E3/E4, posições, BNCC/SAEB e catálogos estão todos em zero. Existe só a fonte CME 3/2026 com o contrato D1 de 22 posições, em `docs/data`. Para vincular turmas 2027 faltam: componentes, então matriz pelo D1, então homologação (writer R5), perfil E2 e correspondência E3 (ou E4 por turma) e, por fim, as turmas 2027 e a posição curricular por alocação. Nada foi criado nem inferido (carga horária só como literal da fonte).

## G. Contratos de entrada das fontes oficiais

| Fonte | Contrato existente | Formato | Chaves | Proveniência | Fluxo |
|---|---|---|---|---|---|
| Educacenso 2027 | adaptador `missing(...)` (sem leiaute 2027); staging de escolas 2026 serve de referência | XLSX/CSV INEP | INEP da escola, código da turma, ano do censo | SHA-256 do arquivo, emissor e data | `stage_import_batch` → classificação (válida/rejeitada/duplicada/conflito/já reconciliada) → prévia → confirmação humana → writers canônicos → `record_import_event` e relatório de divergência |
| DP | DP_FILE_CONTRACT_PENDING (`data-import/AGENTS.md`) | planilha oficial do DP | matrícula funcional | hash | mesmo pipeline; ausência na planilha não prova desligamento |
| BNCC/SAEB | repositório curricular Frente Y (0133–0134) | edição oficial | código do item + edição | edição, hash, texto imutável | writers v2 de referência, homologação por pessoa distinta |
| Custos alimentação | não existe contrato | documento contratual | item/contrato | hash | `record_meal_master` (referência contratual) depois da BQ.6; ainda falta definir o contrato |
| Matrizes CME 3/2026 | `d1-contrato-canonico-cme-3-2026.json` | JSON transcrito | 22 posições | hash da fonte | D1: prévia, validação, confirmação, writer de matriz |

## H. Plano em lotes

| Lote | Entradas humanas | Operações oficiais | Validação | Versionamento | Gate de saída | Proibido sem decisão |
|---|---|---|---|---|---|---|
| **BT** (técnico, nova frente) | — | writers governados para as 6 tabelas de regra (seção I) | testes e Advisor | append-only + homologação | writers executáveis por capability | — |
| BQ.1 | decisões 1–7 | rascunho v9 → preview → homologação | preview sem `policy:would-remove-administration` | v9 encadeada à v8 | v9 vigente | conceder sem decisão |
| BQ.2 | lista nominal por escola | `register_person`, `record_engagement` | harness por perfil real | atuação com vigência | cada perfil com as capabilities esperadas | atribuir pessoa não indicada |
| BQ.3 | conferência da Supervisão | retificação só se necessária | readers do calendário | nova versão + homologação | calendários ratificados | alterar sem a Supervisão |
| BQ.4 | aplicabilidade do CME 3/2026 a 2027 | componentes, D1, homologação, E2/E3 | readers `*_at` | versões + ledger | matriz homologada | inferir carga horária |
| BR | arquivos oficiais | staging → writers | relatório de divergência | lotes imutáveis | turmas 2027 reconciliadas | importar sem confirmação |
| BQ.5 | regras de correção, frequência, fechamento, colegiado, Mapa | writers BT + `record_map_competence_rule_draft`/`homologate_*` | testes de regra | versões homologadas | regras vigentes | regra presumida |
| BQ.6 | regras e custos NAE | `record_meal_kitchen`, `record_meal_master` | NAE readers | rascunho→conferida→homologada | cozinhas e mestres homologados | número inventado |
| BQ.7 | templates, ajuda, portal | writers de template/kb | revisão humana | versões | publicado | publicar sem decisão |

## I. Pré-flight técnico

1. **Existem e são executáveis por `authenticated` (nunca `anon`), com guarda interna:**
   - política: `register_capability_policy_draft_expected`, `preview_capability_policy`, `homologate_capability_policy_expected`;
   - pessoas e atuações: `register_person`, `record_engagement`, `end_engagement`;
   - calendário: `save_network_calendar`, `homologate_network_calendar`;
   - ano e períodos: `register_academic_year_version`, `register_period_organization_version`, `register_academic_period_version`;
   - turmas: `register_institutional_class`, `record_institutional_class_version`, `record_class_period_organization_version`, `record_class_schedule_version`, `record_class_offering_version`, `record_class_specific_matrix_association_version`;
   - currículo e catálogos: `register_curricular_component_version`, `record_curricular_matrix_version`, `record_attribute_value_version`;
   - importação: `stage_import_batch`, `record_import_event`;
   - templates e conteúdo: `record_school_document_template_version`, `record_notification_template`, `record_kb_document_version`;
   - NAE: `record_meal_kitchen`, `record_meal_master`;
   - Família e AEE: `record_guardian_authorization_v3`, `record_aee_service`;
   - normas e Mapa: `register_assessment_norm_version`, `record_calendar_composition_norm_version`, `record_map_competence_rule_draft`, `homologate_map_competence_rule`, `homologate_class_designation_policy`.

   Todos usam base esperada e ledger append-only.
2. **Defeito técnico concreto: faltam writers.** Estas tabelas de regra institucional, consumidas por motores existentes, não têm writer governado. O DML direto está revogado para todos os papéis (0135/0163), então a única forma de configurá-las seria por migration/DML, que é um bypass proibido:
   - `diary_correction_policies` (consumida por `applicable_diary_policy_on`);
   - `assessment_correction_policies`;
   - `cycle_closing_policies`;
   - `attendance_calculation_policies`;
   - `attendance_occurrence_types`;
   - `collegial_body_configurations`.

   Isso contradiz a premissa do Gate 2 da BP ("nenhuma configuração exige bypass") para esses domínios. É uma frente técnica de tamanho real (writers com capability, versão, homologação e testes), por isso não foi corrigida aqui. Classificação: **STILL_TECHNICAL**.
3. **Defeito pequeno corrigido.** `editorActRef` (calendar-central) atribuía todo ato do editor à "Supervisão Escolar". Agora diz "conta autenticada; autoria = atuação registrada no próprio ato". Teste `calendar-act-ref.test.ts`. O ato já gravado não foi alterado.
4. **Gates após a correção:** suíte completa 3.821/3.821 (312 arquivos), deep 31/31, tsgo limpo, build OK, migration integrity ok, `git diff --check` limpo.
5. **BQ.1 pode começar.** O fluxo de política funciona e não depende dos writers ausentes. BQ.5 (regras acadêmicas) está bloqueado até a frente BT.

## Decisão

**PARTIAL — STILL_TECHNICAL: faltam writers governados para as políticas de correção do diário, correção de avaliação, fechamento de ciclo, cálculo de frequência, tipos de ocorrência e configuração de colegiado.** Configurá-las para 2027 exigiria bypass. O inventário, a matriz, o DAG, o dossiê e o plano estão completos. BQ.1 pode prosseguir em paralelo; BQ.5 depende da frente BT.

2027 não está configurado.

## DECISÕES QUE PRECISAMOS DO RESPONSÁVEL INSTITUCIONAL

1. Calendário: o Administrador Geral e a Gestão Pedagógica devem manter `construir`/`homologar-calendario-da-rede`, ou isso fica só com a Supervisão? A v2 da EJA (troca de 2027-05-26, feita pelo Adm. Geral em 06/10) é ratificada?
2. Lista nominal de pessoas por tipo de atuação, escola e turma para 2027.
3. Quem concede acesso da Família (`manter-autorizacao-de-responsavel`) e em que escopo.
4. BM: quem consulta desempenho, quem define métricas e quem publica painéis, e em que escopo.
5. NAE: criar os tipos de atuação Núcleo e Cozinha? Quem confere e quem homologa conteúdo técnico (pessoas distintas)? Qual o escopo da Cozinha (por escola ou por unidade de preparo)?
6. Restrição alimentar: quem consulta e quem registra.
7. AEE: adotar o perfil em 2027? Se sim, qual tipo de atuação e escopo?
8. A matriz CME 3/2026 se aplica a 2027 integralmente ou há nova deliberação?
9. Turmas 2027: vêm do Educacenso 2027 ou de cadastro prévio pela Secretaria?
10. Prazos de retenção, conteúdo do portal público e modelos oficiais de documentos.

Não executado: nenhuma política, regra, atuação, pessoa, importação, calendário, matriz, template ou fixture. STOP após BQ.0.

## Adendo BT — writers governados (2026-10-06)

O STILL_TECHNICAL do item I.2 está **resolvido**. Detalhes em `docs/frente-bt-writers-regras-institucionais.md`.

- Migrations aditivas `0203` e `0204` (0000–0202 não foram tocadas): dois ledgers append-only (rascunho e ato de homologação), 12 writers específicos, pré-visualização e leitor temporal. A homologação insere a linha já homologada na tabela que o motor lê, e nenhum consumidor mudou.
- Capacidades: as do colegiado e do encerramento foram reutilizadas; 8 capacidades novas e específicas foram criadas. Nenhuma regra de policy foi adicionada e a v8 não mudou.
- Prova transacional owner executada e revertida (`BT_EXECUTADO_OK`), com resíduo zero.
- Gates:
  - testes: suíte 3850/3850 (315 arquivos), deep 31/31;
  - checagens: tsgo limpo, build OK, migration integrity ok com hashes congelados, diff-check limpo;
  - Advisor 503 → 519 (+2 tabelas de ledger sem policy, por desenho; +14 endpoints DEFINER para usuários autenticados; anon inalterado, 3);
  - smoke de `/regras-institucionais` sem erros;
  - dados preservados: 55 escolas, 9.763 alunos, 10.822 pessoas, 2 atuações, 8 políticas, 7 versões e 7 homologações de calendário, 0 regras nas seis tabelas.
- O Gate 2 da BP ("nenhuma configuração exige bypass") agora vale também para esses domínios. 2027 continua **não configurado**. BQ.1 depende das decisões 1–7, e BQ.5 depende das regras que a SEMED decidir.
