# Análise de SIGEM.rar (protótipo) e DOCUMENTOS_PRO_CHATGPT.rar

Situação atual: Registro de lote (2026-10-10). Protótipo é referência histórica; nenhum código, regra ou dado foi copiado.

## Inventário
- Documentos: 139 arquivos (88 planilhas de dados, 17 modelos/formulários, 14 PDFs, 19 outros documentos, 1 temporário do Office). 49 são idênticos (mesmo hash) a arquivos já enviados antes; 1 falhou ao abrir.
- Protótipo: Next.js, 16 módulos, 281 migrations.
- Planilha com hash, classificação e leitura: `/mnt/documents/base-2026/restrito/inventario-rar-2026-10-10.xlsx` (contém nomes de arquivos de pessoas; fora do repositório).

## Protótipo × SIGEM atual (por tela do protótipo)
| Módulo do protótipo | Telas | No SIGEM atual |
|---|---|---|
| Secretaria | alunos, turmas, livro de matrícula, vagas, mapa, transporte, infraestrutura, avisos, pessoal | Existe (`/secretaria`, `/alunos`, `/turmas`, livro, vagas, transporte, infraestrutura, avisos) |
| Secretaria | solicitações de vaga | FALTA |
| Secretaria | campos extras do SIPE | FALTA (personalização da estrutura do SIPE) |
| Docente | turmas, calendário, SIPE, SIA | Existe (Diário, planejamento, avaliações do professor), parcial |
| Docente | atendimento domiciliar | FALTA |
| Coordenação/OP | conselho de classe, rendimento, SIPE, SIA, NEE | Existe em parte (conselho no Diário, inclusão); rendimento PARCIAL |
| Coordenação/Direção | ocorrências, reclassificações | FALTA |
| Direção | alimentação, infraestrutura, transporte | Existe (painel da Direção, leitura) |
| DP | servidores, cargos, funções, designações, eventos, alertas | Parcial (Departamento Pessoal); cargos/funções padronizados FALTA (lista enviada em NOME_DOS_CARGOS) |
| DP | processos disciplinares | FALTA tela (PAD só citado como escopo do DP) |
| Estatística | mapas, cabeçalho do mapa, vagas, servidores, NEE, transporte | Existe (Mapa mensal, consolidado) |
| Estatística | exportação GPE | BLOQUEADO (sem leiaute oficial do GPE) |
| Relatórios | gerador, boletim, consolidado | Gerador existe; boletim BLOQUEADO; consolidado existe |
| Modelos de documento | modelos por setor | Existe (Studio de documentos) |
| Família, Mediador, NEI, Cozinha, Supervisão, Calendário | — | Existem |

## Requisitos novos nos documentos
| Documento | Classe | Situação |
|---|---|---|
| TERMO DE CIÊNCIA DE FALTAS (3º PL) | modelo | A CONFIRMAR: entra como modelo do Studio (rascunho não homologado) |
| TERMO DE SUSPENSÃO | modelo | Depende de módulo de ocorrências (falta) |
| Termo de autorização de uso de imagem | modelo | Modelo do Studio |
| Pré-matrícula Infantil / 2º ao 5º ano | modelo | Comparar com matrícula guiada existente |
| TABELA 09 (2025) | modelo | A CONFIRMAR o uso |
| Folha de ponto 2026 | modelo + dado | Depende de lotação real (nenhuma matrícula funcional ligada a escola) |
| FUNDEB | dado | Não importado; só prévia |
| SAEB | dado | Não importado; validação de arquivo já existe |
| NEE × Censo, NEE/AEE | dado sensível | Não importado; exige perfil restrito |
| Servidores tempo integral | dado pessoal | Não importado |

## Lotes sugeridos (ordem)
1. Cargos e funções padronizados (lista já enviada) ligados ao cadastro de pessoal.
2. Ocorrências escolares + termo de suspensão e termo de ciência de faltas (modelos não homologados).
3. Reclassificação e atendimento domiciliar.
4. Solicitações de vaga e personalização da estrutura do SIPE pela Secretaria.
5. Importação com prévia de SAEB e NEE × Censo (perfil restrito).
6. FUNDEB e folha de ponto, depois da lotação real dos servidores.
