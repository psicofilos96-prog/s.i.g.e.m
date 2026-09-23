# Etapa 11D — Diário Inteligente da Educação Infantil

## Objetivo

Integrar ao Diário Inteligente uma experiência pedagógica própria da Educação Infantil, reconhecida automaticamente pela atuação selecionada. A entrega preservará a identidade, a arquitetura e os fluxos das Etapas 11A–11C, usando somente fixtures fictícias e estado temporário na aba.

## Experiência e navegação

- Adaptar o registro existente em `/diario/registrar` quando a atuação for de Educação Infantil, sem criar um “Diário Infantil” paralelo.
- Criar rotas próprias de consulta para o histórico e detalhe pedagógico da Educação Infantil, mantendo vínculos com agenda, histórico geral e chamada existente.
- Exibir terminologia contextual: experiência realizada, turma/grupo, campos de experiência, objetivos e observações qualitativas.
- Integrar os registros à linha do tempo do Diário com leitura editorial compacta e sem expor textos individuais sensíveis em listagens.

## Registro de experiência

- Organizar o fluxo em contexto, experiência realizada, campos de experiência, objetivos, observação coletiva e observações individuais.
- Reutilizar atuação, data, turma, escola, agrupamentos, planejamento e estado de rascunho já existentes.
- Manter planejamento e realização como conceitos distintos; copiar referência planejada apenas após ação explícita.
- Criar seletor amplo de objetivos com busca, filtro por campo, seleção múltipla, contador e remoção simples.
- Permitir observações individuais somente para crianças alocadas na turma na data, reutilizando a projeção temporal da chamada; crianças inelegíveis aparecerão apenas como explicação separada.
- Preservar avisos de dados temporários, bloqueio de saída com alterações e conclusão apenas demonstrativa.

## Dados e integração

- Reutilizar os cinco campos de experiência já modelados e os contextos `tur-009`/`atp-002`.
- Criar objetivos e registros históricos explicitamente demonstrativos, sem ampliar taxonomia normativa.
- Estender a projeção dos registros para representar metadados próprios da Educação Infantil sem alterar o contrato das aulas do Ensino Fundamental/EJA.
- Relacionar cada experiência concluída à chamada existente pelo mesmo registro, preservando estados, bloqueios e a ausência de percentual de frequência na Educação Infantil.

## Interface e responsividade

- Manter a direção visual aprovada, com agrupamentos abertos, superfícies discretas e alta densidade controlada.
- Reutilizar `InformationPair`, painéis fluidos, `min-width: 0`, quebras seguras e coluna contextual adaptativa.
- No celular, empilhar contexto, experiência, campos, objetivos, observações e ações nessa ordem.
- Não alterar arbitrariamente componentes globais nem adicionar bibliotecas pesadas.

## Testes e validação

- Cobrir reconhecimento do contexto, terminologia, campos e objetivos, busca/filtro/remoção, observações coletivas e individuais, elegibilidade temporal, planejamento, chamada, rascunho, histórico, detalhe, linha do tempo, privacidade, ausência de notas/percentuais e navegação.
- Incluir conteúdo institucional longo, múltiplos chips, observações multilinha, teclado e acessibilidade.
- Preservar os 686 testes existentes e executar suíte completa, tipos, build e lint.
- Inspecionar a versão final em 390, 768, 1024, 1366, 1440 e 1920px, 1366×768 e 1920×1080, zoom 125%/150% e sidebar aberta/recolhida.

## Fora de escopo

Backend, banco, autenticação real, persistência oficial, notas, médias, recuperação, aprovação/reprovação, documentos oficiais, auditoria definitiva, homologação e Etapa 11E.
