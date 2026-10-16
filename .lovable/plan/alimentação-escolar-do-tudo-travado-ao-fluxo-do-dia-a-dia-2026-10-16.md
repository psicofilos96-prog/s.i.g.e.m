# Alimentação Escolar: do "tudo travado" ao fluxo do dia a dia

## Situação hoje
O SIGEM já tem quase todas as peças do Núcleo: pedido, autorização, mapa de compras, recebimento com nota fiscal, não conformidade, estoque, execução do dia, cozinha, amostras e relatórios. Mas nada funciona na prática: **não há nenhum item no catálogo, nenhuma cozinha, nenhuma janela de pedido e nenhum pedido**. Cada cadastro exige três pessoas diferentes (registrar, conferir, homologar) antes de valer. Por isso toda tela mostra "falta cadastrar" e o setor não consegue começar.

## O que vou fazer

### 1. Destravar o começo
- O **cadastro feito pela Coordenação ou pela Nutricionista passa a valer na hora**. A conferência por outra pessoa continua existindo, mas como opção, e não como requisito.
- A **regra de segregação** do documento continua valendo: quem altera o per capita não aprova a compra que ele dimensiona. Quando a mesma pessoa precisar fazer as duas coisas, o sistema registra a exceção, como pede o documento.
- **Preparar o início com dados reais:**
  - as unidades com a categoria de cada escola (urbana, rural/campo, conveniada, creche);
  - a quantidade de alunos por etapa e turno, tirada das matrículas;
  - a janela de pedido padrão (dia 15 ao dia 20, fechando às 23:59:59 do dia 20), que a Coordenação pode alterar.
- **Catálogo inicial de gêneros:** eu não tenho a lista oficial de gêneros. Proponho começar com os itens citados na conversa (açúcar, biscoito, pão etc.), marcados como "rascunho para conferir", até você me enviar a planilha do catálogo e do cardápio anual.

### 2. Itens proibidos para creches
- Cada item informa quais categorias de unidade podem recebê-lo.
- Para as **creches municipais e conveniadas**, começo vedando **açúcar, biscoito e pão**, como foi dito na conversa. Fica como regra editável.
- O item vedado **nem aparece** no pedido da creche, e o servidor recusa se alguém tentar mandar. Acaba o "por que ela pediu e não ganhou?".

### 3. Uma tela inicial por perfil: "O que preciso fazer agora"
- **Escola (Direção/Inspetor):** "Pedido de novembro aberto: faltam 3 dias", "2 entregas para conferir", "1 não conformidade com prazo de 24h".
- **Coordenação:** pedidos para analisar, com as exceções destacadas (acima do teto, zerados, fora do padrão), compras para consolidar e ocorrências abertas.
- **Nutricionista:** cardápios e per capita a publicar.
- **Cozinha:** o cardápio de hoje, o POP e o registro rápido das refeições por turno.
- **Auditor:** só os relatórios.
- Menu de no máximo 6 a 8 itens por perfil, com as palavras do setor. Os detalhes (cálculo do teto, histórico, auditoria) ficam em "ver detalhes".

### 4. Pedido da escola no celular
- Lista só com os itens permitidos à unidade, com saldo em estoque e teto ("como esse teto foi calculado").
- Rascunho salvo sozinho, envio com resumo e confirmação. Depois do envio, ou do fim do prazo, o pedido fica congelado. Só a Coordenação reabre, e precisa dizer o motivo.
- Item com quantidade zero pede confirmação. O teto **avisa, mas não bloqueia**, até a fórmula ser aprovada.

### 5. Autorização até o fornecedor
- Na autorização, a Coordenação aprova, ajusta com justificativa ou rejeita, e divide a entrega em até duas datas.
- O mapa de compras soma só os pedidos autorizados e separa por fornecedor e por empenho.
- O sistema gera a **minuta do e-mail ao fornecedor** em PDF e Excel, para revisão antes de enviar. Isso substitui o e-mail montado à mão.

### 6. Conferência no mesmo caminho
Revisar com cada perfil o caminho inteiro: entrega → nota fiscal → aceite (o aceito entra no estoque) ou rejeição (vira ocorrência) → execução do dia → saldo do mês → próximo pedido. Cada etapa deve funcionar no celular, com botões grandes.

### 7. Conferir no navegador
Fazer um pedido completo numa escola de teste, do pedido até o estoque, entrando com as contas da escola, da Alimentação e da cozinha.

## Fica como opção que dá para mudar depois (não é regra fixa)
- O prazo do pedido.
- A fórmula do teto.
- Qual estoque entra no pedido.
- A regra das creches para escolas que atendem idades misturadas.
- O nome "Refeições por aluno", que fica no lugar de "adesão" até haver a definição oficial.
- As alçadas e a integração com empenho e financeiro.

## O que depende de você
- A planilha do **catálogo de gêneros** (com marcas, embalagens, fornecedores e atas) e o **cardápio anual**. Sem elas, o catálogo começa como rascunho.
- Quem são as **nutricionistas** e a **Coordenação do Núcleo** (nomes ou matrículas), para ligar as contas a esses perfis.

## Detalhes técnicos
- Acrescentar a opção "valer na hora com registro de exceção" aos registros existentes (`record_meal_master`, categorias e janelas), sem tirar as cadeias que já existem, e com prova SQL.
- O veto por categoria de unidade passa a ser dado do item, conferido no writer do pedido (`record_meal_order`).
- A tela inicial por perfil é uma projeção pura sobre os readers que já existem (`meal_kitchen_day_at`, `meal_network_action_summary`, pedidos e recebimentos), sem tabela de resumo.
- A minuta do fornecedor sai pelo `report-engine`, a partir de `meal_demand_consolidation_at`.
- Tudo fica registrado no `AGENTS.md` da Alimentação.
