# N2026.IMPORT.2 — Profissionais, vínculos, lotações e jornadas 2026

## Situação atual (2026-10-09)
- Classe: **Registro de lote**. Nenhuma escrita no banco neste lote; só conferência e reconciliação.
- Em conflito, prevalecem os `AGENTS.md` e `docs/n2026-importacao-base-oficial.md`.

## Fontes e precedência
| Fonte | SHA-256 (12) | Natureza real | Uso |
|---|---|---|---|
| Todos_os_prof (+-2,-3,-4 idênticas) | 0e7ff5940f3e | Censo 2026, profissionais em sala, chave INEP-pessoa + CPF (só HMAC) | **Primária** — já carregada em 05/10 |
| Relacao_Servidores_por_Escola_Ago-Set_2026 | cb2305b4ef79 | Mapas Estatísticos (Seção V), só **nome**, cargo, função, vínculo, situação; abas de afastados e "fora da lista" | Reconciliação; nome sem chave ⇒ fila |
| Todas_as_jornadas (+-2,-3,-4 idênticas) | e7f33aa1cdf1 | **Jornada escolar de ALUNOS** (9.198 IDs; 9.198 são alunos, 0 profissionais) | Não é jornada de profissional; já carregada como 9.692 observações de dia escolar de aluno |

Não existe no acervo planilha de jornada/horário de profissional. Por isso `professional_schedule_declarations` continua vazia e a operação de jornada profissional não foi executada (rodá-la sobre a jornada de alunos criaria fato falso).

## Estado do banco (prova executada)
| Item | Valor |
|---|---|
| Pessoas profissionais (Censo) | 1.057, todas com INEP-pessoa; 0 INEP duplicado |
| Declarações profissional×turma | 2.403 (todas com turma declarada e resolvida) — fonte declara a turma, por isso existe |
| Pessoas em mais de uma escola | 77 (escola A ≠ escola B preservadas como declarações distintas) |
| Vínculos funcionais | 551 (53 pessoas com mais de um); `valid_from` vazio — a fonte não declara início do vínculo, não foi inventado |
| Autoria humana em vínculos | 0 (executor técnico não é pessoa) |
| Lotações (`professional_postings`) | **0** |
| Regência (`teaching_assignments`) | 0 — Censo não autoriza regência |
| Operações técnicas | 7, únicas por (tipo, hash) — reexecução devolve a mesma operação ou recusa payload diferente |

## Por que nenhuma lotação foi criada
- Lotação é ato administrativo do DP. O Censo declara "atua na turma em 31/07", não lotação.
- A Relação de Servidores declara lotação, mas só por nome. Regra vigente: nome isolado não casa pessoa.
- Resultado: **LOTACAO_FONTE_SEM_CHAVE** — lotações aguardam fonte com matrícula/CPF (DP) ou conferência humana da fila abaixo.

## Fila de reconciliação (Relação de Servidores × Censo)
1.634 linhas, 40 escolas na fonte (38 identificadas; 2 com nome ambíguo: "E. M. Nossa Senhora das Graças" e "JIM Professora Maria Madalena Magacho dos Santos").
| Situação | Linhas |
|---|---|
| nome idêntico a 1 pessoa do Censo na mesma escola (candidato, não fundido) | 692 |
| sem pessoa do Censo com o mesmo nome na escola (apoio, administrativo, mediadores ou grafia diferente) | 793 |
| escola sem correspondência segura | 149 |
| homônimo na mesma escola | 0 |

1.555 nomes distintos; 71 aparecem em mais de uma escola (múltiplas lotações possíveis, a confirmar). Vínculo: 871 contratados, 708 efetivos, 23 permutados, mistos/cedidos. Situação: 1.610 em atividade, 18 licença, 6 férias. As abas "Afastados" (102) e "Fora da lista" (61: remanejados, exonerados, rescisões) são eventos funcionais a registrar pelo DP, não inferidos.

## Censo nominal × agregado
- Docentes: Mapas Estatísticos × Censo nominal divergem em 28 das 38 escolas identificadas (ex.: CIEP 467: 51 × 39). Diferença esperada — o mapa conta toda a equipe docente, o Censo só quem está em turma. Reportado, não corrigido.
- Recibo 708 docentes × 714 declarações "Docente" (pessoa×escola) × 1.057 pessoas — mantido conforme N2026.IMPORT.0.

## Pendências
- LOTACAO_FONTE_SEM_CHAVE — planilha do DP com matrícula/CPF por escola, ou conferência dos 692 candidatos.
- PROFESSIONAL_SCHEDULE_SOURCE_ABSENT — nenhuma jornada de profissional no acervo.
- FUNCTIONAL_LINK_START_UNDECLARED — início dos 551 vínculos.
