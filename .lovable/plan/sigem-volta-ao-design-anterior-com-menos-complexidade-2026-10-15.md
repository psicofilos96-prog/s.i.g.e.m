# SIGEM: volta ao design anterior, com menos complexidade

## 1. Voltar ao design anterior
- A tela azul escura ("SIGEM Simples") sai. Volta a aparência anterior do SIGEM: menu lateral, cores, logos e páginas de antes.
- A tela inicial volta a ser a anterior (hoje ela fica em "Modo avançado").
- Nenhum dado é apagado. Os cadastros feitos nas telas novas continuam guardados e são ligados aos cadastros oficiais (passo 4), para nada se perder.

## 2. Menos informação na tela, com o mesmo visual
Mantemos o design e tiramos o excesso:
- **Início por setor:** cada pessoa vê só as tarefas do próprio setor. São até 6 cartões grandes, com ícone e uma palavra (ex.: "Matricular", "Chamada", "Relatórios"). O restante fica em "Ver tudo".
- **Cada página:** um título, uma frase curta e uma ação principal bem visível. Os detalhes ficam em abas ou em "Mais detalhes", fechados por padrão.
- **Some do uso diário:** códigos internos, versões, "proveniência", "homologação", "rascunho", "indeterminado", "sem regra", avisos técnicos e selos de estado repetidos.
- **Avisos:** só aparecem quando a pessoa pode resolver algo, numa frase simples e com o botão que resolve.
- **Menu lateral:** agrupado por setor, com nomes curtos, e mostra só o que o login pode usar.

## 3. Sem travas
- Fazer o trabalho do dia a dia não depende mais de norma, homologação, ato ou vínculo: cadastrar servidor, aluno, turma e escola; matricular, transferir e remanejar; chamada; notas; licenças e lotação; calendário; mapa. A pessoa preenche e salva.
- Quando a regra de cálculo não foi configurada, o sistema usa uma regra padrão: 200 dias letivos, frequência mínima de 75%, média 6, e o Mapa tirado no último dia letivo. Você pode mudar essas regras depois numa tela de "Configurações".
- O histórico continua guardado, para relatórios e desfazer, mas sem exigir aprovação.
- O calendário, o Mapa Estatístico e os PDFs oficiais continuam funcionando como hoje.

## 4. Tudo ligado e pronto para relatório
- Há um cadastro único para cada coisa (aluno, servidor, turma, escola). As telas novas e as antigas passam a usar a mesma base, para não haver duas versões do mesmo dado.
- A tela Relatórios atual ganha um modo rápido: escolher o assunto, como separar (escola, turma, etapa, sexo, idade, cargo, mês) e ver o gráfico e a tabela na hora, com Excel e PDF.

## 5. Visual mais caprichado, no estilo atual
- Mantemos as cores, as fontes e os logos de hoje. Ganham destaque os cartões com ícone, os números grandes no início de cada setor e os espaços mais arejados.
- Os textos ficam curtos, com uma ação principal por tela, e a interface se ajusta ao celular e ao computador.

## Ordem de entrega
1. Voltar o design anterior (rápido, sem perder dados).
2. Início por setor e menu enxuto.
3. Tirar as travas e os textos técnicos, setor por setor: Secretaria, Direção, Professor, Supervisão, CIECE, Orientação, NEI, Alimentação, DP e Família.
4. Unificar os cadastros e criar o modo rápido de relatórios.
5. Conferir cada setor no navegador.

## Detalhes técnicos
- Remover o desvio `isSimplePath` em `app-shell.tsx`. Restaurar `src/routes/index.tsx` a partir de `avancado.tsx`, mantendo `/avancado` como redirecionamento. As rotas `/cadastro/*`, `/chamada` e `/numeros` passam a usar o AppShell ou redirecionam às telas equivalentes.
- Remover o tema `.sg` de `styles.css` e o `SimpleShell`.
- Tabelas `sg_*`: migração de reconciliação para as tabelas institucionais. Depois disso, ficam só para leitura. Nada é apagado.
- Writers que hoje recusam por falta de norma/homologação passam a aplicar uma "regra padrão do proprietário": versão de configuração registrada como decisão do proprietário, editável. As travas `fail-closed` deixam de bloquear o uso diário. Permissão por login continua: cada setor vê o seu, e o admin vê tudo.
- Os textos técnicos saem por `ui-vocabulary`/`state-presentation` e pelas primitivas de `states.tsx` (uma mudança central, não tela por tela). A proveniência fica só no modo auditoria.
- Atualizar `AGENTS.md` e a memória com a nova regra do proprietário: padrão aplicado, nada bloqueia, e o design anterior fica mantido.
