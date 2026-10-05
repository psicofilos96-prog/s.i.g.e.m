# Ano operacional 2027 e virada de ano

Princípio: entidades pessoais são permanentes; vínculos institucionais são temporais. A virada cria novos vínculos, nunca recria pessoas e nunca apaga a história. O mesmo mecanismo serve 2027→2028 e anos seguintes (anos de origem e destino são parâmetros).

## Implementado (operacional, fail-closed)
| Peça | Onde | Regra |
|---|---|---|
| Estado do ano | `academic_year_operational_states` + `record_academic_year_operational_state` (0111/0112; 0114 retirou EXECUTE de service_role) | ledger append-only; capability de rede `preparar-ano-letivo`; base esperada |
| Decisão de transição | `year_transition_decisions` + `record_year_transition_decision` (0113) | renovou / transferido-saida / nao-renovou; pendente = ausência; retificação = nova sequência com motivo; base esperada; `manter-matricula-e-enturmacao` na escola; ano de destino aberto |
| Matrícula no ano | `enroll_student_in_school_year` / núcleo `s_enroll_core` | idempotente por aluno×ano×escola; ativo em outra escola ⇒ `enrollment:active-elsewhere-requires-transfer` |
| Mudar decisão "renovou" | — | recusada enquanto a matrícula criada estiver ativa; encerre-a pelo fluxo de encerramento existente |
| Turmas 2027 e alocações | writers existentes (B2.5/B3: `register_institutional_class`, enturmação, movimentação) | nada de 2026 vira turma/alocação 2027; curricular, AEE e atividade complementar continuam separados |
| Transferência A→B | fluxo explícito existente (`record_student_movement`, tela de transferências) | origem preservada; mesma pessoa no destino |
| Indicadores | `year_preparation_summary` | candidatos, renovados, transferidos, não renovados, pendentes, novos, turmas, alunos sem turma, servidores |

## Aguardando ato humano / provisionamento
- Nenhuma política homologada contém `preparar-ano-letivo`, `localizar-servidor-por-identificador`, `manter-lotacao-da-escola` ou `consultar-quadro-profissional-da-rede`. As funções existem e recusam. A atribuição exige nova versão de política homologada pela Administração; não foi feita concessão arbitrária.
- 2027 não foi aberto: depende de ato humano de rede.
- Decisões, matrículas, turmas e lotações 2027 dependem de usuários reais da Secretaria/Direção.

## Calendário
Os calendários 2027 oficiais não foram tocados. Calendário regula ano, períodos e dias letivos; nunca fornece data individual de ingresso.
