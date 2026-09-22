# Redireção de arte — Home, Login e App Shell

## Objetivo
Transformar o SIGEM em uma experiência institucional contemporânea, menos compartimentada e mais editorial, mantendo a base técnica, os componentes acessíveis e o Design System existentes.

## Implementação
- Recompor a Home como centro de situação: fotografia de Itaperuna integrada à estrutura, contexto principal, indicadores tipográficos, atenção e movimentações em superfícies contínuas, sem grade tradicional de cartões.
- Criar `/login` como experiência visual demonstrativa e cinematográfica, usando somente os assets oficiais e sem autenticação, API ou SSO real.
- Separar visualmente `/login` do App Shell, preservando o shell nas telas internas.
- Refinar Sidebar e Topbar com navegação mais silenciosa, agrupamento claro, seleção sofisticada, busca futura compacta e menos elementos concorrentes.
- Ajustar apenas os tokens necessários em `src/styles.css`, mantendo compatibilidade com componentes e estados existentes.
- Atualizar o laboratório `/design-system` para documentar a direção visual revisada sem remover seus exemplos atuais.

## Direção visual
- Paleta reduzida: navy, azul, cyan/teal, branco e neutros azulados; cores semânticas somente para estados.
- Tipografia e espaço como principais organizadores; bordas e sombras usadas com parcimônia.
- Fotografia tratada apenas por enquadramento e camadas CSS não destrutivas, preservando cidade, horizonte e Cristo.
- Assinatura territorial sutil por linhas topográficas, sem repetir monumentos ou transformar o sistema em mapa.

## Comportamento
- Home compacta e útil já em 1366×768.
- Login com maior liberdade visual, reorganizado em tablet e mobile.
- Navegação recolhível no desktop e painel móvel acessível.
- Controles demonstrativos deixam explícito que não executam autenticação ou operações reais.

## Validação
- Conferir Home, Login e Design System em 1366×768, 1440×900, 1920×1080, tablet e mobile.
- Verificar contraste, foco, teclado, overflow, assets, console e integridade visual da fotografia.
- Confirmar build, typecheck, lint e testes existentes, registrando avisos ou limitações reais no relatório final.
