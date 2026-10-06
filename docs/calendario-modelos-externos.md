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

## CAL.EXT.1.2 — Modelos visíveis no fluxo principal da Supervisão

**Causa raiz (confirmada):** `CalendarSessionBoundary` (`institutional-calendar-routes.tsx`) leva a conta com `construir-calendario-da-rede` às telas originais `CalendarListPage`/`CalendarWorkspacePage`. Os modelos CAL.EXT.1 existiam só em `PrintVersion`, dentro de `InstitutionalCalendarManagement`, que fica fora desse fluxo (painel aberto apenas por `#publicar`). Ou seja, os modelos estavam implementados, mas o caminho normal não chegava até eles.

**Correção:** `CalendarWorkspacePage` agora mostra a seção recolhível **"Apresentação e impressão (Interno · Panorâmico · Mosaico)"** quando o calendário aberto tem vínculo central (`entry.calendarId`, o mesmo vínculo já usado em salvar/homologar, nunca inferido). A seção monta `CalendarPresentationAccess`, que lê a versão institucional (homologada; senão a última) por `readCalendarList`/`readPresentation` e reaproveita **o mesmo** `PrintVersion` → `TemplateSelector` / folha interna / `ExternalPresentationPanel`. Não existe segunda implementação, cópia de datas nem localStorage.
- `PrintVersion` aceita `autoLoad` (carrega as declarações ao abrir; padrão `false`, então a gestão institucional mantém o comportamento) e `canEdit`.
- `ExternalPresentationPanel.canEdit` (padrão `true`) esconde "Personalizar" para contas de consulta; o writer continua revalidado no banco. Nenhuma RLS/capability foi alterada.
- Interno continua o padrão e o renderer interno não foi alterado.

**Caminho:** `/calendario-escolar` → **Abrir** → **Apresentação e impressão** → **Panorâmico** ou **Mosaico** (2 cliques).

**Teste:** `src/features/calendar/calendar-presentation-access.test.tsx` (seletor visível, Interno padrão, Supervisão com Personalizar, consulta sem writer, seção montada na tela aberta por "Abrir").

## BU.CAL.2 — Correção definitiva da prévia/impressão (2026-10-06)

**Causa raiz.** Os snapshots reais de apresentação (`calendar_version_presentation_snapshots`, 7 versões) gravaram `typeMap` como `código → versão do tipo` (ex.: `FERIADO → <uuid>`, mais entradas `period:*`), enquanto `buildPrintModel` lê `versão do tipo → código`. Nenhuma declaração encontrava símbolo: toda a legenda virava "Tipo sem mapeamento visual", células sem cor, feriados vazios (dependem do `kind` do código). Os totais nunca foram afetados (vêm do efeito das declarações).

**Correção (só apresentação).** `calendar-visual-resolver.ts` é o resolvedor visual único: `canonicalTypeMap` normaliza as duas direções por identidade (código existente no catálogo do próprio snapshot ↔ id da versão do tipo; nunca rótulo; entradas que não são tipo ignoradas); `resolveVisual` dá o token (sigla, cor, rótulo, `known`); `catalogCoverage` prova cobertura. O painel externo reconstrói o `PrintModel` com os MESMOS dias/períodos e a apresentação normalizada. Snapshot gravado, conteúdo 2027 e modelo interno não foram alterados. Tipo realmente desconhecido gera alerta na prévia e marcador "!" na célula, nunca "?" silencioso.

**Layouts (conforme descrição do usuário).** Panorâmico = 12 mini-calendários 4×3 + rodapé (legenda, períodos, feriados, conselhos) + assinaturas. Mosaico = matriz Mês × Dia 1–31 com total por mês, lateral (legenda, feriados) e rodapé (períodos, conselhos, assinaturas). Fins de semana sem declaração em cinza.

