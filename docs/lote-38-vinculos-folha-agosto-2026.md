# Lote 38 — vínculos funcionais da folha de matrículas agosto/2026

## Situação atual
- Classe: **Registro de lote** (2026-10-12). Migration `0508_l38_payroll_functional_registrations.sql`.
- Corrige o L32/L37: a folha é fonte primária de **vínculos** (matrícula = chave do vínculo). A falta de CPF impede só a ligação a pessoas, não o registro dos vínculos.

## Fonte (bytes acessados no ambiente, upload privado da conversa; não versionada)
`MATRÍCULA_-_SEMED_-_AGOSTO_-_2026-3.xlsx`, aba AGOSTO, SHA-256 `dac8d12e8ca79861ad692f2e24b1ddd45e207f5896cbc0f10583fdc3d4c7db01`. 2.037 linhas, 2.037 matrículas distintas (também após normalização), 1.952 pares nome+nascimento, 85 nomes com 2 matrículas (mesmo nascimento) = 85 pessoas prováveis com 2 vínculos.

## O que foi implementado
- `payroll_functional_registrations`: um registro por vínculo, append-only (sem UPDATE/DELETE/TRUNCATE), com arquivo, hash, aba, linha, período; `registration_norm` = só dígitos, imposto pelo banco (dígito verificador preservado); `qpmec_number` próprio e recusado se igual à matrícula; únicos (hash, aba, linha) e (hash, matrícula). Grava só a camada técnica; leitura só com `consultar-registro-funcional`/`consultar-quadro-profissional-da-rede`.
- `payroll_registration_person_links` + `record_payroll_person_link`: ligação vínculo→pessoa é decisão humana (sessão, `manter-registro-funcional` de rede, evidência, seq esperado, idempotência, sem autovinculação), revogação por novo evento; nada é fundido.
- `payroll_staff_registration_matches` (view INVOKER): casamento determinístico por matrícula normalizada.
- `scripts/lote38-payroll-import.py` (fail-closed: opt-in, destino canônico, leiaute exato; saída só contagens) e `scripts/lote38-payroll-checks.py`.

## Contagens antes → depois
| Item | Antes | Depois |
|---|---|---|
| Vínculos da folha registrados | 0 | **2.037** (0 rejeitados) |
| Reimportação do mesmo arquivo | — | 0 gravados, 2.037 já existentes |
| Pessoas | 10.822 | 10.822 |
| `professional_functional_links` | 551 (0 com matrícula) | 551 (inalterados) |
| Ligações vínculo→pessoa | 0 | 0 |
| Lotações / atuações / permissões | 0 / 2 / — | 0 / 2 / nenhuma atribuída |

## SEMED por setor (219)
- 213 matrículas casam com a folha (conferido no banco pela view); nomes iguais nas 213.
- 6 sem correspondência: 4 com matrícula e nome ausentes da folha; 2 com nome presente na folha (1 vínculo cada) mas matrícula totalmente diferente (não é só dígito verificador); 1 das 6 tem formato não numérico (`SM-MT…`). Ficam pendentes de conferência pelo DP; nada foi corrigido.

## Relação por escola (1.797, sem matrícula)
- Nome exato presente na folha: 1.115 linhas (61 com nome que corresponde a 2 matrículas). Com nome normalizado (sem acento/espaço): 1.425 com 1 matrícula, 89 com 2+, 283 fora da folha. Os números diferem dos informados (1.021/50) provavelmente porque o staging veio de outra versão do arquivo; nenhum é usado como identidade.
- Por escola: `docs/data/lote38-pendencias-escola-vinculo.json` (40 escolas, só contagens). Escola↔vínculo continua candidato com revisão humana.

## Provas (executadas, `L38_CHECKS 13/13`)
matrícula única; 85 pares com 2 vínculos mantidos separados; duplicata/reimportação recusada (409); QP-MEC = matrícula recusado; normalização imposta; alteração e exclusão recusadas; anônimo não lê, não grava, não vincula; executor técnico sem sessão não vincula pessoa; 0 ligações criadas; 213/219 SEMED.
**Não executado:** vincular e revogar com sessão humana real — exige titular de `manter-registro-funcional` de rede (sem titular).

## Bloqueios exatos
1. Ligação vínculo→pessoa: pessoas do banco não têm chave (CPF/INEP-pessoa); só decisão humana com evidência, e não há titular da capacidade.
2. 6 matrículas SEMED divergentes: conferência do DP.
3. QP-MEC: coluna pronta; carga da planilha QP-MEC não feita (escopo por cargo a confirmar).
4. SHA: entra no próximo registro automático.
