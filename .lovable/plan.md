# SIGEM Simples 2 — todos os setores, visual bonito

## O que você vai ver
1. **Tela inicial por setor**: depois do login, uma grade de cartões grandes, cada um com ícone ilustrado, cor própria e nome curto. Cada setor aparece com tudo o que ele faz:
   - Secretaria (matrículas, transferências, remanejamentos, documentos do aluno)
   - Direção (painel da escola, demandas, plano de gestão)
   - Supervisão Escolar (visitas, calendário, acompanhamento)
   - Orientação Pedagógica, CIECE, Avaliação
   - Inclusão / NEI (ficha, AEE, apoio, agenda)
   - Diário do Professor (chamada, notas, conteúdo)
   - Alimentação / NAE
   - Departamento Pessoal (servidores, lotação, licenças)
   - DocServ e Documentos / Protocolo
   - Mapa Estatístico, Calendário Escolar, Relatórios
   - Família, Patrimônio, Tecnologia
2. **Página de cada setor**: cabeçalho colorido com o nome do setor e até 6 botões grandes das tarefas mais usadas, mais "Ver tudo" com as outras funções. Os botões abrem as telas que já existem (nada é perdido) ou as fichas simples novas.
3. **Busca única no topo**: digitar nome de aluno, servidor, turma, escola ou tarefa e ir direto.
4. **Cadastros simples completos**: além de alunos, servidores, turmas e escolas, fichas para matrícula/transferência/remanejamento, licenças e lotação, todas ligadas entre si e aparecendo em Relatórios.
5. **Visual novo**: fundo escuro com brilho suave, vidro fosco nos cartões, ícones ilustrados por setor, números grandes animados, gráficos com gradiente, tipografia moderna (títulos marcantes + texto muito legível), cantos arredondados, botões enormes com ícone + palavra. Versão clara automática para impressão.
6. Cada pessoa vê os setores do seu login primeiro; o administrador vê todos.

## Ordem de trabalho
1. Visual: novas cores, fontes, cartões e ícones dos setores.
2. Tela inicial com todos os setores e busca única.
3. Páginas de setor com as tarefas, ligadas às telas existentes.
4. Novas fichas simples (movimentações, licenças, lotação) e inclusão delas em Relatórios.
5. Conferência no navegador com seu login: cada setor abre, cada botão leva a algum lugar, nada fica "carregando" para sempre.

## Detalhes técnicos
- Registro único `src/features/simple/sectors.ts` (setor → cor, ícone, tarefas → rota existente ou ficha `sg_*`); setores do login vêm das concessões setoriais existentes, admin vê todos.
- Rotas novas `/setor/$slug`; `isSimplePath` passa a incluir `/setor`; telas antigas abrem dentro do SimpleShell com botão "Voltar ao início".
- Novas tabelas `sg_movements`, `sg_leaves`, `sg_postings` com RLS para logados; entram em `entities.ts` e no relatório.
- Tokens novos em `src/styles.css` (.sg), fontes via `<link>` no `__root.tsx`; ícones ilustrados gerados e salvos em `src/assets/sectors/`.
