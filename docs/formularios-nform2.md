# NFORM.2 — Erros por campo e por célula

**Situação atual:** Registro de lote (2026-10-08).

## Entregue
- **Lançamento de resultados:** quando uma nota numérica, um registro descritivo ou um motivo de "não registrado" é inválido, o campo ganha `aria-invalid`. Ele também ganha `aria-describedby`, que aponta para a mensagem logo abaixo; tudo isso some ao corrigir. O teclado continua igual: Enter não avança com valor inválido.
- **Assistente de matrícula, etapa por etapa:**
  - Cada pendência mostra uma mensagem junto ao próprio campo: nome, CPF ou INEP, ano letivo, data de início e turma.
  - Um CPF digitado errado é apontado na hora.
  - As regras vêm de `fieldProblems`, que tem o mesmo conteúdo de `missingByStep`. Nenhuma regra nova foi criada.
  - A mensagem fica fora do rótulo, para que o nome lido pelo leitor de tela continue limpo.
- **Nova turma:**
  - Os campos de nome e código ficam ligados à lista de problemas da etapa.
  - A capacidade mostra o erro próprio dela (`parseCapacity`).
- **Rascunho de Nova turma:** não existe um rascunho oficial guardado no servidor para turma; os rascunhos de matrícula são específicos da matrícula. Por isso a criação de turma continua **sem salvar o rascunho**. Não foi usado o armazenamento do navegador como fonte oficial. A criação continua numa única transação (`secretariat_create_class`). Se a rede decidir ter rascunho de turma, a decisão é DEPENDE_DECISAO, e o trabalho seria criar esse rascunho no banco nos moldes de `enrollment_wizard_draft_events`.
- **Testes:**
  - `assessment-entry-grid.test.tsx`: célula inválida e correção, pelo teclado.
  - `enrollment-wizard-nform2.test.ts`: erro por campo, CPF, aluno já cadastrado e perda e retorno de conexão (nada é tentado sem conexão; ao voltar, salva a última versão).

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferir com login real o uso por teclado e leitor de tela, e a queda de rede.
- REVISAR: outras telas com listas de erros por etapa (alocação, transferência, regras avaliativas) ainda não apontam campo a campo.
