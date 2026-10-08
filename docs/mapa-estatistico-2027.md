# Mapa Estatístico 2027 — Frente T

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Banco canônico: Lovable Cloud `crfqhyqkujhhlbiyhdbc`. Status: **PARTIAL — mecanismo pronto e fail-closed; aguarda regra homologada e abertura humana do ano 2027.**

## Fluxo
regra homologada (cobre a escola) → ano operacional (ledger S1) → abertura da competência → montagem automática → conferência (Secretaria) → oficialização (Direção, pessoa ≠ quem conferiu) → snapshot imutável → correção = nova versão.

## Implementado
- Migrations 0119–0121: writers por sessão (`auth.uid()` → pessoa → atuação → capacidade) para rascunho/homologação de regra, abertura, conferência, correção e oficialização; rotas `_actor`/service_role revogadas; DML direto revogado; rascunho só transita uma vez para homologada sem alterar definição/vigência/autoria; regra homologada imutável; sem DELETE.
- Regra com cobertura explícita `coveredSchoolIds`; draft, fora de vigência ou escola fora da lista ⇒ não se aplica. O dia da fotografia vem só da regra; nenhum default.
- Ano: `map_year_state_on`; só `operacional` permite oficialização. 2026 = `historico-importado` (baseline), 2027 = sem estado.
- "Matrícula do mês anterior" herdada e travada do snapshot oficial vigente do mês anterior (célula declarada pela regra); primeiro mês ⇒ ausente, nunca zero nem baseline 2026.
- Regentes apenas por `teaching_assignments_at` vigente na data; lotação não cria regência. Jornada profissional e mediadores: sem fonte.
- Tela: escola, mês e ano escolhidos explicitamente; estado do ano; dinâmico × oficial; CSV/XLSX/PDF do motor de relatórios a partir das mesmas células (oficial congelada quando houver).
- Painel de regras na visão da rede (lista, rascunho, homologar).

## Não feito (por decisão)
Nenhuma regra real homologada, nenhum Mapa 2027 aberto/oficializado, nenhum ato humano simulado.

## Provas
`src/features/statistical-map/map-2027.test.ts`; `supabase/tests/t_map_rule_guard.sql` (rollback). Limitação: o papel do sandbox recebe `permission denied` antes do gatilho em UPDATE, então o teste prova recusa, e a lógica do gatilho é provada por inspeção da 0121.

## Adendo (05/10/2026) — data da fotografia decidida pelo proprietário
- Critério normativo: **último dia letivo do mês conforme o calendário oficial aplicável à escola/competência** (`snapshotDate.kind = "ultimo-dia-letivo-do-mes-calendario-oficial"`). A regra só referencia o critério; ninguém digita a data.
- Migration 0122: `map_rule_definition_issue` recusa qualquer outro critério (último dia civil, dia fixo, datas declaradas) em rascunho/homologação.
- Resolução (`resolveSnapshotDateBasis`): candidatos de `calendar_applicability_candidates` no 1º e no último dia do mês (mesmo calendário único) + `calendar_days_at` homologado; último dia `letivo` com todos os dias seguintes do mês declarados `nao-letivo`.
- Sem calendário aplicável, mais de um calendário, aplicabilidade bloqueada/mudando no mês, dia não determinado ou mês sem dia letivo ⇒ sem data, oficialização impedida, motivo exibido. Nenhum fallback.
- A base (calendário, versão, knownAt) entra no snapshot (`snapshotDateBasis`) e é congelada na oficialização; correção posterior do calendário só afeta competências não oficializadas (mudança de marca exige nova conferência/versão).
- Calendários distintos podem dar datas distintas a escolas distintas no mesmo mês.
- Primeiro Mapa de 2027: "não há Mapa oficial do mês anterior", sem valor inventado.
- Limitação: o banco não recalcula o último dia letivo na oficialização; a garantia é a remontagem no servidor + marca da conferência.
- Status: prontidão técnica. Pendentes só atos humanos: redigir/homologar a regra, abrir 2027, conferir e oficializar.

