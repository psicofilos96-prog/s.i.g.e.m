# CIECE / Mapa / Censo / GPE — matriz de produto (Lote N4)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Fontes: código de src/features/statistical-map, ciece, census-*, data-import; AGENTS.md por diretório; memórias setoriais em docs/.

| Requisito | Implementação | Teste | Situação |
|---|---|---|---|
| B. Painel da rede: andamento, filtro por situação | network-projection-page.tsx (Oficializado/Aguardando, barra de progresso, filtro) | statistical-map (64) | PASS parcial |
| D. "De onde veio este valor" | painel lateral com registros que compõem cada número | idem | PASS |
| B. Fluxo enviado/devolvido/reenviado/aprovado/retificação | DECIDIDO; `projectWorkflow` projeta da cadeia persistida | map-structures.test | PARTIAL: devolução como ato próprio da Estatística exige migration (N4.3) |
| C. Seis estruturas I–VI | `groupByStructure` + índice fixo na tela | map-structures.test | PASS |
| E. PDF institucional dedicado | `renderMapDocument` A4, atual e por revisão | map-structures.test | PASS (sem inspeção visual autenticada) |
| Override calculado × efetivo | não persistido | — | PENDENTE N4.3 |
| F. Censo — qualidade | /censo-escolar (ciclo, fotografia, comparação) | census tests | existente, sem redesenho |
| G. GPE | EXTERNAL_INTEGRATION_UNDEFINED: sem leiaute real | — | BLOQUEADO por leiaute |
| Remanejamento (peso) | não inventado; não bloqueia as demais estruturas | — | DECISÃO PENDENTE |
| I. Testes autenticados (CIECE, 2 Secretarias, Direção) | — | — | exige aprovação de sessão |

## N4.3 — fechamento do Mapa I–VI (migration 0211)

| Item | Implementação | Prova | Situação |
|---|---|---|---|
| Devolução própria da Estatística | `return_statistical_map` (evento `devolucao`, motivo, cabeça esperada = envio pendente, pessoa OU principal setorial); reaproveita `oficializar-mapa-estatistico` (quem aprova devolve); aprovado ⇒ `map:approved-use-rectification` | `map-n43.test.ts`, `supabase/tests/n4_3_map_return_adjust_next.sql` | PASS código/unitário; SQL não executável no sandbox (sem privilégio) |
| Ajustes/overrides | `statistical_map_cell_adjustments` append-only (trigger), `record_map_cell_adjustment` com cabeça esperada, motivo, lado escola/Estatística; só células em `adjustableCellIds` da regra homologada; anulação = novo fato; snapshot guarda calculado + efetivo, logo PDF histórico reproduz a revisão | `map-n43.test.ts` | PASS código; nenhuma regra homologada declara células ajustáveis ainda |
| Próxima competência | `open_statistical_map` chama `map_previous_competence_issue` quando a regra declara `requirePreviousCompetenceOfficial`; ausência de Mapa anterior = recusa; janeiro olha dezembro anterior; mês anterior não operacional não exige | SQL N4.3 | PASS código |
| Mediadores (V) | `map_mediation_projection_at` (capability do Mapa, sem nome do estudante) → `mediationCell`; carência: "aguardando regra institucional" | `map-n43.test.ts` | PASS código |
| Isolamento por perfil | writers revalidam capability por `school_id` do Mapa no banco; ACL testada | SQL N4.3 / T1 | PARTIAL: sessões reais por perfil não executadas |
| PDF atual/histórico/2 escolas | gerador usa snapshot da revisão | unitário | BLOQUEADO por dado: 0 regras do Mapa homologadas e 0 Mapas no banco |
| Remanejados | — | — | DECISÃO PENDENTE (aguardando regra institucional) |

Gates: 3.889 testes/323 arquivos, 31/31 deep, typecheck, migration integrity, diff-check OK; Security Advisor sem achado novo; resíduo sintético zero (0 regras, 0 Mapas, 0 ajustes).

- N5.3.2: composição da turma lida de `class_composition_at`; subtotais pela posição individual (B3.3), total = estudantes únicos; sem posição = "Posição curricular não registrada".
