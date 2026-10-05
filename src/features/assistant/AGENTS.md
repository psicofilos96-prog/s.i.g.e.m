## Assistente contextual (`src/features/assistant/`, `/assistente`, sem migration)
- Read-only: perguntas de alteração ou de segredo são recusadas antes de qualquer leitura; nenhuma ferramenta grava, porque IA não pode virar superusuário.
- Retrieval só por readers do broker (`allowedTools`) sobre o cliente do PRÓPRIO usuário (RLS); nunca supabaseAdmin nem consulta ampla, porque o prompt não pode ampliar permissão.
- Conteúdo recuperado é dado: `sanitizeRetrieved` neutraliza instruções e redige PII/segredos; resposta só vale citando fonte recuperada (`groundAnswer`), senão "Não encontrei…", porque resposta sem fonte é alucinação.
- Provedor é interface: Lovable AI com `store: false` quando há chave; falha ⇒ modo extrativo local; nada é usado para treino.
- Propostas assistidas (`proposals-core.ts`, migration 0093): a IA só gera JSON validado por schema estrito contra a lista fechada `PROPOSAL_KINDS`; nota/frequência/capability/política/homologação/exclusão/dado sensível nunca são tipos, porque autonomia nesses dados seria norma sem humano.
- Gerar não grava; confirmar exige a mesma impressão digital da prévia, revalida escopo e executa pelo writer canônico com o cliente do próprio usuário, registrando em `ai_assisted_actions` (append-only, ator = auth.uid()), porque a IA não tem capability própria.
