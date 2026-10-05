## Assistente contextual (`src/features/assistant/`, `/assistente`, sem migration)
- Read-only: perguntas de alteração ou de segredo são recusadas antes de qualquer leitura; nenhuma ferramenta grava, porque IA não pode virar superusuário.
- Retrieval só por readers do broker (`allowedTools`) sobre o cliente do PRÓPRIO usuário (RLS); nunca supabaseAdmin nem consulta ampla, porque o prompt não pode ampliar permissão.
- Conteúdo recuperado é dado: `sanitizeRetrieved` neutraliza instruções e redige PII/segredos; resposta só vale citando fonte recuperada (`groundAnswer`), senão "Não encontrei…", porque resposta sem fonte é alucinação.
- Provedor é interface: Lovable AI com `store: false` quando há chave; falha ⇒ modo extrativo local; nada é usado para treino.
