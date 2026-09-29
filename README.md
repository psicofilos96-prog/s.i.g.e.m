# SIGEM 2.0

# SIGEM 2.0 — FUNDAÇÃO DO FRONTEND, DESIGN SYSTEM E APP SHELL

Quero iniciar do zero o frontend de um sistema chamado:

SIGEM 2.0

Sistema Integrado de Gestão e Estatística Escolar

Instituição:

Prefeitura Municipal de Itaperuna

Secretaria Municipal de Educação

Este será um sistema municipal de gestão educacional de grande porte, utilizado por escolas e setores da Secretaria Municipal de Educação.

IMPORTANTE:

Este é apenas o PRIMEIRO PASSO do projeto.

Neste momento, NÃO quero implementar módulos de negócio, banco de dados, autenticação real, Supabase, APIs, schema de domínio ou regras educacionais.

Quero construir uma FUNDAÇÃO DE FRONTEND excepcionalmente sólida, bonita, consistente e preparada para receber posteriormente todo o sistema.

==================================================

1. OBJETIVO DESTA ETAPA

==================================================

Construa:

1. Fundação visual do SIGEM 2.0

2. Design System inicial

3. Tokens de design

4. App Shell

5. Sidebar

6. Topbar

7. Área principal

8. Home/Dashboard inicial apenas como demonstração da linguagem visual

9. Estados fundamentais de interface

10. Página interna /design-system para documentar e testar componentes

NÃO avance para módulos de negócio.

Ao terminar esta etapa, PARE e apresente o resultado.

==================================================

2. PRINCÍPIO CENTRAL

==================================================

O SIGEM 2.0 não deve parecer:

- sistema administrativo antigo;

- ERP genérico;

- template comprado;

- dashboard genérico de SaaS;

- planilha transformada em site;

- sistema governamental ultrapassado;

- coleção de cards sem hierarquia.

Quero uma aplicação que transmita:

- tecnologia;

- educação;

- inteligência;

- precisão;

- confiança institucional;

- organização;

- modernidade;

- profissionalismo;

- clareza;

- velocidade;

- identidade própria.

O produto deve conseguir acomodar no futuro telas extremamente densas de dados sem perder elegância.

A beleza deve servir à produtividade.

==================================================

3. DIREÇÃO VISUAL INICIAL

==================================================

Utilize como universo cromático inicial:

- azul-marinho institucional;

- azul;

- azul claro;

- teal/ciano discreto;

- branco;

- cinzas azulados muito claros.

Cores semânticas:

- verde para sucesso;

- âmbar para atenção;

- vermelho para erro/perigo;

- azul para informação/ações.

Evite saturação excessiva.

A aparência deve ser premium, limpa e institucional.

Utilize:

- bordas discretas;

- sombras muito sutis;

- excelente tipografia;

- hierarquia visual forte;

- espaçamento extremamente consistente;

- ícones modernos;

- cantos moderadamente arredondados;

- superfícies bem diferenciadas;

- excelente alinhamento.

Não abuse de glassmorphism.

Não abuse de gradientes.

Não use efeitos decorativos sem função.

==================================================

4. DESIGN SYSTEM

==================================================

Crie tokens centralizados para:

- cores;

- tipografia;

- tamanhos;

- pesos;

- line-height;

- espaçamento;

- radius;

- borders;

- shadows;

- z-index;

- motion;

- estados;

- densidade.

Evite valores arbitrários espalhados pelos componentes.

A aplicação inteira deverá futuramente conseguir mudar de aparência de forma consistente através desses tokens.

Crie uma página:

/design-system

Ela deve servir como laboratório visual do SIGEM.

Inclua exemplos dos principais componentes e estados.

==================================================

5. TIPOGRAFIA

==================================================

Utilize uma fonte sans-serif moderna, extremamente legível e adequada para interfaces densas.

A tipografia precisa possuir hierarquia clara para:

- títulos de página;

- títulos de seção;

- subtítulos;

- corpo;

- labels;

- tabelas;

- números;

- metadados;

- badges;

- mensagens auxiliares.

Evite títulos gigantes.

Este será um sistema operacional utilizado durante muitas horas por profissionais.

==================================================

6. APP SHELL

==================================================

Construa uma estrutura principal composta por:

SIDEBAR

+

TOPBAR

+

MAIN CONTENT

A estrutura deve funcionar muito bem especialmente em:

1366x768

1440x900

1920x1080

Desktop/notebook é prioridade.

Mas prepare responsividade adequada para telas menores.

==================================================

7. SIDEBAR

==================================================

Crie uma sidebar profissional e compacta.

Ela deverá possuir:

- identidade SIGEM;

- navegação hierárquica;

- grupos;

- ícones;

- item ativo muito claro;

- estados hover/focus;

