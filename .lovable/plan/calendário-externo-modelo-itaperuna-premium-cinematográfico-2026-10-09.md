# Calendário Externo — modelo "Itaperuna Premium — Cinematográfico 2027" com camadas vetoriais

## Ponto de partida (o que já existe)
O SIGEM já tem um calendário externo ligado ao interno. Ele não guarda datas próprias: datas, tipos de dia, totais, feriados e conselhos vêm do calendário interno. A diagramação livre é em milímetros sobre a folha A4 paisagem (blocos Cabeçalho, Tabela, Períodos, Legenda, Feriados, Conselhos, Assinaturas, Rodapé), com tipografia por bloco, foto superior e inferior com foco, zoom e opacidade, imagens avulsas, desfazer/refazer e um perfil salvo no banco por modelo. O trabalho abaixo amplia isso; não cria uma segunda base.

## O que muda para a Supervisão
1. **Novo modelo "Itaperuna Premium — Cinematográfico 2027"**, montado como a referência:
   - Foto do Cristo e da igreja no alto, foto do rio e da ponte embaixo.
   - Faixas azul-marinho onduladas com filete dourado.
   - Título "CALENDÁRIO ESCOLAR 2027" com o ano em dourado e um subtítulo, que vem da modalidade.
   - Brasão e logo da Prefeitura à esquerda, logo da Educação à direita.
   - A tabela, a legenda, os feriados, os períodos e conselhos e as assinaturas no rodapé seguem o mesmo arranjo da referência.
   - As fotos e logos enviados viram imagens do sistema. A arte de referência serve só de guia visual: nenhuma data ou sigla é copiada dela.
2. **Camadas independentes**, para mover um elemento sem estragar a composição:
   - **Fotografias:** trocar, mover e redimensionar a moldura; mover e dar zoom na imagem dentro dela sem deformar; foco; brilho, contraste, saturação, opacidade e película de cor; voltar ao original. O corte nunca altera o arquivo.
   - **Curvas (ondas):** vetoriais, nunca imagem. Altura, amplitude, inclinação, cor ou degradê, filete (cor e espessura), posição, opacidade e ordem. Cinco curvas prontas para começar. Mover a foto não mexe na curva, e vice-versa.
   - **Título e subtítulo:** blocos de texto próprios, com fonte, tamanho, negrito, itálico, cor, espaçamento entre letras e alinhamento.
   - **Logos:** blocos próprios, que podem ser movidos e redimensionados.
3. **Editor:**
   - Arrastar, redimensionar, coordenadas X/Y e tamanhos numéricos em mm.
   - Guias de alinhamento que atraem o elemento, além de alinhar e distribuir.
   - Lista de camadas: subir e descer, travar, ocultar, duplicar só os enfeites.
   - Desfazer e refazer.
   - A tabela e os blocos de dados não podem ser apagados, só ocultados.
4. **Modelos:** salvar, duplicar, renomear e restaurar o padrão. O modelo serve para outro ano: o título usa o ano do calendário interno.
5. **Impressão:** A4 e A3 paisagem pela mesma medida em mm; pré-visualização fiel; PDF. A área de assinaturas e carimbos tem tamanho mínimo e um aviso de sobreposição.
6. **Sincronização:** mudar um dia, feriado, período ou conselho no calendário interno aparece no externo na hora, e a formatação é mantida.

## Fora do escopo agora
- Exportar em PNG: fica para uma segunda etapa, se você quiser.
- Permissões: continuam as mesmas. Só a Supervisão edita o modelo; os demais consultam.

## Pendência anterior (EJA Semestral 98 × 100)
Falta a sua decisão: os dias 20/12 e 21/12 (Conselho Final), que ficam depois do fim do último período, devem contar no total? Até lá, a coluna e o total continuam somando 98 de forma coerente.

## Detalhes técnicos
- Assets: `lovable-assets` para as duas fotos e os três logos, com ponteiros `.asset.json` em `src/assets/calendar-premium/`. Os logos atuais em `calendar-logos.ts` são mantidos.
- `calendar-external-free.ts`:
  - Novos tipos de camada `WaveLayer` (path SVG por parâmetros: altura, amplitude, fase, inclinação, preenchimento, filete), `TextLayer` (título e subtítulo com tokens `{ano}` e `{modalidade}`, resolvidos do `PrintModel`) e `ImageLayer` (moldura em mm + `ImgAdjust` estendido com brilho, contraste, saturação e película).
  - Todas as camadas passam por `sanitizeFree`, com limites em `LIMITS`.
  - Migração de leitura: o perfil antigo sem camadas recebe as do padrão do modelo.
- `calendar-external-presets.ts`: preset `itaperuna-premium-2027` com coordenadas em mm medidas sobre a referência. Os presets de curva ficam em `calendar-external-waves.ts`, que é puro.
- `calendar-external-sheets.tsx`: novo renderizador para o modelo. Ondas em `<svg viewBox>` em mm; imagens com CSS `filter`; a tabela reutiliza o `ExternalViewModel` existente, sem nenhuma contagem nova.
- `calendar-external-free-editor.tsx`:
  - Painel de camadas, inspetor por tipo, guias inteligentes (snap às bordas e aos centros dos outros blocos) e alinhar/distribuir.
  - Os blocos estruturais não têm botão de apagar.
- Persistência: o mesmo perfil externo versionado no banco que já existe (`calendar_external_profile_revisions`). Duplicar e renomear usam `calendar_external_preset_versions`. Sem migration destrutiva; se faltar coluna, uma migration aditiva.
- Impressão: `@page` A4/A3 landscape com escala por razão de mm. Aviso se a área de assinaturas sobrepõe outro bloco (`layoutIssues`).
- Testes (vitest):
  - Mudança no interno reflete no externo e preserva a formatação.
  - Meses de 28, 29, 30 e 31 dias.
  - `sanitizeFree` das novas camadas.
  - Mover a foto não altera a curva.
  - Ordem das camadas.
  - Reutilização do modelo em 2028.
  - A4 e A3.
  - Assinaturas sem sobreposição.
  - Acesso: só a Supervisão edita.
- Verificação visual: render do modelo em Playwright, A4 e A3, comparado à referência (proporções, curvas, cores).
- `AGENTS.md` do calendário recebe a regra: camadas decorativas são só aparência e nunca carregam dado.
