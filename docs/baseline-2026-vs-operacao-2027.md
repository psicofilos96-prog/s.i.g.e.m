# Baseline 2026 × Operação 2027

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Decisão do proprietário (05/10/2026): 2026 é a base censitária e histórica (EducaCenso). 2027 é o primeiro ano em que o SIGEM opera de verdade.

- Pessoas, alunos e identidade profissional são permanentes. Vínculos com escola, ano, turma e lotação são temporais.
- A virada não apaga nada e não recria ninguém. Também não copia os vínculos de 2026 para 2027.
- 2026 fica marcado como `historico-importado` em `academic_year_operational_states` (migration 0111, proveniência técnica, sem autor humano). As lacunas de 2026 continuam visíveis: não há início efetivo, participação nem alocação.
- Não existe exigência de Calendário 2026. Os calendários 2027 já cadastrados são os oficiais e definem ano, períodos e dias letivos. Eles não dão a data de ingresso de cada aluno.
- 2027 só entra em `em-preparacao` e depois em `operacional` por ato humano (`record_academic_year_operational_state`: sessão, pessoa vinculada, atuação de rede, capability `preparar-ano-letivo`, base esperada).

## Fechamento da Frente S (partes 3–5, migrations 0113–0114)

- Candidatos 2027 de uma escola = alunos com matrícula observada nela no ano de origem (`year_transition_candidates`). Pendente = nenhuma decisão registrada; nada é inferido de snapshot.
- Renovação reutiliza pessoa e aluno e cria só a matrícula do ano de destino (`opened_on` = data declarada pela Secretaria ou desconhecida; nunca do calendário). Não cria turma nem alocação.
- Baseline profissional 2026 = projeção `professional_school_observations_2026` sobre as 2.403 declarações censitárias individuais (1.146 pares pessoa×escola) já carregadas na Frente D com identidade por CPF/INEP. Sem nova carga: o fato observado já existe, com `known_at`; início desconhecido (`start_known = false`); sem cargo, sem regência.
- A tela "Preparação do ano" (`/preparacao-ano`) exige escolha explícita de escola, ano de origem e ano de destino; nunca troca um ano pelo outro.

Contagens Cloud antes/depois desta rodada: pessoas de aluno 9.763 → 9.763; matrículas 9.811 → 9.811; decisões de transição 0 → 0; estado de 2027 sem registro (aguarda ato humano). Nenhum ato escolar de 2027 foi simulado.

## Fechamento S.1 — testes e gate
- Teste DB `supabase/tests/s_year_transition_exact_lookup.sql`: transação descartada, dados sintéticos, resultado `s-tests-ok: acl sessao ano escopo transicao transferencia busca cadastro servidor limite append-only indicadores`. Resíduo verificado depois: 0 escolas/alunos/decisões/lotações/buscas sintéticas.
- O teste encontrou privilégios padrão herdados (INSERT de anon/authenticated) nas tabelas novas; corrigido na 0117 e repassado.
- Suíte completa: 261 arquivos / 3.423 testes, todos aprovados. Também passaram tsgo, build de produção, integridade de migrations, audit SQL (nenhum SECURITY DEFINER sem search_path) e `git diff --check`.
- Security Advisor: 305 (baseline A–R) → 317.
  - +2 "RLS sem política" (`exact_lookup_events`, `student_registration_events`): intencional, sem leitura por app roles.
  - +10 "SECURITY DEFINER chamável por autenticado": `record_academic_year_operational_state`, `record_year_transition_decision`, `year_transition_candidates`, `enroll_student_in_school_year`, `locate_student_exact`, `locate_professional_exact`, `register_student_for_school`, `record_school_staff_presence`, `professional_school_observations_2026`, `year_preparation_summary`. Todas validam sessão, pessoa e capability dentro da função, com `search_path=''`.
  - 0 novos alertas para anon. Dois helpers internos tiveram EXECUTE revogado na 0118.
  - Regressões não explicadas: 0.
- Contagens Cloud inalteradas: matrículas 9.811; decisões 0; lotações escolares 0; 2027 sem estado.

## Ambiente canônico (decisão do proprietário, 05/10/2026)
- Banco canônico/oficial: Lovable Cloud do projeto, ref `crfqhyqkujhhlbiyhdbc` (o mesmo de `.env` e `supabase/config.toml`; serve preview e publicação). Detalhes e gate em `docs/ambiente-canonico-sigem.md`.
- `vwhvqtdvzbnfffkgoaen` é EXTERNO não canônico / não conectado / não usar. Nada foi copiado nem executado nele. A divergência antes registrada aqui está resolvida pela decisão: 55 escolas, 9.763 alunos, 9.811 matrículas, 698 turmas, migrations 0000–0118 e READY_FOR_2027_HUMAN_OPERATION pertencem ao canônico.
- Verificação no canônico (05/10/2026, sem PII): 55 / 9.763 / 9.811 / 698; um único estado anual (2026 `historico-importado`); 2027 cadastrado, sem estado.
- Reexecução no HEAD de S.1: teste DB `s-tests-ok` (inclui helpers da 0118 não expostos), sem resíduo; suíte completa 3.423/3.423.