**Tipos mapeados (catálogo do snapshot):** CC, CF, FL, PF, PP, FDS, CENSO, VAZIO, FERIAS, INICIO, MESTRE, FERIADO, RECESSO, RETORNO, TERMINO, ENCONTRO — 16/16 com token conhecido.

**Impressão.** `@page A4 landscape; margin 0`; `.cx-a4` 297×209 mm com padding 6 mm; `.cx-folha` com geometria física fixa 285×197 mm (tela 285×198) em flex: corpo `flex:1` distribui linhas das tabelas; rodapé/assinaturas `flex:none` e `break-inside: avoid`. Sem `transform: scale`. A prévia mede `scrollHeight − clientHeight` e avisa excesso (nada é reduzido automaticamente).

**Evidências.** Fixture rica (`calendar-external-rich-fixture.ts`: ano 2027 inteiro da referência, typeMap na forma real): Chromium `page.pdf` → Panorâmico 1 página, Mosaico 1 página, overflow 0/0 px; 365 células coloridas, 0 "?", 0 "sem mapeamento"; total 200 dias letivos igual ao modelo bruto; 12 feriados; períodos e conselhos preenchidos. Teste `calendar-external-bucal2.test.tsx` (4) + suíte do calendário 386/386.

## Validação real 2027 (Lote 3)

Fluxo real: conta `supervisao@` (principal institucional, sessão pelo mecanismo seguro de teste) → Calendário escolar → Abrir → Apresentação e impressão → Interno / Panorâmico / Mosaico. Sem fixture como prova final.

| Calendário (id) | Versão homologada | Total letivo (Interno = externos) | Períodos | PDF Panorâmico | PDF Mosaico |
|---|---|---|---|---|---|
| `cal-rede-2027-eja` — EJA / Curso Semestral | v3 | 200 | 4 (52 + 48 + 49 + 51) | 1 página A4 paisagem | 1 página A4 paisagem |
| `cal-rede-2027-eja-fase-1` — EJA Fase I / Anual | v2 | 200 | 3 (67 + 67 + 66) | 1 página | 1 página |
| `cal-rede-2027-regular` — Ensino Regular / Anual | v2 | 200 | 3 (67 + 67 + 66) | 1 página | 1 página |

Todos os PDFs: 841.92 × 594.96 pt (297 × 210 mm). Inspeção visual das 6 páginas renderizadas: 365 dias, cores/siglas do catálogo, legenda, feriados (14), períodos, conselhos (configuração da versão), assinaturas, brasões/logos herdados como imagem, faixa de marca; sem "?", sem "Tipo sem mapeamento", sem texto sobreposto. Interno continua padrão; "Personalizar modelo externo" só aparece para a Supervisão.

Defeitos encontrados no uso real e causa-raiz (correções gerais, nenhuma por calendário):
1. Interno e externos mostravam "?" e "Tipos sem símbolo vinculado" — o modelo de impressão comum lia o vínculo tipo↔símbolo só numa direção; os snapshots reais gravam a outra. `buildPrintModel` agora usa `canonicalTypeMap` (identidade pelo catálogo do snapshot). Fatos dos dias não mudam.
2. PDF saía com 2 páginas — a folha da tela de edição também era impressa. A folha externa escolhida marca `cx-print-ativo` e é a única impressa.
3. "Períodos letivos" vazio — contas de setor não liam ano/organização/períodos (políticas exigiam pessoa) e a leitura usava a data de hoje (antes do início de 2027). Migrations 0208/0209 (leitura para principal institucional, mesma amplitude da leitura humana vinculada) e leitura na vigência da própria versão.
4. Subtítulo encostava nas ondas da capa; sigla longa ("MESTRE") invadia a célula vizinha; chip "CF T" da legenda estourava. CSS geral `.cx-*`.

Testes: `calendar-external-bucal2.test.tsx` (paridade dia a dia Interno × externo), suíte do calendário, prova em navegador real (`/tmp`, fora do repositório).
