# Trajetória do estudante — NSTUDENT.1

Situação atual: Registro de lote (2026-10-08).

## Método
Busca, no banco, de toda função que lê `class_enrollment_episodes` sem considerar término (`class_enrollment_episode_endings` / `b3_allocation_ended_on`) nem versão substituída. Telas conferidas pelo caminho de leitura.

## Corrigido (migration 0251, nenhum fato alterado, nenhum acesso ampliado)
- **Ocorrência de frequência** (`record_attendance_occurrence`): aceitava aluno que já tinha saído da turma. Agora exige enturmação na turma em algum dia do intervalo.
- **Carteirinha** (`record_student_card`): emitia para aluno já transferido/saído da escola. Agora exige enturmação não encerrada.
- **Preparação do ano** (`year_preparation_summary`): "alunos sem turma" não contava quem só tinha enturmação encerrada.

## Já coerente (mesma fonte)
- Ficha, Diário, Mapa e CIECE: `class_allocations_at` (bitemporal, lê término) — N5.4.
- Livro de matrícula: situação por `school_enrollment_endings`; coluna turma = última turma conhecida (histórica, correta após remanejamento).
- Vagas/ocupação, calendário do aluno: `b3_allocation_ended_on`.
- Documentos: fatos compostos no banco (`af_document_facts`).
- Busca: igualdade exata; não exibe turma.

## Limites
- Sequência temporal com fixtures reais (matrícula→enturmação→remanejamento→transferência→renovação→saída) depende do harness institucional: INTERACTIVE_BROWSER_VALIDATION_PENDING (chave técnica indisponível). O teste `src/test/invariants/nstudent1-trajectory.test.ts` confere as definições, não a execução.
