# Secretaria — Documentos, transferências, remanejamento e renovação (N5.4)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Migrations: `0223` (emissão/consulta documental e autoria setorial em documentos, remanejamento e renovação), `0224` (`class_allocations_at`/`b3_allocation_ended_on` veem términos da Secretaria), `0225` (`calendar_allocation_state_at` idem).
Prova: `supabase/tests/n5_4_documents_transfer_renewal.sql` → `N54-PROOF-PASS A L,N,R B,C,D,E F,J,I,H G,B-isolada O,P,Q,T,S U,X direcao-sem-writer op-sem-writer sem-DML-direto` (rollback, zero resíduo).

## Acervo de documentos
| Documento | Origem | Classificação |
|---|---|---|
| Declaração de matrícula / escolar | motor composável (`0066`/`0164`) | MODELO_COMPOSÍVEL_EXISTENTE — sem template carregado na rede |
| Ficha de Matrícula | `ANEXO_1_-_FICHA_DE_MATRÍCULA.pdf`, `FICHA_DE_MATRICULA_-2026_-_2026.pdf` | TEMPLATE_INSTITUCIONAL_PENDENTE (campos sem fato canônico) |
| Declaração de transferência (provisória) | descrita em `Declarações.txt`, sem modelo | TEMPLATE_INSTITUCIONAL_PENDENTE |
| Atestado de escolaridade, termo de renovação | não localizados | TEMPLATE_INSTITUCIONAL_PENDENTE |
| Anexo NEE | domínio de Inclusão | FORA_DO_ESCOPO_DA_SECRETARIA nesta estação |
| Livro de Matrícula | N5.3 | COMPLETO |
| Termo de imagem, ofícios | `Termo_Autorizacao_Uso_Imagem.docx`, ofícios | DECISAO_INSTITUCIONAL_PENDENTE (sem regra de emissão pela Secretaria) |
| Declaração de frequência de servidor | `Declarações.txt` | FORA_DO_ESCOPO_DA_SECRETARIA (DP) |

## Limites conhecidos
- `student_trajectory_at` (leitura transversal) ainda não lista a saída de turma registrada pela Secretaria; a ficha usa `student_school_life`, que lista.
- Renovação em lote: requisito não definido no acervo; fora deste lote.
- Aceite da escola receptora: não decidido; a receptora constitui o próprio vínculo citando a saída (`originating_act_ref`).
- Mapa II/III/IV e Diário: leem `class_allocations_at`, corrigido em `0224`; não exercitados com estudantes na prova.