## Complemento (05/10/2026) — critério configurável e versionado
1. **Regra institucional atual:** último dia letivo do mês pelo calendário oficial aplicável (`ultimo-dia-letivo-do-mes-calendario-oficial`), derivado do calendário, nunca digitado; sem calendário ou com ambiguidade ⇒ bloqueia.
2. **Capacidade do produto:** o critério é tipo estruturado de um catálogo fechado e validado (`map_snapshot_criterion_issue`, 0123, e `snapshotCriterionIssue`): também admite `dia-fixo-do-mes {day 1–31}` e `data-definida-por-competencia {dates: AAAA-MM → data do mês}`; tipo desconhecido, parâmetro extra/inválido, expressão, SQL ou código são recusados. Mudar o critério = nova versão de regra, com vigência e escopo, redigida e homologada por pessoas distintas; regra homologada é imutável (0121).
3. **Histórico:** cada Mapa guarda a regra (`rule_id`/`rule_version`), o critério e a base da data no snapshot; regra posterior nunca recalcula Mapa oficial.
- Aplicabilidade (0123): dentro da mesma regra a maior versão homologada vigente sucede as anteriores; regras distintas simultâneas para a mesma escola/mês ⇒ `regras-ambiguas`, sem escolher a mais nova.
- A 0122 permanece como história; a 0123 substitui sua validação.

## Fechamento T.1 (05/10/2026) — abertura fail-closed e fronteira de confiança da oficialização
- **0124 — ambiguidade na abertura:** `open_statistical_map` resolve a regra por `map_single_applicable_rule` sob o lock da competência: 0 ⇒ `map:no-homologated-rule`; >1 regra lógica ⇒ `map:ambiguous-rules` (sem INSERT); 1 ⇒ exatamente ela (`SELECT … INTO STRICT`).
- **0124 — vinculação de conteúdo:** a conferência passa a ser `record_map_conference(map, fingerprint, snapshot)`; o banco valida a coerência e grava `snapshotDigest` (SHA-256 do jsonb normalizado, calculado no banco). A assinatura antiga só por marca perdeu EXECUTE. `officialize_statistical_map` recusa snapshot cujo digest ≠ o conferido (`map:snapshot-not-conferred`), mesmo com fingerprint válido.
- **Coerência revalidada no banco na conferência e na oficialização** (`map_snapshot_binding_issue`): escola/ano/mês, regra id/versão, data dentro do mês, `yearState = operacional`, base com critério da regra e sem motivo de bloqueio; `dia-fixo`/`data-definida` recalculados da regra; último dia letivo exige um único calendário candidato no 1º e no último dia com a MESMA versão da base.
- **Concorrência:** a oficialização segura o lock do Mapa e o lock da regra (o mesmo dos writers de regra); regra nova/sucessora (`map:rule-changed-since-conference`) ou nova versão/aplicabilidade do calendário (`map:calendar-changed-since-conference`) depois da conferência exigem nova conferência. Mantidos: última conferência, conferência não reutilizada, conferente ≠ oficializador, stale-head, correção e ano operacional.
- Limite declarado: o banco não recalcula o último dia letivo dia a dia; ele exige a mesma versão de calendário conferida, e a data foi vista pela conferente humana e vinculada por digest.
- **0125:** a CHECK legada que exigia ato externo para regra homologada (contrária à decisão do proprietário e ao writer da 0119) foi substituída por exigência de autoria humana (`homologated_person_id`) ou referência legada.
- Provas: `supabase/tests/t1_map_open_officialize_binding.sql` (bloco termina em RAISE `t1-map-tests-ok`; zero resíduo verificado), incluindo ACL anon/service_role/authenticated e recusa de authenticated sem pessoa/capability.
- **Status: PASS — READY_FOR_2027_HUMAN_MAP_OPERATION.** Pendências só humanas: redigir/homologar a regra real, abrir 2027, Secretaria conferir, Direção oficializar.
