# Plano — Fundação frontend do SIGEM

## Objetivo
Construir somente a fundação visual e estrutural do SIGEM: identidade institucional, design system, app shell, Home demonstrativa e laboratório em `/design-system`, sem login, backend, domínio educacional ou dados reais.

## O que será construído
- App shell responsivo com sidebar compacta, topbar funcional e área principal densa.
- Navegação provisória claramente isolada, com os itens demonstrativos solicitados e sem lógica de negócio.
- Home em `/` para validar hierarquia, densidade, superfícies, estados, tabela e composição; qualquer conteúdo será identificado como demonstrativo.
- Página `/design-system` com amostras interativas dos componentes fundamentais e estados de interface.
- Componentes reutilizáveis de cabeçalhos, pesquisa, filtros, indicadores, tabela, paginação e estados.
- Comportamento para desktop prioritário e adaptação para telas menores com menu lateral móvel.

## Direção visual
- Azul-marinho institucional como base, azul para ação, ciano/teal discreto como apoio e superfícies claras azuladas.
- Verde, âmbar, vermelho e azul usados semanticamente.
- Tipografia sans-serif legível para uso prolongado, títulos controlados e números tabulares.
- Bordas precisas, sombras mínimas, cantos moderados e motion entre 150–250 ms com redução de movimento respeitada.
- Densidade compacta sem sacrificar alvos interativos, contraste ou leitura.

## Design system e tokens
- Centralizar cores, tipografia, escala, espaçamento, raios, bordas, sombras, camadas, movimento, estados e densidade em `src/styles.css`.
- Ajustar os componentes acessíveis já disponíveis em vez de introduzir uma biblioteca paralela.
- Criar variantes consistentes para ações, feedback, leitura, desabilitado e foco visível.

## Estrutura técnica
- `src/components/app-shell/`: identidade, sidebar e topbar.
- `src/components/sigem/`: cabeçalhos, indicadores, filtros, pesquisa, estados e fundação de tabela.
- `src/config/`: navegação provisória e configurações somente visuais.
- `src/routes/index.tsx`: Home demonstrativa.
- `src/routes/design-system.tsx`: laboratório visual completo.
- `src/styles.css`: tokens e fundação global.
- `src/routes/__root.tsx`: shell compartilhado, fontes e metadados globais neutros.

## Estados demonstrados
Loading/Skeleton, vazio, erro, permissão negada, não encontrado, offline neutro, dados desatualizados, conflito, alterações não salvas, sucesso, desabilitado e somente leitura.

## Validação
- Verificar visualmente em 1366×768, 1440×900 e 1920×1080, além de uma largura móvel.
- Conferir teclado, foco, labels, nomes acessíveis, contraste, overflow e console.
- Conferir o fluxo entre Home e Design System.
- Verificar build automático, typecheck, lint e testes existentes, relatando resultados e pendências reais.

## Fora do escopo desta etapa
Login, autenticação, banco de dados, APIs, regras educacionais, modelos de domínio, permissões reais, pesquisa real, dados municipais reais e identidade iconográfica/fotográfica de Itaperuna.
