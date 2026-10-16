# Ficha de Matrícula — modelo de impressão (A4 retrato)

## O que você vai ter
- Botão **"Imprimir Ficha de Matrícula"** na ficha do aluno e no último passo da Nova matrícula.
- Botão **"Ficha em branco"** na Secretaria, para preenchimento à mão (mesmo visual, sem dados).
- Pré-visualização igual ao arquivo final, com "Baixar PDF" (A4 retrato, sem depender das margens do navegador) e "Imprimir".

## Visual (fiel à imagem de referência)
- Cabeçalho: brasão à esquerda, Prefeitura / Secretaria / nome, endereço, telefone e e-mail da escola (do cadastro da escola) no centro, logo do SIGEM à direita.
- Faixa azul-escura "FICHA DE MATRÍCULA" com "ANO LETIVO", quadro da foto 3x4 (mostra a foto quando existe; senão, quadro vazio).
- Seções numeradas em círculo azul com ícone, faixas azul-claras, linhas finas, caixas de seleção, cores da especificação (#164780, #10386B, #D9EAF8, #F2F7FC, #B9D1E5, #172B45), fonte Arial/Inter, tamanhos da especificação.
- Fundo branco, boa leitura também em impressão preto e branco.

## Páginas
```text
Página 1  Cabeçalho completo + 01 Aluno + 02 Pai + 03 Mãe + 04 Representante legal
Página 2  Cabeçalho compacto + 05 Documentação + 06 Saúde + 07 Uso de imagem + 10 Assinaturas e parecer
Página 3  (opcional) Cabeçalho compacto + 08 Educação Especial (com legenda das siglas) + 09 Recursos SAEB
```
- Cada página tem altura fixa de A4 (margem 12 mm); nenhuma seção é partida entre páginas; textos longos quebram dentro do próprio campo.
- Rodapé "Página X de Y".
- Página 3 só sai quando a pessoa marca "Incluir anexo de Educação Especial" e tem permissão de ver dados de inclusão.

## De onde vem cada informação
Preenche só o que o SIGEM já registra; o resto fica em branco (nunca "null", "não informado" ou similar):
- Escola, endereço, contatos: cadastro da escola.
- Nome, nascimento, nome social, ID Censo, turma/ano de escolaridade, ano letivo: cadastro do aluno e matrícula.
- Endereço, responsáveis (nome, parentesco, telefone): dados da matrícula guiada. Pai, mãe e representante só são preenchidos quando o parentesco registrado diz isso; nada é presumido.
- Foto: foto atual do aluno.
- Documentos: marcados só se a conferência documental registrou "recebido/validado".
- Uso de imagem, saúde, Educação Especial, recursos SAEB, deferimento: marcados só quando há registro; sem registro, caixas vazias.

Campos do modelo que hoje não têm onde ser guardados (cor/raça, etnia, NIS, RG e órgão, profissão dos pais, alergias, diabetes, autorização de imagem, recursos SAEB, deferimento etc.) saem em branco para preencher à mão. Vou listar essas lacunas num documento para decidirmos depois se viram campos da matrícula — não crio campos novos agora.

## Fora desta etapa
- Tela de personalização do modelo (cores, margens, logos) — fica para uma etapa seguinte.

## Detalhes técnicos
- Novo módulo puro `src/features/school-secretariat/enrollment-form-print.ts`: `enrollmentFormHtml(data, options)` gera HTML+CSS completo (`@page{size:A4;margin:0}`, `.page{width:210mm;height:297mm;padding:12mm;box-sizing:border-box;break-after:page;overflow:hidden}`, `break-inside:avoid` por seção, `overflow-wrap:anywhere`, rodapé com contador).
- Leitor `enrollment-form-source.ts` com a sessão do usuário (RLS), reutilizando `student-record`, `enrollment-wizard-source` (rascunho/foto), `document-checklist` e o cadastro da escola; não grava nada.
- PDF direto: renderização do HTML em iframe oculto + impressão; ícones em SVG inline (vetoriais).
- Testes: A4 retrato, 2 páginas sem anexo / 3 com anexo, nenhum "null/undefined/não informado", caixas vazias sem registro, pai/mãe não presumidos, texto de 300 caracteres não aumenta páginas; entra no bloco de auditoria de impressão.
- Inspeção visual: gerar PDF com dados longos, rasterizar cada página e conferir margens/cortes.
- Lacunas registradas em `docs/ficha-matricula-impressao.md` (com "Situação atual" e entrada no mapa de docs).
