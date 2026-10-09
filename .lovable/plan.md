# Intervenção 4/6 — Redesign premium global (em ondas)

O SIGEM tem 216 páginas. Refazer todas de uma vez repetiria o problema que você já apontou ("não deixar resolver tudo de uma vez"). Proposta: 6 ondas, cada uma entregue com capturas antes/depois em computador, tablet e celular, e só seguir depois da sua revisão.

## Onda A — Fundação (afeta todas as páginas de uma vez)
- Tipografia refinada, escala de tamanhos, espaços e cores institucionais de Itaperuna revisadas.
- Peças comuns refeitas: cabeçalho de página (título, caminho, ações), abas, filtros, modais, mensagens de vazio/erro/sem acesso/carregando.
- Tabela padrão nova: busca, filtros, ordenação, paginação no servidor, ações por linha, cabeçalho fixo, versão em cartões no celular.
- Formulário padrão: seções lógicas, botão de salvar fixo, aviso de alterações não salvas, mensagem clara de salvo/erro.
- Menu lateral orientado a tarefas por setor (o que eu faço hoje), com busca.
- Conferir a identidade visual: fotos e textos com o Cristo de Itaperuna corretos (hoje há 3 usos; verificar se a imagem é mesmo o de Itaperuna).

## Onda B — Início e painéis
- Início com indicadores reais 2026 (55 escolas, matrículas, turmas, profissionais), alertas e clique para detalhar. Sem parede de cartões iguais.
- Painéis da rede, Gestão Escolar e Pendências.

## Onda C — Cadastros
- Alunos, Matrículas, Enturmações, Profissionais (vínculos, funções, atuações), Escolas, Turmas.

## Onda D — Pedagógico
- Diário (todas as subpáginas), Avaliação, Horários, Matrizes curriculares, Planejamento, Orientação.

## Onda E — Setores
- Secretaria, Direção, Supervisão, CIECE/Censo/Mapa, Alimentação, Inclusão/AEE, Família, DP.

## Onda F — Administração, relatórios e documentos
- Central de acessos, Auditoria, Importações, Relatórios, Document Studio, Configurações.
- Calendário: só polimento das telas em volta; calendário interno/externo, editor visual e PDF continuam como estão, com conferência de linhas e impressão.

## Em todas as ondas
- Lista de páginas com situação (antiga / refeita), capturas reais antes/depois nos 3 tamanhos.
- Testes de acessibilidade e de rotas atualizados; nenhuma regra de acesso ou dado alterado.
- Capturas de páginas internas exigem entrar como Supervisão/Admin: vou pedir sua aprovação de acesso de teste no início de cada onda.

## Detalhes técnicos
- Tokens em `src/styles.css`; componentes compartilhados em `src/components/sigem/` (correções de acessibilidade ali primeiro, guardadas por `a11y.test.tsx`).
- Tabela padrão sobre `readPages`/`server-page.tsx` existentes, sem nova leitura fora do portão de sessão.
- Inventário em `docs/` com "Situação atual" e entrada no mapa de documentação.
