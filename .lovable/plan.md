# SIGEM simples: cada pessoa vê só o seu trabalho

## Objetivo
Qualquer pessoa entra e, sem ler instruções, sabe o que fazer. O trabalho complicado continua acontecendo por trás, mas a tela mostra só o básico: o que é meu, o que tenho para fazer hoje e um botão grande para cada tarefa.

## Regras de tela (valem para o sistema inteiro)
1. **Uma tela, uma pergunta.** No alto, um título curto ("Minhas turmas") e no máximo uma frase.
2. **Botões grandes com ícone e uma palavra:** Chamada, Notas, Conteúdo, Planejamento, Prova, Relatórios. Nada de siglas ou nomes técnicos na primeira tela.
3. **No máximo 6 opções por tela.** O resto fica atrás de "Mais".
4. **Esconder a mecânica.** Versões, "homologação", códigos, origem dos dados, regras e avisos técnicos saem da tela principal. Ficam num "Detalhes" que já vem fechado.
5. **Cores com significado fixo:** verde = pronto, amarelo = falta fazer, vermelho = problema. Sempre junto de uma palavra, nunca só a cor.
6. **Sem acesso não aparece.** Quem não pode usar uma função não vê o botão. Nada de listas cheias de "Sem acesso".
7. **Bonito e calmo:** muito espaço em branco, letra grande e legível, um único tom principal, cartões arredondados. Funciona bem no celular.
8. **Nunca presa em "Carregando"** (regra do ajuste de rapidez, que continua valendo).

## Início igual para todos, conteúdo de cada setor
Toda conta, ao entrar, vê a mesma estrutura:

```text
+--------------------------------------------+
| Bom dia, [nome do setor ou da pessoa]      |
| Hoje: [data]   [aviso mais importante]     |
+--------------------------------------------+
| [Botão grande] [Botão grande] [Botão grande]|
| [Botão grande] [Botão grande] [Botão grande]|
+--------------------------------------------+
| Para fazer hoje (até 5 itens)              |
| Datas importantes  |  Avisos e comunicados |
+--------------------------------------------+
```

Os seis botões de cada perfil, conforme o que você descreveu:
- **Professor:** Minhas turmas, Chamada, Notas, Conteúdo, Planejamento (SIPE), Prova (SIA). Em "Mais": Relatórios de alunos e Diário completo.
- **Secretaria escolar:** Mapa estatístico, Matricular, Transferir/Remanejar, Renovar matrícula, Turmas e servidores, Documentos e ofícios.
- **Orientação Pedagógica:** Planejamentos para avaliar, Provas dos professores, Desempenho dos alunos, Relatórios recebidos, Gerar relatório.
- **Direção:** Visão da escola, Turmas, Alunos, Desempenho, Estrutura, Relatórios.
- **Mediador:** Registrar mediação, Minhas atividades, Relatórios.
- **Supervisão:** Calendário do ano, Escolas, Desempenho das escolas, Acompanhamento, Relatórios. Tudo só leitura, menos o calendário.
- **CIECE (Estatística):** Mapas das escolas, Censo escolar, Gerador de relatórios, Painéis.
- **Alimentação:** Cozinhas, Pedidos, Entregas, Cardápio, Relatórios.
- **Acompanhamento e Avaliação:** Registrar avaliação, Resultados, Indícios, Relatórios.

## Menu lateral
- Mostra só os itens do perfil, de 5 a 7, com ícone grande e uma palavra.
- Itens de administração aparecem só para o login mestre.
- No celular vira uma barra embaixo com 4 botões e "Mais".

## Ordem de entrega
1. **Telas-modelo para você aprovar:** o novo Início (Professor e Secretaria), uma tela de lista (Alunos) e uma de tarefa (Chamada). Você aprova o visual antes de eu espalhar para o resto.
2. **Moldura geral:** menu curto, cabeçalho limpo e a regra de "Detalhes fechado", aplicados de uma vez nas peças comuns. Assim todas as telas melhoram juntas.
3. **Perfil por perfil**, na ordem: Professor, Secretaria, Direção, OP, Supervisão, CIECE, Alimentação, Acompanhamento e Avaliação, Mediador.
4. **Prova com contas reais:** abrir cada Início com o login de cada setor, com fotos das telas, e conferir que cada botão leva à tarefa certa.

## O que não muda
Quem pode ver ou fazer cada coisa continua igual. As regras, os dados e os registros também. Só muda a forma de mostrar.

## Detalhes técnicos
- A moldura em `src/components/app-shell/app-shell.tsx` ganha um `SimpleHome` com o cartão de saudação, a grade de 6 botões, "Para fazer hoje", datas e avisos.
- Os atalhos de cada perfil ficam num registro único `src/config/profile-home.ts`: perfil → até 6 ações (rota, ícone, rótulo) mais "Mais". A visibilidade é decidida só por `pathAllowed`, como manda a regra de autoridade.
- `src/config/navigation.ts` filtra itens sem acesso em vez de mostrá-los desativados. O teto é de 7 itens por perfil, guardado por teste.
- `TaskGuide`, proveniência, versão e estados técnicos passam a ficar num `<details>` fechado por padrão, mudando só os componentes compartilhados (`states.tsx`, `patterns.tsx`, `PageHeader`).
- Tokens de design novos em `src/styles.css`: escala maior de letra, raio dos cartões, cores pronto/pendente/problema. Sem cores cruas.
- Testes:
  - limite de ações por tela;
  - nenhum botão aparece sem `pathAllowed`;
  - termos técnicos ("homologação", "proveniência", "versão") ausentes do primeiro nível do Início;
  - os testes de acessibilidade existentes continuam passando.
- Fotos de prova com Playwright, no computador e no celular, para cada perfil cujo login tenha senha definida.
