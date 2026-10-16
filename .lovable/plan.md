# Ficha de Matrícula — modelo de impressão (A4 retrato)

## O que você vai ter
- Botão **"Imprimir Ficha de Matrícula"** na ficha do aluno e no último passo da Nova matrícula.
- Dois modos com o mesmo visual: **Ficha preenchida** (dados do SIGEM) e **Ficha em branco** (linhas e caixas com altura adequada para escrita à mão), também disponível na Secretaria.
- Pré-visualização, **"Baixar PDF"** (gera o arquivo .pdf direto, sem caixa de impressão) e **"Imprimir"** — os três saem do mesmo desenho, com o mesmo resultado.
- Opções antes de gerar: incluir anexo de Educação Especial (só para quem tem permissão) e incluir Controle de Renovação.

## Visual (fiel à imagem de referência)
- Cabeçalho: brasão à esquerda; Prefeitura / Secretaria / nome, endereço, telefone e e-mail da escola (do cadastro) no centro; logo do SIGEM à direita.
- Faixa azul-escura "FICHA DE MATRÍCULA" com "ANO LETIVO"; quadro da foto 3x4 (foto quando existe; senão quadro vazio).
- Seções numeradas em círculo azul com ícone, faixas azul-claras, linhas finas, caixas de seleção, cores e tamanhos de letra da especificação; fundo branco, legível em preto e branco.

## Páginas
```text
Página 1  Cabeçalho completo + 01 Aluno + 02 Pai + 03 Mãe + 04 Representante legal
Página 2  Cabeçalho compacto + 05 Documentação + 06 Saúde + 07 Uso de imagem + 10 Assinaturas e parecer
Página 3  (opcional, com permissão) 08 Educação Especial + legenda das siglas + 09 Recursos SAEB
Página 4  (opcional) Controle de Renovação de Matrícula
```
- Rodapé "Página X de Y" e cabeçalho compacto nas páginas seguintes.
- **Paginação segura, sem cortar nada:** antes de gerar, o sistema mede a altura real de cada seção com os dados reais. Se uma seção não couber na página prevista, ela passa inteira para uma página de continuação (com cabeçalho compacto e "continuação"), nunca é cortada, encolhida ilegível ou sobreposta. Textos longos quebram em várias linhas dentro do campo, e a seção cresce o necessário.

## Controle de Renovação
- Tabela por ano letivo: ano, ano de escolaridade/turma, data, assinatura do responsável, assinatura da secretaria.
- Na ficha preenchida, mostra as renovações já registradas no SIGEM (separadas da matrícula inicial); linhas restantes em branco. Na ficha em branco, todas as linhas vazias.
- Não recebi o formulário original de renovação nesta conversa; sigo esse formato e ajusto se você me enviar o original.

## De onde vem cada informação
Preenche só o que o SIGEM já registra; o resto fica em branco (nunca "null", "não informado" etc.):
- Escola e contatos: cadastro da escola. Nome, nascimento, nome social, ID Censo, turma/ano, ano letivo: cadastro e matrícula.
- Endereço e responsáveis: dados da matrícula guiada. Pai, mãe e representante só quando o parentesco registrado diz isso; nada é presumido.
- Foto: foto atual do aluno. Documentos: marcados só com conferência registrada.
- Uso de imagem, saúde, Educação Especial, SAEB, deferimento: marcados só com registro; sem registro, caixas vazias.
- Sem tabelas ou campos novos nesta etapa. O que o modelo pede e o SIGEM ainda não guarda (cor/raça, etnia, NIS, RG e órgão, profissão dos pais, alergias, diabetes, autorização de imagem, recursos SAEB, deferimento etc.) sai em branco e fica listado num documento de lacunas, com proposta de onde guardar.

## Conferência antes de entregar
Testes automáticos e inspeção de cada página dos PDFs gerados em: nomes muito longos, endereços longos, campos vazios, ficha em branco, com e sem anexo de Educação Especial, com e sem Renovação.

## Fora desta etapa
- Tela de personalização do modelo (cores, margens, logos).

## Detalhes técnicos
- Modelo de layout único `src/features/school-secretariat/enrollment-form/layout.ts` (puro): transforma dados em blocos posicionados em mm (textos, linhas, caixas, faixas, ícones vetoriais), com medição de texto pela métrica da fonte e paginação determinística por seção (`break` só entre seções/linhas de tabela; seção maior que a página divide por linhas de campo).
- Dois desenhadores do mesmo modelo: HTML/SVG para pré-visualização e impressão, e PDF vetorial com `jspdf` (texto real, fonte embutida) para "Baixar PDF" — garante resultado idêntico. Imagens (brasão, logo, foto) convertidas para PNG antes de embutir.
- Leitor `enrollment-form/source.ts` com a sessão do usuário (RLS), reutilizando `student-record`, `enrollment-wizard-source` (rascunho/foto), `document-checklist`, renovações já existentes e cadastro da escola; não grava nada. Anexo de Educação Especial só carregado se a capacidade de inclusão estiver presente.
- Testes: A4 retrato; nenhum bloco ultrapassa a área útil nem se sobrepõe; 2 páginas base, +1 por anexo; texto de 300 caracteres gera continuação sem perda; nenhum "null/undefined/não informado"; caixas vazias sem registro; pai/mãe não presumidos; anexo ausente sem permissão; entra na auditoria de impressão.
- Inspeção visual: PDFs gerados nos cenários acima, rasterizados com `pdftoppm` e conferidos página a página.
- Lacunas em `docs/ficha-matricula-impressao.md` (com "Situação atual", entrada no mapa de docs); regra de arquitetura no `AGENTS.md` da Secretaria; tarefa no `roadmap.md`.
