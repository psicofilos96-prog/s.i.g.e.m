# Personalização de logos e tipos do Calendário

## Objetivo
Concluir, na tela de edição do Calendário, três recursos já parcialmente preparados no projeto: personalizar as logos do documento, criar e manter tipos de dia/evento e alternar Férias entre texto por extenso e marcador “F”.

## Entrega
- **Logos do calendário**
  - Exibir a composição atual do cabeçalho e permitir substituir a imagem por PNG/JPEG.
  - Permitir adicionar, ocultar, remover, reordenar e restaurar logos.
  - Permitir ajustar posição, alinhamento, largura, altura, proporção, encaixe, margens, distância e opacidade.
  - Usar a mesma composição no editor, documento e impressão, com sobrescritas A4 apenas quando a impressão separada estiver ativada.
  - Preservar as logos padrão existentes quando não houver personalização.

- **Tipos de dia e evento**
  - Criar uma seção “Tipos de dia e eventos” com lista do catálogo efetivo do calendário.
  - Permitir criar tipo com nome, sigla/palavra, significado, texto da legenda, natureza, efeito na contagem letiva, cores, ordem e visibilidade.
  - Permitir editar/versionar, ativar/inativar e excluir somente tipos criados e ainda não utilizados.
  - Fazer os tipos ativos aparecerem automaticamente na lista usada para alterar dias e aplicar faixas, sem lista paralela.
  - Impedir aplicação quando natureza ou efeito letivo não estiverem declarados, mostrando o motivo por extenso.

- **Férias: texto ou marcador**
  - Acrescentar ao editor visual a escolha “Texto por extenso” ou “Marcador”.
  - No modo texto, mostrar “FÉRIAS” na faixa; no modo marcador, mostrar “F” em cada dia selecionado.
  - Reutilizar a mesma representação na grade, prévia, documento e impressão.

## Validação
- Cobrir criação, edição, inativação, uso e preservação histórica dos tipos.
- Cobrir troca de imagem, redimensionamento, reposicionamento, proporção, restauração e herança de impressão das logos.
- Cobrir Férias nos dois modos e garantir que a contagem de dias não mude.
- Verificar desktop, largura de 382 px, zoom de 200% e PDF/A4, sem rolagem lateral, cortes, sobreposição ou redução silenciosa.
- Executar os testes do Calendário e a suíte completa; corrigir qualquer erro de compilação ou execução relacionado.

## Limites
- Não alterar regras acadêmicas, datas, contagens ou capacidades.
- Não criar exemplos oficiais nem gravar dados institucionais.
- Manter a persistência e a governança já usadas pelo Calendário; esta etapa conclui a interface e a renderização existentes.
