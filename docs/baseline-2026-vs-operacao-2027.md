# Baseline 2026 × Operação 2027

Decisão do proprietário (05/10/2026): 2026 é a base censitária e histórica (EducaCenso). 2027 é o primeiro ano em que o SIGEM opera de verdade.

- Pessoas, alunos e identidade profissional são permanentes. Vínculos com escola, ano, turma e lotação são temporais.
- A virada não apaga nada e não recria ninguém. Também não copia os vínculos de 2026 para 2027.
- 2026 fica marcado como `historico-importado` em `academic_year_operational_states` (migration 0111, proveniência técnica, sem autor humano). As lacunas de 2026 continuam visíveis: não há início efetivo, participação nem alocação.
- Não existe exigência de Calendário 2026. Os calendários 2027 já cadastrados são os oficiais e definem ano, períodos e dias letivos. Eles não dão a data de ingresso de cada aluno.
- 2027 só entra em `em-preparacao` e depois em `operacional` por ato humano (`record_academic_year_operational_state`: sessão, pessoa vinculada, atuação de rede, capability `preparar-ano-letivo`, base esperada).
