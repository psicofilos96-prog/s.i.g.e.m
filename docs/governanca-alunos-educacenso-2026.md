# Alunos, matrículas e participações EducaCenso 2026 (Frente F)

## Estado
**Carga real BLOQUEADA POR FONTE AUSENTE, não por login.**

O ambiente do agente não recebeu estas planilhas:
- `Todos os alunos.xlsx`
- `Consolidado - Dados dos Alunos.xlsx`
- `Situacao_Escolas_Matriculas_municipais.xlsx`
- `Situacao_Escolas_Matriculas_conveniadas.xlsx`

As turmas canônicas também dependem da Frente C, que aguarda as planilhas de turmas. Nada foi gravado nem inventado.

## Contrato (`src/features/student-life/educacenso-student-staging.ts`)
- **Conceitos separados:** pessoa (chave fingerprint), matrícula (pessoa × escola), participação (pessoa × turma canônica, situação e posição) e movimento (declarado e datado).
- **Nada é criado por inferência:** turma, escola, posição, etapa e fase nunca são deduzidas do nome. Turma multietapa sem posição declarada gera evidência. A fase da EJA é preservada literalmente.
- **Situação na turma:** só vira fato se estiver no catálogo homologado. Valor estranho gera evidência e o campo fica `null`. Ausência nunca vira valor padrão.
- **ID INEP do aluno:** é identificador externo. Se o mesmo ID aparecer para pessoas diferentes, a linha é recusada.
- **Movimentos:** só existem quando a fonte os declara com data, e registram a turma de origem. A gravação futura usará os writers B3 de movimentação, que já encerram e constituem atomicamente.
- **Reprocessamento:** é idempotente por pessoa × turma.
- **Comparação de fontes:** turmas e alunos ficam disponíveis para reconciliação. A comparação entre as duas planilhas de alunos (`compareStudentSources`) aponta divergências sem escolher vencedora.
- **Evidências:** referências sempre truncadas, sem CPF nem nome.

## Pendente para a carga
A operação `technical_import_educacenso_2026_students_enrollments` será construída sobre a camada 0100 quando houver fontes e turmas canônicas. Ela reutilizará os núcleos dos writers B3 (`constitute_cycle_enrollment`, alocação, `record_student_movement`) com source hash, fingerprint, base esperada e ledger.