- possibilidade futura de recolhimento;

- excelente aproveitamento vertical.

IMPORTANTE:

Os itens utilizados agora são apenas DEMONSTRATIVOS.

Não invente uma taxonomia definitiva dos módulos do SIGEM.

Pode utilizar exemplos temporários como:

Início

Acadêmico

Pessoas

Relatórios

Documentos

Configurações

mas deixe explícito no código que essa navegação é provisória.

Não crie lógica de negócio associada a esses itens.

==================================================

8. TOPBAR

==================================================

Crie uma topbar limpa e funcional.

Ela pode preparar espaço para:

- contexto atual;

- pesquisa futura;

- notificações;

- ajuda;

- perfil do usuário.

Esses elementos são VISUAIS nesta etapa.

Não implemente backend, autenticação ou pesquisa real.

==================================================

9. HOME / DASHBOARD

==================================================

Crie uma Home inicial que demonstre a qualidade visual do sistema.

IMPORTANTE:

Não invente estatísticas reais.

Não invente números da Secretaria.

Se precisar demonstrar componentes, marque claramente os dados como:

"Dados demonstrativos"

ou utilize placeholders.

A Home NÃO deve ser simplesmente:

card

card

card

card

gráfico

gráfico.

Crie hierarquia.

Trabalhe composição, ritmo, áreas de atenção, contexto e informação.

Esta Home ainda poderá ser completamente redesenhada posteriormente.

Ela serve nesta etapa principalmente para validar:

- App Shell;

- grid;

- tipografia;

- superfícies;

- densidade;

- componentes;

- responsividade;

- identidade visual.

==================================================

10. COMPONENTES FUNDAMENTAIS

==================================================

Prepare componentes reutilizáveis para o futuro.

Entre eles:

Button

IconButton

Input

Textarea

Select

Checkbox

Radio

Switch

Badge

Tooltip

Popover

Dropdown

Tabs

Breadcrumb

Card

StatCard

Alert

Toast

Modal/Dialog

Drawer

EmptyState

Skeleton

Table/DataGrid foundation

Pagination

FilterBar

SearchField

DateField

SectionHeader

PageHeader

Não é necessário criar funcionalidades complexas.

O objetivo é estabelecer padrões consistentes.

==================================================

11. ESTADOS FUNDAMENTAIS

==================================================

O Design System deve demonstrar explicitamente:

Loading / Skeleton

Empty State

Error State

Permission Denied

Not Found

Offline State

Stale Data Indicator

Conflict State

Unsaved Changes

Success Feedback

Disabled State

Read-only State

IMPORTANTE:

Não diga que existe cache offline ou sincronização offline.

O sistema ainda não possui essa implementação.

O estado Offline deve utilizar uma mensagem neutra.

==================================================

12. FORMULÁRIOS FUTUROS

==================================================

Prepare a linguagem visual para formulários administrativos complexos.

Eles precisarão suportar futuramente:

- muitas informações;

- seções;

- validações;

- campos condicionais;

- autosave;

- histórico;

- revisão;

- leitura;

- edição;

- erros;

- ajuda contextual.

Priorize clareza e escaneabilidade.

==================================================

13. TABELAS FUTURAS

==================================================

As tabelas serão extremamente importantes no SIGEM.

Prepare uma fundação visual para tabelas densas.

Elas deverão futuramente suportar:

- muitas linhas;

- muitas colunas;

- filtros;

- ordenação;

- paginação;

- seleção;

- ações;

- sticky header;

- eventualmente primeira coluna fixa;

- badges;

- números;

- datas;

- estados;

- loading;

- empty;

- erro.

Não implemente ainda lógica complexa de DataGrid.

Defina apenas a linguagem visual e estrutura reutilizável.

==================================================

14. DENSIDADE

==================================================

Este é um requisito extremamente importante.

O SIGEM trabalhará com grandes quantidades de informação.

Não crie uma interface exageradamente espaçosa.

Precisamos de:

elegância

+

densidade

+

legibilidade.

Especialmente em 1366x768.

Uma pessoa precisa conseguir trabalhar durante horas sem sentir que metade da tela está sendo desperdiçada.

==================================================

15. ACESSIBILIDADE

==================================================

Considere desde agora:

- contraste;

- navegação por teclado;

- focus visible;

- labels;

- aria;

- tamanho mínimo de alvos interativos;

- semântica HTML;

- reduced motion.

Não sacrifique acessibilidade por estética.

==================================================

16. MICROINTERAÇÕES

==================================================

Utilize motion com extrema moderação.

Preferência:

150–250ms

Use animações para:

- feedback;

- mudança de estado;

- abertura;

- fechamento;

- hover;

- seleção.

Não utilize animações apenas para impressionar.

