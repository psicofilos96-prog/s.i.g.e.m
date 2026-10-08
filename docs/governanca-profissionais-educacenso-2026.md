# Profissionais EducaCenso 2026: matching e carga (Frente D)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Estado
**Carga real BLOQUEADA POR FONTE AUSENTE, não por login.** O ambiente do agente não recebeu:
- Todos os prof.xlsx
- Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx
- Relacao_Funcionarios_SEMED_por_Setor.xlsx

Nenhuma pessoa, vínculo, lotação ou atuação foi criada.

## Separação preservada (tabelas existentes, sem segunda base)
| Conceito | Destino canônico |
|---|---|
| Pessoa | `institutional_persons` (identificador SIGEM) |
| Vínculo + matrícula | `professional_functional_links.functional_registration` (da matrícula, nunca PK) |
| Cargo / função / exercício | fatos próprios (`professional_exercises`, `professional_qualifications`) |
| Lotação | `professional_postings` (escola `inep-<INEP>` ou setor) |
| Atuação SIGEM / capability | `institutional_engagements`: não é criada pela carga |
| Regência | `teaching_assignments`: nunca inferida; "turma de atuação" só é catalogada |

Os campos de autoria humana dessas tabelas já aceitam NULL. A carga técnica poderá gravar sem falsificar autoria.

## Matching (`src/features/professionals/educacenso-professional-matching.ts`)
- **Chave da pessoa:** fingerprint do CPF, gerado no pipeline seguro com segredo de sessão. CPF inválido ou ausente é erro; o nome sozinho nunca casa.
- **Chave do vínculo:** matrícula. Sem matrícula, o vínculo fica separado e é sinalizado, nunca fundido.
- **Vários vínculos e lotações** da mesma pessoa ficam separados.
- **Erros explícitos:** pessoa não cadastrada, escola inexistente, lotação ausente, cargo divergente no mesmo vínculo.
- **Relatório publicável:** só contagens por código. Nenhum CPF, nome ou fingerprint.

## Privacidade
CPF, nomes, contato, filiação e dados bancários nunca entram em repositório, docs, fixtures, logs ou relatórios. Dados bancários não são importados.

## Próximo passo, quando as planilhas chegarem
1. Profiling do formato real.
2. Prévia agregada.
3. Migration aditiva com o núcleo comum e a operação `technical_import_educacenso_2026_professionals` sobre a camada 0100, com idempotência por hash + matrícula + lotação + vigência.
4. Carga.
5. Prova na Cloud.

O cadastro de pessoas inexistentes exige decisão explícita: a fonte autoritativa precisa sustentá-lo, e a carga não cria pessoa ad hoc.
