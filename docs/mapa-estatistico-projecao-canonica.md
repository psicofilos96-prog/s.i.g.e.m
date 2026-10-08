# Frente H — Mapa Estatístico como projeção canônica

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


**Status: PARTIAL (arquitetura PASS; oficialização BLOCKED por ausência de regra homologada).**

- A fotografia é montada no servidor (`statistical-map.functions.ts`) apenas a partir de fontes canônicas: versões cadastrais das escolas, vínculos entre unidades, atuações de direção, infraestrutura (0105), turmas (`class_at`), matrículas e motor de indicadores 14.2. Não há tabela de Mapa editável nem total digitado.
- Campo ausente é exibido como "não informado"; `null` nunca é convertido em zero.
- Temporalidade: a fotografia usa data de referência e células declaradas pela regra `map_competence_rules`; `known_at` das fontes não vira `valid_from`.
- Impressão/exportação saem da mesma projeção (motor de relatórios).
- Conferência/oficialização só por `record_map_conference` / `officialize_statistical_map` (service_role + `_actor` verificado, segregação conferente ≠ oficializador).

## Estado real (Cloud, 05/10/2026)
| Item | Valor |
|---|---|
| Escolas | 55 |
| Fatos de infraestrutura | 2.970 |
| Turmas | 698 |
| Matrículas escolares observadas | 9.811 |
| Regras de competência do Mapa homologadas | **0** |

## Bloqueador
Sem regra homologada (`map_competence_rules`), o Mapa não declara células nem data e **não conclui** (princípio de configurabilidade normativa). Nenhuma regra foi criada pela automação, porque regra é norma e não pode nascer no código. A projeção de rede (`network-projection`) continua disponível para leitura.

## Evolução — Frente T (atual)
O registro H acima é histórico. Situação atual: Cloud canônica com 55 escolas e 698 turmas; mecanismo de regra/competência por sessão pronto (0119–0121); 0 regras homologadas por decisão (dia da fotografia não decidido). Ver `docs/mapa-estatistico-2027.md`.

## Evolução (05/10/2026)
Data da fotografia decidida: último dia letivo do mês pelo calendário oficial aplicável (0122). Ver `docs/mapa-estatistico-2027.md`.
Complemento: o critério é configurável/versionado (catálogo estruturado, 0123); o último dia letivo é a regra institucional atual, não regra eterna.
