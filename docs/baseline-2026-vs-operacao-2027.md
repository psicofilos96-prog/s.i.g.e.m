# Baseline 2026 × Operação 2027

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
