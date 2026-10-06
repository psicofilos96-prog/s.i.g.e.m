# Calendário — modelos externos de apresentação (CAL.EXT.1)

## Modelo interno blindado
O documento atual (`InstitutionalPrintSheet` / `InstitutionalCalendarPrint`) passa a ser o **Modelo interno**.
Não teve DOM, CSS, impressão, regras ou contagens alterados. A seleção é feita por fora do renderer
(`PrintVersion` em `institutional-calendar-management.tsx`): com "Interno" (padrão) o caminho é idêntico ao
anterior; o arquivo `institutional-calendar-print.tsx` não importa nada dos externos (teste).

## Uma verdade, três apresentações
Registry `PRESENTATION_TEMPLATES` (`calendar-external-model.ts`): `interno`, `externo-panoramico`, `externo-mosaico`.
Fonte única: `calendar_days_at` → `readCalendarDays` + snapshot `calendar_presentation_at` → `buildPrintModel`.
Os externos recebem o MESMO `PrintModel` e só derivam `ExternalViewModel` (grade mês×dia, semanas D..S,
dia da semana real em UTC, meses com 28/29/30/31 dias). Não chamam o motor do laboratório, não contam dias,
não gravam conteúdo, não têm catálogo próprio; indeterminado é texto "indeterminado", nunca 0.
Tipo sem mapeamento visual aparece na legenda; coexistência (`extraCodes`) aparece como pontos + texto acessível.

## Diferenças
- **Panorâmico**: capa editorial, matriz 12 × 31 com total mensal, legenda/feriados laterais, períodos,
  conselhos e assinaturas no rodapé, faixa de identidade.
- **Mosaico**: capa editorial, 12 cartões 4 × 3 com semana D S T Q Q S S, rodapé com legenda, períodos,
  feriados e conselhos; totais mensais opcionais, total anual sempre visível.

## Personalização (só aparência)
Editor "Personalizar modelo externo" (`calendar-external-panel.tsx`): imagem do topo (foco, véu), imagem do
rodapé, 6 cores, fontes de título/corpo (lista fechada), título/subtítulo/slogan/rodapé, logos (adicionar,
substituir, ocultar, reordenar, tamanho, posição), blocos opcionais, link/QR (só `https`, nunca inventado),
raio/sombra/borda/densidade dentro de limites, cores visuais por símbolo (código/efeito canônicos) e
"Restaurar padrão". `sanitizeProfile` devolve o padrão para qualquer campo inválido.
Sem imagem, a capa usa gradiente azul/branco com ondas abstratas; nenhuma imagem de terceiros é embutida.

## Persistência
Migrations 0201 (aposentada: `calendar_id` uuid, tabela vazia marcada DEPRECATED) e 0202:
- `calendar_external_profile_revisions` — append-only (`forbid_mutation`), por `calendar_id + template_code`,
  revisão, base, digest sha256, conta e atuação que gravou. Sem grants para `anon`/`authenticated`.
- `record_calendar_external_profile` — SECURITY DEFINER, `search_path=''`, exige
  `construir-calendario-da-rede` em escopo de rede (mesma autoridade do calendário), base esperada = cabeça,
  valida modelo, tamanho do perfil (≤ 4 MB) e cada imagem (PNG/JPEG/WEBP em data URL, ≤ 1,5 MB codificada).
- `calendar_external_profile_at(calendar, modelo, on, knownAt)` — construção lê sempre; demais autenticados
  só se alguma versão do calendário estiver homologada na data; sem revisão ⇒ `padrao`.
Gravar perfil não cria versão acadêmica, não toca homologação nem conteúdo. Nenhum bucket público;
`calendar-image-assets.ts` (laboratório) não foi promovido. Não usa localStorage.

## Impressão
Cada externo tem renderer próprio e CSS isolado em `.cx-*`; o portal reaproveita a raiz `.cd-print-root`
(regra de impressão existente) com folha `.cx-a4` 297 × 210 mm. Só um portal é montado por vez (o do modelo
escolhido). O excesso é medido na tela e avisado; nunca há corte nem redução automática.
Medição com ano completo representativo: panorâmico e mosaico ≤ 198 mm de altura útil, PDF de 1 página A4.

## Segurança e provas
- `src/features/calendar/calendar-external.test.tsx` — 14 testes (interno inalterado, mesmos dias/totais,
  null ≠ 0, tipo sem mapa, coexistência, bissexto/1º dia, meses < 31, personalização sem efeito no conteúdo,
  sanitização, contrato, acessibilidade do seletor e das células).
- `scripts/cal-ext-1-acl.ts` — contas Auth reais temporárias (camada 0194): professor recusado; autoridade
  recebe recusas de base obsoleta, modelo, SVG e imagem grande; DML/SELECT direto recusados; nenhum bucket
  público; zero gravação; fixtures removidas.
