# Parâmetros por setor — que realmente funcionam

## Objetivo
Uma tela "Parâmetros" em cada setor: o setor define e altera prazos, fórmulas e limites quando quiser. Cada parâmetro só existe se algum cálculo ou tela do SIGEM o usa de fato. Ao salvar, o quadro "Bloqueado" correspondente passa a mostrar o número. Toda alteração gera nova versão com histórico (quem, quando, motivo); nada é apagado.

## Regra de ouro
Um parâmetro só entra na tela quando três coisas estão prontas ao mesmo tempo:
1. o lugar onde ele é salvo,
2. o cálculo que o lê,
3. o quadro ou aviso que muda quando ele é definido.

Se faltar uma delas, o parâmetro não aparece.

## Estrutura da tela (igual em todos os setores, conteúdo diferente)
- Acesso: menu do setor → "Parâmetros" (`/parametros/<setor>`). Só aparece para quem tem permissão de configurar aquele setor.
- Parâmetros agrupados por assunto (ex.: Prazos, Fórmulas, Limites). Cada um mostra:
  - o valor atual;
  - "Usado em:", com links para as telas afetadas;
  - quem alterou e quando.
- Botão "Alterar": campo adequado (número de dias, percentual, escolha de fórmula) + motivo curto → salva nova versão, que vale na hora.
- "Ver histórico": versões anteriores.
- Parâmetro ainda não definido: aviso simples "Ainda não definido — enquanto isso, o quadro X fica sem número".

## Ondas de entrega

### Onda 1 — Alimentação (começa já)
Novos parâmetros, cada um ligado ao seu consumidor:
- **Prazo para resolver não conformidade** (dias) → quadro "Prazo das não conformidades" na Central e nos recebimentos: vencidas/no prazo.
- **Fórmula da adesão** (refeições servidas ÷ alunos presentes, ou ÷ matriculados) → quadro "Adesão" e relatórios.
- **Saldo que vale para o pedido** (saldo atual ou saldo menos entregas previstas) → aviso do estoque e teto do pedido.
- **Estoque mínimo por item** → alerta de reposição no estoque.

Os cadastros técnicos que já existem (per capita, proibições por público, conversões de unidade) ganham atalho nesta mesma tela, sem duplicar.

"Escolas sem execução registrada" depende do calendário de cada escola. Como você pediu para não mexer no calendário, ele só é ligado se você autorizar.

### Onda 2 — Setores que já têm regras em telas separadas
Reunir na tela de Parâmetros, como atalhos para o que já funciona:
- Matrículas: os parâmetros oficiais atuais.
- Avaliação/CIECE: Regras avaliativas e Regras de situação (média, frequência, dias letivos), mantendo a regra atual.
- Mapa Estatístico: data da fotografia.

### Onda 3 — Prazos e limites novos dos demais setores
Para cada setor (Secretaria, Direção, Supervisão, Orientação, NEI, DP, Família, Tecnologia), só os parâmetros que hoje aparecem como "Bloqueado"/"Falta definir" na tela. Exemplos já encontrados:
- capacidade máxima de turma;
- prazo de tramitação de protocolos;
- limiar de infrequência (Direção);
- carga contratual (DP).

Cada um só entra depois que o cálculo que o usa estiver ligado e testado.

## Verificação
- Para cada parâmetro: teste que prova que sem valor o quadro fica "Ainda não definido" e com valor mostra o número calculado a partir dele.
- Entrar com a conta da Alimentação, definir o prazo e a adesão, e ver os quadros da Central mudarem.

## Detalhes técnicos
- Tabela única de parâmetros versionados (setor, chave, valor, vigência, autor da sessão, motivo, versão anterior esperada), só com acréscimos. Gravação por uma única função do banco que confere a permissão de configurar o setor; leitura pela função `parameter_at(chave, data)`.
- Registro de parâmetros no código (`src/config/sector-parameters.ts`): chave, setor, tipo, unidade, consumidores. Um teste recusa parâmetro sem consumidor declarado e sem leitura real no código.
- Alimentação: `meal_network_action_summary` e os modelos de recebimento, execução e estoque passam a ler `parameter_at` em vez de devolver bloqueio fixo.
- A aprovação por uma segunda pessoa continua obrigatória só onde já é exigida hoje (ex.: Matrículas). Os parâmetros novos valem ao salvar, por decisão do proprietário.
