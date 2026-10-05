## Transição anual e busca ativa (Frente S, `0113`)
- Pendente = ausência de decisão em `year_transition_decisions`; só `record_year_transition_decision` grava (append-only, base esperada, motivo na retificação), porque inferir renovação de snapshot criaria fato.
- Renovação reutiliza pessoa/aluno e cria só a matrícula do ano destino; nunca turma/alocação nem data do calendário.
- Cadastro de aluno pela escola usa capability escolar (`register_student_for_school`); lotação escolar (`school_staff_presence`) é separada do registro funcional central e nunca cria regência, porque a escola não pode ganhar poder contratual.
- Busca de aluno/servidor só por igualdade exata (CPF via HMAC, INEP, matrícula funcional, QP-MEC) com limite por usuário e trilha sem o valor, porque busca por nome permitiria enumeração.
- Ativo em outra escola no mesmo ano ⇒ recusa; mudança de escola só por transferência explícita.
- Anos de origem e destino são sempre parâmetros explícitos; nunca há fallback de ano.