- `supabase/tests/cal_ext_1_external_profiles.sql` — caminho positivo (revisões 1→2, leitura) em transação
  revertida, para execução pelo owner das funções.
- Limitação de verificação: o caminho positivo de gravação não foi executado no banco real porque a tabela
  é imutável e deixaria resíduo; o sandbox não tem permissão para rodar o SQL revertido.

## Extensão futura
Novo modelo = novo código no registry + renderer consumindo `ExternalViewModel` + código aceito pelo CHECK
do writer (migration aditiva). Nunca acrescentar cálculo ao view-model.

## CAL.EXT.1.1 — correções da auditoria independente (2026-10-06)

1. **Conselhos de Classe**: a folha externa NÃO deriva conselhos do catálogo/sigla/nome/`councilRole`. Usa
   `readCouncilConfiguration({versionId,on,knownAt})` (contrato `b4.6.7f/1`) cruzada com as declarações de
   `calendar_days_at` da MESMA versão (`row.versionId` = versão impressa, `row.dayTypeId` ∈ papéis declarados).
   Sem alocação de estudante. Estados explícitos: não lida, acesso negado, malformada, **não configurada**
   ("Conselhos de Classe não configurados para esta versão"), **nenhum declarado** (`declaresNone`), configurada.
   Implementação: `councilsOf` em `calendar-external-model.ts`.
2. **QR real**: `calendar-external-qr.tsx` gera SVG local e determinístico (`qrcode-generator`, MIT, sem rede,
   correção M, zona de silêncio 4). Só URL https validada por `safeQrUrl`; a URL aparece em texto ao lado e no
   `aria-label`. Mesmo SVG na prévia e na impressão.
3. **Identidade herdada**: `defaultProfile(template, presentation)` herda `document.headerLines` (renderizadas
   na capa, bloco opcional `cabecalho`) e as logos de `logosOf(document.layout)` como referências (`ref` = id da
   logo, nunca nome de arquivo), desenhadas pelo mesmo `LogoItem` do interno. O externo pode ocultar, reordenar,
   reposicionar, substituir (imagem própria, "Voltar à herdada") ou adicionar logos — só no perfil externo.
   "Restaurar padrão" = identidade herdada + padrão artístico. Logo herdada não encontrada ou sem imagem
   resolvível aparece como aviso no editor. O snapshot institucional nunca é alterado (teste de isolamento).
4. **Prova positiva do writer**: `supabase/tests/cal_ext_1_external_profiles.sql` — numa transação: UUID
   sintético `00000000-ca1e-4e11-8000-0000000c4e11`, pessoa órgão "TESTE SINTÉTICO CAL.EXT.1.1", vínculo,
   atuação do tipo existente `autoridade-calendario-da-rede` (rede) e designação só com
   `construir-calendario-da-rede` (nenhuma policy/regra/capability nova). Claims só via `set_config(..., true)`.
   Prova: sem sessão/sem capacidade recusados; revisão 1 → leitura → revisão 2 → leitura; autoria = UUID e
   atuação sintéticos; base obsoleta, head nulo, template inválido, SVG, asset aninhado não-imagem e asset
   > limite recusados; UPDATE/DELETE recusados; versões/homologações/dias/snapshots inalterados; nenhum bucket
   público; tabela 0201 vazia e sem grants de app. `ROLLBACK`, e depois bloco que prova zero resíduo.
   Execução: `psql -v ON_ERROR_STOP=1 -f supabase/tests/cal_ext_1_external_profiles.sql` como owner.
   **Executado em 2026-10-06** pela ferramenta SQL privilegiada do Lovable Cloud (bloco completo sem falhas, e
   repetição curta terminada em exceção-marcador `CAL_EXT_11_EXECUTADO rev1=1 rev2=2 leitura=lido rev=2`, que
   reverte tudo). Após: 0 vínculos/pessoas/revisões sintéticas, 1 designação, 2 atuações (reais).
   A conta `sandbox_exec` não executa o writer (esperado).
5. **Migrations**: 0201 e 0202 não reescritas; nenhuma 0203 foi necessária. 0201 continua vazia e sem grants de app.
6. **Assets**: mantido o desenho de data URL dentro do perfil, porque: só PNG/JPEG/WEBP por regex no writer
   (qualquer string `data:` em qualquer profundidade do JSON é validada); ≤ 1.572.864 caracteres por asset;
   perfil ≤ 4 MB; `profile_digest` SHA-256 do perfil inteiro (cobre cada asset embutido) guardado na revisão
   imutável e devolvido pelo leitor; nenhuma tabela/bucket público, leitura só pelo leitor DEFINER autenticado
   (autoridade de construção ou calendário homologado). Sem localStorage.
