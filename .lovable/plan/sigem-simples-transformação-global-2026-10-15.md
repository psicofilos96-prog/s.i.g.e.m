# SIGEM Simples — transformação global

Decisão do proprietário (2026-10-15): o SIGEM vira um sistema direto. Cadastrar → fica registrado → gera relatório. Sem bloqueios por norma, homologação ou vínculo.

## O que você vai ver

Uma tela inicial com 6 botões grandes, com ícone, cor e uma palavra:

```text
[ Alunos ]   [ Servidores ]   [ Turmas ]
[ Escolas ]  [ Frequência ]   [ Relatórios ]
```

- Cada botão abre uma lista com busca e um botão enorme "+ Novo".
- Cadastro em uma única tela curta, campos com ícone e exemplo. Salvar = pronto. Sem rascunho, sem aprovação.
- Ligações automáticas: aluno escolhe a turma; turma escolhe escola e professor; servidor escolhe escola e função. Tudo por lista de toque, nunca digitando códigos.
- Relatórios: escolher "O quê" (alunos, servidores, turmas, frequência), "Filtrar por" (escola, turma, ano, sexo, idade, função…) e ver tabela + gráfico na hora. Baixar em Excel ou PDF com um toque.
- Painel de números na tela inicial: total de alunos, servidores, turmas, escolas, frequência do mês.
- Visual novo: escuro azul-profundo com brilho ciano, cartões grandes arredondados, letra grande, ícones claros, funciona no celular.

## O que sai do caminho

- Fim das mensagens "sem regra homologada", "precisa de autorização", "fonte", "rascunho", "não homologado".
- Seu login (admin@) e os logins de direção/secretaria podem cadastrar e ver tudo da própria área; o seu vê tudo.
- As telas antigas não são apagadas (os dados já cadastrados continuam): ficam escondidas atrás de um único link "Modo avançado" no rodapé.

## Ordem de entrega

1. Novo visual e tela inicial com os 6 botões + números.
2. Alunos, Turmas, Escolas, Servidores: listar, cadastrar, editar, ligar.
3. Frequência simples: escolher turma e dia, tocar presente/falta.
4. Relatórios livres com gráfico e exportação.
5. Esconder telas antigas e mensagens de bloqueio; conferir tudo no navegador com seu login.

## Detalhes técnicos

- Reaproveitar as tabelas atuais de escolas, turmas, estudantes, matrículas e servidores (sem cadastro duplicado); as escritas simples passam por funções novas no banco que exigem login e gravam autor/data.
- Liberar acesso de escrita para o login mestre e contas de setor com escopo escolar; RLS continua ligado (só quem entra mexe).
- Relatórios: consulta única no servidor por assunto+filtros, agregação por campo escolhido, gráfico com a biblioteca já usada.
- Rotas novas: `/` (início), `/alunos`, `/servidores`, `/turmas`, `/escolas`, `/frequencia`, `/relatorios`; antigas sob "Modo avançado".
- Atualizar memória: owner decision substitui exigências de homologação/norma.
