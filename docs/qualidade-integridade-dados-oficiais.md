# Qualidade e integridade dos dados oficiais — NDATA.1 (2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- NDATA.3 (2026-10-08): auditoria refeita; contagens iguais, exceto +2 versões de calendário em elaboração. Baseline e achados atuais em `auditoria-dados-oficiais-ndata3.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Somente leitura. Nada corrigido, nenhum fato alterado. Queries reproduzíveis: `docs/ndata1/auditoria-somente-leitura.sql` (`psql -At -F'|' -f ...`).

## Baseline
| Item | Total |
|---|---|
| Escolas | 55 |
| Pessoas | 10.822 |
| Atuações institucionais (`institutional_engagements`) | 2 |
| Alunos | 9.763 |
| Matrículas (versões) | 9.811 |
| Enturmações (episódios) | 0 |
| Participações no ciclo | 0 |
| Composições de turma | 0 |
| Posições curriculares | 0 |
| Versões de calendário | 7 |
| Políticas de capacidade | 8 |
| Turmas | NÃO LIDO (acesso só leitura negado à tabela) |

## Resultado por verificação
| Verificação | Resultado | Classe |
|---|---|---|
| Aluno sem pessoa | 0 | ESPERADO |
| Matrícula com aluno/escola inexistente | 0 / 0 | ESPERADO |
| Atuação com pessoa inexistente | 0 | ESPERADO |
| Datas impossíveis (fim < início; abertura fora de 1950..hoje+400d) | 0 | ESPERADO |
| Encerramento antes do início | 0 | ESPERADO |
| INEP: escola sem código / formato ≠ 8 dígitos / mesmo código em 2 escolas | 0 / 0 / 0 | ESPERADO |
| Matrícula com cabeça múltipla | 1 grupo = as 9.811 com `logical_id` nulo (artefato de agrupamento) | DADO_A_REVISAR: matrículas importadas sem `logical_id`; cadeia de versões não identificável |
| Matrícula sem enturmação | 9.811 de 9.811 | AUSENCIA_CONFIGURACAO: enturmação não realizada (turmas 2026 importadas não ligadas a episódios); não é erro do dado |
| Enturmação sem matrícula / sem posição / aberta múltipla | 0 (não há episódios) | ESPERADO |
| Pessoa sem atuação nem vínculo de aluno | 1.057 | DADO_A_REVISAR: provavelmente profissionais do Censo cujo vínculo funcional está nas tabelas de DP (551), não em `institutional_engagements` |
| Atuação de escola sem escola | 0 | ESPERADO |
| Turma sem composição; escopo episódio/atuação × escola da turma; episódio com turma inexistente | não verificável | ERRO_TECNICO de acesso (permissão da sessão de auditoria), não do dado |

## Gaps reproduzíveis
1. Verificações sobre turmas exigem leitor com permissão; reexecutar o mesmo arquivo com acesso a `institutional_classes`.
2. `logical_id` nulo em todas as matrículas: decidir em lote explícito se haverá backfill.
3. Ligação matrícula→enturmação inexistente: depende da enturmação real 2026.
4. 1.057 pessoas sem vínculo: cruzar com vínculos do DP em lote próprio.

## Status
NÃO PASS: baseline e gaps estão reproduzíveis, mas a família de verificações de turmas não foi executada.

## Rodada 2026-10-07 — turmas e vínculos (lidos pela consulta de auditoria do backend)
| Verificação | Resultado | Classificação |
|---|---|---|
| Turmas | 698 | — |
| Turma sem escola existente | 0 | ESPERADO |
| Turma sem versão cadastral | 0 | ESPERADO |
| Turma sem composição declarada | 698 | AUSENCIA_CONFIGURACAO (composição N5.3.1 ainda não declarada para as turmas de 2026) |
| Vínculos funcionais | 551 | — |
| Vínculo sem lotação | 551 | DADO_A_REVISAR (nenhuma lotação registrada; provável importação só de vínculos) |

```sql
select (select count(*) from institutional_classes) turmas,
 (select count(*) from institutional_classes c where not exists(select 1 from institutional_schools s where s.id=c.school_id)) turmas_sem_escola,
 (select count(*) from institutional_classes c where not exists(select 1 from class_composition_versions v where v.class_id=c.id)) turmas_sem_composicao,
 (select count(*) from institutional_classes c where not exists(select 1 from institutional_class_record_versions v where v.class_id=c.id)) turmas_sem_cadastro,
 (select count(distinct logical_id) from professional_functional_links) vinculos,
 (select count(distinct l.logical_id) from professional_functional_links l where not exists(select 1 from professional_postings p where p.functional_link_logical_id=l.logical_id)) vinculos_sem_lotacao;
```
O ERRO_TECNICO anterior (turmas não lidas) fica resolvido. Nada foi alterado.
