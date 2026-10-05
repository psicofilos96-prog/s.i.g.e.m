# B4.3/B4.4/B4.5 — Prontidão técnica e quadro de decisão (2026-10-05)

## Auditoria (repositório + Cloud)
| Peça | Estado |
|---|---|
| Jornada B4.3 (`0018`/`0019`, `class_journey_at`) | Modelo, guards, reader bitemporal e testes prontos. Cloud: 0 jornadas. |
| Grade B4.4 (`0020`, `class_schedule_at`) | Modelo, guards (cadeia, vigência da turma, blocos), reader com estados por bloco, jornada exigida, sobreposição sinalizada. Cloud: 0 grades. |
| Horário profissional B4.5 (`0021`/`0022`, `person_schedule_at`) | Projeção pura da própria pessoa, sem tabela. Pronta. |
| UI | `/horarios` lê jornada + grade canônicas com sessão; estados vazio/erro/ausência já cobertos (`schedule-session.test.tsx`, `class-journey.test.tsx`, `person-schedule.test.tsx`). |
| Writers | **Ausentes até a 0062.** Agora existem preparados e fechados. |

## O que faltava para uma turma real percorrer jornada → grade → professor
1. Writer de jornada — **preparado e fechado (0062)**.
2. Writer de grade — **preparado e fechado (0062)**.
3. Capability atribuída por política homologada — **decisão do proprietário (quadro abaixo)**.
4. Turmas institucionais reais e atuações docentes com escopo de turma — dependem de cadastro (B2.5/B1), não de código.

## 0062 — contrato pronto
`record_class_journey_version` e `record_class_schedule_version` (`SECURITY DEFINER`, `search_path=''`, EXECUTE só authenticated):
sessão obrigatória → portão `b4_class_time_grant` (atuação vigente, política homologada, escopo escola da turma ou rede) →
validações (tipo de mudança, janela, motivo fora da constituição, lista não vazia) → lock por turma → **cabeça esperada** (`stale-head`) →
gravação append-only; os guards 0018–0020 continuam validando cadeia, sucessão posterior, vigência da turma, sobreposição de intervalos e blocos.
Referência documental é opcional; ausente ⇒ nota verdadeira `decisao-interna-sem-documento-fonte`.
Nenhum tipo de bloco, carga, papel ou quantidade de dias/blocos é interpretado (D3/D7/D8 seguem abertas).
Hoje ambos falham com `capability:manter-jornada-da-turma` / `capability:manter-grade-da-turma`: **nenhuma regra de política foi criada.**

## Quadro de decisão (único ponto pendente)
| Operação | Writer | Capability necessária | Escopo | Atuações existentes candidatas |
|---|---|---|---|---|
| Constituir/suceder/retificar jornada da turma | `record_class_journey_version` | `manter-jornada-da-turma` | escola da turma (ou rede) | `secretaria-escolar` [school]; `direcao-escolar` [school]; `gestao-pedagogica-da-rede` [network]; Administrador Geral (só por regra explícita) |
| Constituir/suceder/retificar grade semanal | `record_class_schedule_version` | `manter-grade-da-turma` | escola da turma (ou rede) | `coordenacao-pedagogica`/`direcao-escolar` [school]; `secretaria-escolar` [school]; Administrador Geral (só por regra explícita) |
| Ver horário profissional | `person_schedule_at` (leitura) | nenhuma — só a própria pessoa | própria pessoa | já resolvido |

A decisão vira dado: nova versão de política com as regras escolhidas, homologada por `decisao-do-proprietario`. Os nomes das atuações acima devem ser conferidos com o catálogo vigente na hora de redigir a política.

## Continuam abertas (não inventadas)
D3 taxonomia de blocos; D7 composição/carga; D8 papéis/substituições; obrigatoriedade de jornada por turma; valores da jornada (P3 do D1).

## Testes
- `supabase/tests/b4_3_4_closed_class_time_writers.sql` → `b434w-tests-ok` (ACL, definer, nenhuma regra, falha fechada, sessão exigida; rollback).
- B4.3/B4.4/B4.5 existentes cobrem sobreposição, sucessão, knownAt/validOn, turma sem jornada, turma sem grade, matriz múltipla e projeção própria; apenas a checagem "nenhum writer" foi ajustada para aceitar o writer fechado.
