# Ficha de Matrícula — modelo de impressão (2026-10-16)

## Situação atual
- Classe: **Referência vigente**. Descreve o gerador em vigor; regras prevalecem no `AGENTS.md` da Secretaria.
- Homologação visual: **pendente da conferência do proprietário** sobre os PDFs de exemplo.

## O que existe
- Modelo único em mm (`src/features/school-secretariat/enrollment-form/layout.ts`); SVG (prévia/impressão) e PDF vetorial jsPDF (`render.ts`) só traduzem primitivas, com a mesma métrica Helvetica.
- Modos: ficha preenchida (aluno) e ficha em branco (só escola + ano letivo, gerada pela Secretaria sem aluno).
- Páginas: 1 identificação; 2 documentação/saúde/imagem/assinaturas; 3 anexo de Educação Especial (opcional, só com `consultar-casos-de-inclusao`); 4 Controle de Renovação (opcional, colunas do quadro original).
- Paginação determinística: seção que não cabe vai inteira para página de continuação; maior que uma página divide entre linhas com "(continuação)". Sem `overflow:hidden`.
- Verificação: `layout.test.ts` (margens, sobreposição, páginas, texto longo, caixas sem registro, parentesco); `scripts/enrollment-form-samples.ts` + `scripts/enrollment-form-visual-compare.py` (prévia × PDF, 100 dpi, tolerância 2% de pixels divergentes).

## Lacunas de dados (saem em branco; nenhum campo foi criado)
| Campo da ficha | Situação | Proposta |
|---|---|---|
| Cor/raça, etnia, nacionalidade, município/UF de nascimento | sem fonte no cadastro | versão de identidade do aluno |
| Sexo | `student_identity_versions` guarda id de esquema, sem rótulo lido aqui | ler pelo esquema homologado |
| RG, órgão, expedição, CPF em claro, NIS, nº da certidão nova | CPF só HMAC; demais sem fonte | identificadores oficiais por tipo |
| Pai/mãe/representante além de nome e telefone | matrícula guiada guarda só nome, parentesco, telefone | vínculo responsável com dados próprios |
| Zona, distrito, telefone do aluno | sem fonte | endereço versionado |
| Repetente, ex-aluno, NEE, laudo | sem fonte | perguntas da matrícula |
| Documentos apresentados | conferência documental ainda não persistida | eventos de `document-checklist` |
| Saúde, autorização de imagem, recursos SAEB, deferimento | sem registro | termos/consentimentos e parecer da Direção |
| Caracterização de Educação Especial | NEI só por funções DEFINER | leitura autorizada do caso NEI |
| Renovações anteriores | sem leitura dedicada | ledger de renovação |
