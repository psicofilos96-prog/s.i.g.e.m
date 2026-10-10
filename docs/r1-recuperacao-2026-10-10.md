# R1 — Recuperação: infraestrutura, dupla presença, turmas sem etapa, identidade de mapas

Situação atual: Registro de lote.

Sem PII: só contagens e códigos INEP de escola.

## 1. Infraestrutura escolar (migration 0287)
- Antes: política `leitura autenticada` com `USING (true)` — qualquer conta logada lia as 55 escolas.
- Depois: escola lê só a própria (`manter-cadastro-unidade-escolar`, `consultar-supervisao-da-propria-escola` ou `consultar-quadro-profissional-da-escola` na escola); rede só com `consultar-censo-escolar`, `manter-cadastro-unidade-escolar` ou `consultar-quadro-profissional-da-rede` de rede; anon com REVOKE ALL.
- Os leitores do Mapa 2026 e indicadores são INVOKER: passam a mostrar só o que o perfil pode ver (sem ampliar nada).
- Testes: `src/test/invariants/r1-infrastructure-rls.test.ts`; `supabase/tests/r1_infrastructure_scoped_read.sql` (negativos com UUID técnico aleatório e anon). Positivo com identidade funcional real: NÃO executado (não há atuação com essas capabilities; não se personifica humano).

## 2. 48 estudantes em duas escolas (97 episódios vigentes)
- Todos os 97 episódios têm início 2026-07-31 (data técnica da carga do Censo, não data real de matrícula), sem encerramento e sem natureza de participação registrada.
- Classificação:
  - Vínculo regular + AEE em outra escola: 33 estudantes (32 com 1 escola AEE, 1 com 2). Complementaridade lícita provável; temporalidade desconhecida.
  - Regular em duas escolas: 15 estudantes. Simultaneidade declarada na mesma fonte; datas reais desconhecidas. Fila de revisão da Secretaria.
  - Sucessão legítima comprovada: 0 (não há data de encerramento em nenhum).
  - Sobreposição confirmada com datas reais: 0 (não há datas reais).
- Nada foi excluído, encerrado ou rematriculado.

## 3. 49 turmas "sem etapa"
- Todas têm `Etapa de ensino = Não se aplica` na fonte: 39 de AEE e 10 de Atividade complementar.
- Conclusão: não é falha de importação; etapa não se aplica a esses tipos de turma. Nada a reconciliar.

## 4. Identidade de escolas nos mapas declarados (6 casos, 28 mapas)
| Escola (INEP oficial) | INEP na planilha | Mapas | Classe |
|---|---|---|---|
| 33097461 | ausente | 8 | INEP ausente; associação por arquivo |
| 33205299 | ausente | 3 | INEP ausente; associação por arquivo |
| 33185050 | 33005050 | 7 | código inexistente na rede (provável digitação) |
| 33100047 | 33001987 | 8 | INEP de outra escola da rede (conflito) |
| 33189781 | 33001987 | 1 | INEP de outra escola da rede (conflito) |
| 33211604 | 33001987 | 1 | INEP de outra escola da rede (conflito) |

- Nenhum caso é inequívoco pelo INEP declarado; os 6 ficam na fila de revisão documental. Nenhum mapa foi movido de escola.
