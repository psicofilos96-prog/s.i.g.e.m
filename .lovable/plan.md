# Tirar "Fonte" das telas e consertar o que não funciona

## 1. Ninguém vê mais de onde veio a informação
- Saem das telas: "Fonte: planilha x", "observado em", "normalização", nomes de tabelas, "texto declarado", "Ausência de leitura nunca aparece como zero" e frases parecidas.
- Vale para todas as telas de uma vez. A troca é feita na peça comum que escreve essas linhas e nas cerca de 26 telas que escrevem "Fonte:" por conta própria.
- A informação continua guardada no sistema e segue aparecendo nos relatórios e na auditoria, onde é obrigatória. Só some da tela de uso diário.
- Exemplo, a jornada do aluno: fica "Segunda 07:30–14:30 …" e mais nada embaixo.

## 2. Botões que levam a "pertence a outro setor"
- Vou passar por cada botão e atalho das telas dos setores. Botão que leva a uma tela que o setor não pode usar deixa de aparecer.
- Caso que você mostrou: na CIECE, "Importar arquivos" levava à Central de integrações, que é só da administração. Ele passa a abrir a tela de importações de planilhas, que é a de uso dos setores, se a CIECE puder usá-la; se não puder, o botão some.
- Um teste automático vai garantir que nenhum botão de ação aponte para uma tela proibida à conta.

## 3. "Alunos" dizendo que não tem nada
- A tela Alunos ainda era uma tela antiga de demonstração. Com login, ela mostrava "Esta tela ainda não lê os dados da rede".
- Ela passa a mostrar a lista real dos estudantes da rede: busca por nome, filtro por escola e abertura da ficha do aluno, reaproveitando a lista real que já existe no cadastro.
- Mesmo conserto para as outras telas que ainda eram de demonstração: Profissionais, Atuações pedagógicas, Vínculos letivos, Regras de situação e Matrizes curriculares (nova, rascunho, nova versão e impressão). Onde já existe tela real, o item do menu leva direto para ela. Onde não existe, a tela de demonstração sai do menu.

## 4. Varredura "clica e não funciona"
- Abro cada item do menu e cada botão principal com os logins de setor que já tenho para testar: CIECE e Avaliação. Com os outros, testo quando você definir as senhas.
- Anoto o que acontece: abre, nega acesso, mostra vazio ou dá erro.
- Conserto o que estiver quebrado e mando fotos de antes e depois.

## O que não muda
Quem pode ver o quê continua igual. Nenhum dado é inventado.

## Detalhes técnicos
- `ProvenanceLine` (`src/components/sigem/states.tsx`) passa a não exibir nada na interface, deixando só `data-provenance` para auditoria e testes. Busca por `Fonte: ` nos arquivos `.tsx` e remoção das linhas soltas, como `student-journey` e os cards da CIECE. O PDF e o motor de relatórios ficam iguais.
- `ciece-tasks.ts`: "Importar arquivos" passa a apontar para `/importacoes`. As ações das superfícies de cada setor passam a ser filtradas por `pathAllowed`. Novo teste percorre os registros de tarefas e confere que todo destino existe e é filtrado.
- `/alunos`: troca de `DemoOnlyRoute` por um layout que renderiza a lista real de `institutional-lists.tsx` com paginação no servidor (`readPages`). Mesmo tratamento nas outras rotas listadas no item 3, ou remoção do item correspondente em `navigation.ts`.
- Varredura com Playwright usando as sessões já usadas antes. O critério de falha é "Você não tem acesso", "demonstração", "Algo deu errado" ou tela vazia depois de 5 segundos.
