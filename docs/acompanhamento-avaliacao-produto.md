# Acompanhamento e Avaliação — matriz de produto (Lote N6)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Fontes: src/features/performance (0075), educational-intelligence (0179–0180), AGENTS.md dos dois módulos.

| Requisito | Estado | Teste |
|---|---|---|
| D/E. Gráfico de barras por grupo (escola/turma/habilidade), com base no tooltip, sem ranking | FEITO (performance-page.tsx) | performance (10) |
| I. "Quem entrou na conta": base, ausentes, não aplicados; ausência ≠ zero | FEITO | idem |
| Comparação temporal só com mesma fórmula/população | existente | performance |
| Supressão de grupo pequeno só com política registrada | existente | performance |
| A. Home da avaliação (rede, tendências, cobertura, pendências) | PENDENTE | — |
| B. Situação planejada/em aplicação/…/publicada | PENDENTE — sem ciclo de estados no schema | — |
| D6. Heatmap habilidade × escola | N6.2: `heatmap`/`heatBand` + tabela acessível (texto em cada célula, base visível, "sem dado" ≠ 0, supressão pela política); filtros componente/ano/período e eixo etapa PENDENTES | performance (12) |
| G. BNCC ↔ SAEB | sem mapeamento homologado no código: não inventado | DECISÃO/FONTE PENDENTE |
| H. Relatórios PDF/XLSX com metodologia | PENDENTE (usar report-engine) | — |
| J. Conta avalia@ real | exige aprovação de sessão | BLOQUEADO |

Governança: nenhum score, previsão ou decisão automática sobre estudante.

## N6.2 — PARTIAL (CONTINUE_FROM=N6.2.1)
Entregue só o heatmap. Home, ciclo de estados (exige migration), evolução/barras de diferença, drill-down, relatórios, integração de importação e conta avalia@ seguem pendentes. BNCC↔SAEB: sem fonte homologada, sem equivalência.

## N6.2.1 — Ciclo versionado (parcial)
- COMPLETO: ciclo planejada → preparada → em aplicação → recebida → validada → publicada → arquivada em `assessment_edition_cycle_events` (0227), append-only por trigger, gravado só por `record_assessment_edition_cycle_event` (base esperada `seq`, lock por edição, ator/pessoa/atuação, capability `manter-programa-avaliativo`), lido por `assessment_edition_cycle_at` (knownAt). Validação e publicação são passos distintos. Modelo puro `assessment-cycle.ts` + teste.
- PENDENTE (técnico, próximo lote): tela do ciclo, home com dados reais, heatmap completo, evolução/comparação, drill-down, integração da importação, relatórios.
- DEPENDE_DADO: equivalência BNCC↔SAEB (sem fonte oficial no acervo).
- INTERACTIVE_BROWSER_VALIDATION_PENDING.

## N6.2.2 (parcial)
- Tela do ciclo ligada a `assessment_edition_cycle_events` na aba Avaliações (estado, próxima ação, histórico, confirmação para publicar/arquivar) e contagem por estado na Visão Geral. Pendentes: heatmap, evolução, drill-down, importação, relatórios. BNCC↔SAEB: DEPENDE_DADO.

## N6.2.2 parte 2 (2026-10-07)
- Evolução: `compareTemporal` agora devolve diferença absoluta e percentual (percentual só com base anterior calculada e ≠ 0; caso contrário `null` com motivo) e `compareSeries` compara cada ponto com o anterior, rompendo explicitamente quando fórmula/população/chave diferem. Teste: `src/features/performance/evolution.test.ts`.
- Ainda não ligado à tela; pendentes: tela do ciclo com transições, home por estado, heatmap com filtros completos, drill-down, importação integrada, relatórios executivos. BNCC↔SAEB = DEPENDE_DADO. NÃO PASS.

## N6.2.4 (2026-10-08) — gaps técnicos fechados (sem BNCC↔SAEB)
- Heatmap habilidade × escola exporta CSV e PDF pelo `report-engine` (mesmas células, "sem dado" ≠ zero, fórmula neutralizada, A4), bloqueado sem política de divulgação.
- Evolução com 3 ou mais edições (`evolutionSeries` sobre `compareSeries`): ordem cronológica, ruptura explícita por fórmula/população, edição sem métrica não vira zero; exportável.
- Home real da estação (`stationHome`): contagens factuais, aplicação mais recente, estado da política, próximos passos; sem nota, alerta de desempenho ou ranking.
- Importação de resultados: atalho para a Central com o adaptador `resultado-avaliacao-institucional` pré-selecionado (`/importacoes?adaptador=`).
- Relatórios da estação (`STATION_REPORTS`): heatmap e evolução disponíveis; BNCC×SAEB catalogado com dependência e recusa execução.
- Código: `src/features/performance/performance-station.ts`, `station-sections.tsx`. Teste: `station-n624.test.ts` (fixtures).
- Pendências: DEPENDE_DADO (BNCC↔SAEB); INTERACTIVE_BROWSER_VALIDATION_PENDING (conta avalia@ e dados reais); filtros componente/ano/período e eixo etapa do heatmap seguem como estavam.
