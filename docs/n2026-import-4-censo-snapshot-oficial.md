# N2026.IMPORT.4 — Censo Escolar 2026: snapshot oficial, painéis e reconciliação

## Situação atual (2026-10-09)
- Classe: **Registro de lote**. Escrita real pela camada técnica (migration `0257`), executor técnico, sem autoria humana.
- Em conflito, prevalecem os `AGENTS.md` e `docs/n2026-importacao-base-oficial.md`.

## O que foi registrado
| Estrutura | Linhas | Fonte (SHA-256, 12) |
|---|---|---|
| `census_official_receipt_snapshots` | 55 escolas, v1 cada | Urbanas 1bdabb8c28fa (27) · Rurais 051eb47ee547 (13) · Conveniadas eb7477c16a2b (15) |
| `census_official_panel_snapshots` | 1 (município, todas as dependências) | Painel 1 — Município af1606640014, atualizado 15/09/2026 13:00 |
Cópias "-2" têm o mesmo SHA-256 e não foram lidas de novo.

Por escola: INEP, nome, situação, dependência, localização, escola fechada; turmas; turmas/componentes sem docente; alunos; alunos com deficiência/TEA/AH; 9 categorias de profissionais; matrículas por etapa/modalidade (total, EI, EF, EM, EJA, técnico, FIC, itinerários); AEE; atividade complementar; transporte (municipal/estadual/total); data/hora de encerramento (13/07 a 31/07/2026) e de emissão (11/09/2026).
**Não guardados:** nome/CPF do gestor e do informante (dado pessoal). Código do recibo só como SHA-256.

Painel municipal (com censo anterior): escolas 94 (91), gestores 89 (94), profissionais em sala 1.602 (1.516), turmas 1.019 (947), matrículas 15.407 (14.798), alunos 14.916 (14.542), educação especial 1.245 (1.083). Inclui rede estadual e privada: é estatística de referência, nunca origem de entidade.
Painéis por escola (Urbanas/Rurais/Conveniadas): só conferência visual; repetem os números do recibo, não foram gravados.

## Regras da estrutura
- Append-only (trigger), sem DML para nenhum papel de aplicação; leitura só com capacidade de Censo de rede.
- Nova emissão da mesma escola ⇒ nova versão (`supersedes_id`), nunca overwrite; mesma emissão e mesmo conteúdo ⇒ reaproveitada.
- Leitura histórica: `census_official_receipts_at(knownAt)` devolve a versão vigente em cada data.
- Medida = `{value}`; ausência seria `null`, nunca zero.

## Provas
- Repetição das 4 operações devolveu os mesmos identificadores; 55 recibos, versão máxima 1.
- Payload adulterado (alunos = 999) recusado: `technical:payload-differs-from-recorded-operation`.
- 0 sequência com formato de CPF gravada; 55/55 recibos ligados a escola existente.

## Reconciliação snapshot × dados individualizados
| Indicador | Recibos (soma) | Nominal no banco | Escolas MATCH |
|---|---|---|---|
| Turmas | 698 | 698 | 55/55 |
| Alunos (por escola) | 9.811 | 9.811 matrículas escolares (9.763 pessoas; 48 em 2 escolas) | 55/55 |
| Matrículas | 10.295 | 10.295 vínculos aluno-turma | 55/55 |
| Curricular / AEE / AC | 9.762 / 351 / 182 | idem | 55/55 |
| EI / EF / EJA | conforme N2026.IMPORT.3 | idem | 55/55 |
| Docentes | 708 | 708 pessoas "Docente" por escola | 55/55 |
| Apoio a alunos com deficiência | — | idem | 55/55 |
| Educação especial | 1.122 | não declarado na fonte nominal | sem cobertura |
| Transporte | 1.738 | sem fonte nominal | sem cobertura |
Rede SIGEM (55) × painel municipal (94 escolas, 15.407 matrículas): diferença esperada — o painel inclui estaduais e privadas. Não reconciliado contra a rede.
Isso fecha a dúvida da N2026.IMPORT.0 "708 × 1.057": 708 são os docentes; os demais são auxiliares, apoio e monitores.

## Pendências
- CIECE_QUALIDADE_INTEGRACAO_PENDENTE — as estruturas e o leitor existem; telas do CIECE e da Qualidade dos Dados ainda não leem o snapshot.
- Educação especial e transporte só no agregado.
