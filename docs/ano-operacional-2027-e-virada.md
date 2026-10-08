# Ano operacional 2027 e virada de ano

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Princípio: entidades pessoais são permanentes; vínculos institucionais são temporais. A virada cria novos vínculos, nunca recria pessoas e nunca apaga a história. O mesmo mecanismo serve 2027→2028 e anos seguintes (anos de origem e destino são parâmetros).

## Implementado (operacional, fail-closed)
| Peça | Onde | Regra |
|---|---|---|
| Estado do ano | `academic_year_operational_states` + `record_academic_year_operational_state` (0111/0112/0114/0116) | ledger append-only; sessão → pessoa (`user_person_links`) → atuação de rede vigente → capability `preparar-ano-letivo` (v6, Administrador Geral); motivo e base esperada; sem EXECUTE para anon/service_role |
| Decisão de transição | `year_transition_decisions` + `record_year_transition_decision` (0113) | renovou / transferido-saida / nao-renovou; pendente = ausência; retificação = nova sequência com motivo; base esperada; `manter-matricula-e-enturmacao` na escola; ano de destino aberto |
| Matrícula no ano | `enroll_student_in_school_year` / núcleo `s_enroll_core` | idempotente por aluno×ano×escola; ativo em outra escola ⇒ `enrollment:active-elsewhere-requires-transfer` |
| Mudar decisão "renovou" | — | recusada enquanto a matrícula criada estiver ativa; encerre-a pelo fluxo de encerramento existente |
| Turmas 2027 e alocações | writers existentes (B2.5/B3: `register_institutional_class`, enturmação, movimentação) | nada de 2026 vira turma/alocação 2027; curricular, AEE e atividade complementar continuam separados |
| Transferência A→B | fluxo explícito existente (`record_student_movement`, tela de transferências) | origem preservada; mesma pessoa no destino |
| Indicadores | `year_preparation_summary` | candidatos, renovados, transferidos, não renovados, pendentes, novos, turmas, alunos sem turma, servidores |

## Aguardando ato humano / provisionamento
- As capabilities estão na política v6 homologada (matriz abaixo), atribuídas a papéis, não a pessoas. Para operar, ainda é preciso provisionar atuações reais (Administrador Geral, Secretaria, Direção). Nenhuma concessão foi feita a usuários.
- 2027 não foi aberto: depende de ato humano de rede.
- Decisões, matrículas, turmas e lotações 2027 dependem de usuários reais da Secretaria/Direção.

## Calendário
Os calendários 2027 oficiais não foram tocados. Calendário regula ano, períodos e dias letivos; nunca fornece data individual de ingresso.

## Fechamento S.1 (migrations 0115–0118)

### Matriz de capabilities (política v6, homologada por decisão do proprietário, vigência 2026-10-05; v1–v5 intactas)
| Capability | Administrador Geral | Secretaria Escolar | Direção Escolar |
|---|---|---|---|
| `preparar-ano-letivo` (abrir/alterar estado do ano) | rede (reservada ao mestre) | — | — |
| `manter-matricula-e-enturmacao` (transição, matrícula, enturmação) | rede | escola | — |
| `localizar-estudante-para-matricula` | rede | escola | — |
| `cadastrar-estudante-na-escola` | rede | escola | — |
| `localizar-servidor-por-identificador` | rede | escola | — |
| `manter-lotacao-da-escola` | rede | escola | — |
| `consultar-quadro-profissional-da-escola` | rede | escola | escola |
| `manter-registro-funcional` (contrato, cargo, vínculo central) | rede | — | — |

Delta v5→v6: 10 regras explícitas, sem curinga; cobertura do Administrador Geral validada pelo próprio homologador. Nenhuma capability foi atribuída a pessoa: a política define papéis; o provisionamento de pessoas é separado.

### Estado de 2027
Sem registro em `academic_year_operational_states` = ano ainda não aberto para preparação. É o estado esperado até o primeiro ato real do Administrador Geral, com motivo. A tela diz isso explicitamente e lembra que o calendário oficial continua cadastrado. Durante os testes DB, o writer do estado do ano (0111) mostrou um defeito: procurava atuação `network` em vez de `rede` e misturava tipos. Isso foi corrigido na 0116; antes disso, nenhuma abertura real teria funcionado.

### Status
**READY_FOR_2027_HUMAN_OPERATION.** Os gates técnicos passaram. Restam somente atos humanos normais: provisionar atuações reais, abrir 2027 e operar a Secretaria/Direção.