Respeite prefers-reduced-motion.

==================================================

17. ARQUITETURA DE FRONTEND

==================================================

Organize o projeto de maneira profissional e escalável.

Separe adequadamente:

- aplicação;

- componentes;

- design system;

- layouts;

- páginas;

- utilitários;

- tokens;

- tipos puramente de UI quando necessários.

Evite arquivos gigantes.

Evite duplicação.

Evite componentes excessivamente acoplados.

==================================================

18. NÃO MODELAR O DOMÍNIO AGORA

==================================================

REGRA MUITO IMPORTANTE:

Não invente entidades de negócio.

Não crie agora:

Aluno

Matrícula

Turma

Professor

Servidor

Escola

Calendário

Mapa Estatístico

Censo

AEE

Matriz Curricular

como modelos definitivos do sistema.

Não crie schema de banco.

Não crie migrations.

Não crie Supabase.

Não crie autenticação real.

Não crie políticas de acesso.

Não crie APIs falsas tentando antecipar o backend.

Não tome decisões arquiteturais de domínio nesta etapa.

Essas especificações serão fornecidas posteriormente.

==================================================

19. NÃO IMPLEMENTAR LOGIN AINDA

==================================================

Não construa a tela de Login nesta etapa.

A tela de Login terá uma direção artística institucional específica de Itaperuna e será fornecida posteriormente.

Apenas deixe a arquitetura preparada para uma futura rota pública de autenticação.

==================================================

20. IDENTIDADE DE ITAPERUNA

==================================================

O produto pertence à:

Prefeitura Municipal de Itaperuna

Secretaria Municipal de Educação

Entretanto, nesta primeira etapa NÃO invente brasões, fotografias, monumentos ou imagens da cidade.

Posteriormente fornecerei referências visuais reais.

IMPORTANTE PARA O FUTURO:

Existe um Cristo em Itaperuna que poderá fazer parte da identidade visual do sistema.

Ele NÃO é o Cristo Redentor do Rio de Janeiro.

Nunca substitua o Cristo de Itaperuna por:

- Cristo Redentor do Rio;

- silhueta genérica de Cristo;

- monumento inventado.

Quando chegarmos a essa etapa, fornecerei as referências corretas.

==================================================

21. TECNOLOGIA

==================================================

Use uma stack moderna e sustentável dentro do ambiente disponível no Lovable.

Prefira:

React

TypeScript

Tailwind CSS

componentes acessíveis

ícones consistentes

Se o projeto criado pelo Lovable já possuir uma stack moderna adequada, não reescreva tudo sem necessidade.

Não adicione dependências pesadas sem justificativa.

==================================================

22. QUALIDADE DO CÓDIGO

==================================================

Antes de concluir:

- execute build;

- execute typecheck;

- execute lint;

- execute testes existentes, se houver;

- corrija erros;

- remova warnings relevantes;

- verifique imports;

- verifique responsividade;

- verifique console.

Não declare sucesso se houver erro conhecido.

==================================================

23. INSPEÇÃO VISUAL

==================================================

Inspecione especialmente:

1366x768

1440x900

1920x1080

Procure:

- desperdício de espaço;

- sidebar larga demais;

- topbar alta demais;

- textos cortados;

- overflow;

- componentes desalinhados;

- densidade ruim;

- contraste;

- inconsistências;

- comportamento responsivo.

==================================================

24. CRITÉRIO DE ACEITE

==================================================

Ao terminar esta etapa, quero olhar para o produto e perceber que existe uma FUNDAÇÃO profissional para um sistema municipal de educação de grande porte.

Mas não quero que você tente terminar o SIGEM agora.

O resultado deve ser:

coerente;

bonito;

rápido;

organizado;

acessível;

escalável;

denso quando necessário;

visualmente sofisticado;

tecnicamente limpo.

E, principalmente:

PRONTO PARA RECEBER AS ESPECIFICAÇÕES REAIS DO SIGEM NAS PRÓXIMAS ETAPAS.

==================================================

25. ENTREGA

==================================================

Ao concluir, apresente:

1. O que foi criado.

2. Estrutura principal de arquivos.

3. Tokens definidos.

4. Componentes criados.

5. Decisões visuais.

6. Estados implementados.

7. Como ficou a Home.

8. Comportamento responsivo.

9. Resultado de build.

10. Resultado de typecheck.

11. Resultado de lint.

12. Resultado dos testes.

13. Pendências reais.

14. Decisões que deliberadamente NÃO foram tomadas.

Depois disso:

PARE.

Não avance para Login.

Não avance para módulos.

Não avance para banco de dados.

Não avance para autenticação.

Não avance para modelagem do domínio.

Aguarde minhas próximas instruções.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2a288ac3-f204-4816-b0e2-123b6b6673d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
