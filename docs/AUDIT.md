# AUDIT — Varejão Popular

> Registro contínuo de auditoria. Atualizar este arquivo a cada etapa, indicando arquivos lidos, achados comprovados, correções, testes, PR e pendências. Não confundir revisão estática com teste real em produção.

## 0. Ponto de restauração

- Data de início: 2026-10-02.
- Repositório: Juliano-Belasqem/varejao-popular-app.
- Branch de backup de código: `backup/pre-audit-2026-10-02`.
- Commit imutável de referência (não mover a branch): `2fe48e260eb4a692394d7b10fe4b6621af8fc58b` (main após PR #80).
- Recuperação: comparar a main com a referência; criar uma branch nova a partir do SHA para restaurar seletivamente ou integralmente, mediante aprovação.
- **Limite**: backup Git não inclui banco de dados, Storage do Supabase, variáveis de ambiente, tokens, Vercel ou arquivos locais. Antes de mudanças de dados, criar e testar backups próprios desses serviços.

## 1. Objetivos e critérios de conclusão

1. Inventariar todos os arquivos versionados e suas responsabilidades.
2. Inspecionar por lotes pequenos, registrando os arquivos efetivamente revisados.
3. Corrigir defeitos verificáveis, preferencialmente em PRs independentes, com testes de regressão.
4. Priorizar integridade de dados, autorização, salvamento, impressão/exportação e usabilidade operacional.
5. Executar testes, typecheck, build e navegador quando aplicável; não declarar produção validada apenas por CI.
6. Preservar compatibilidade de templates e migrações existentes.

**Estados:** INVENTARIADO (listado, não revisado); EM ANÁLISE; REVISADO; CORRIGIDO (PR/commit); VALIDADO (evidência); PENDENTE (motivo).

## 2. Scan estrutural inicial (main, 2026-10-02)

149 arquivos versionados, conforme árvore Git recursiva. Tecnologias: Next.js 16 / React 19 / TypeScript, Supabase (auth, banco, storage), PDF.js, Playwright, GitHub Actions, Vercel.

- `app/api/`: 12 rotas (kit da marca, materiais digitais, composição, imagens, publicações, templates e ativos visuais).
- `app/app/`: campanhas e geração digital/física, conteúdo de redes, editor visual, hortifrutti, ofertas, produtos, publicações, usuários e validade próxima.
- `components/`: editor e renderizador de templates, editor visual, navegação e auxiliares.
- `lib/`: autenticação, Supabase, templates, marca, imagens remotas, mídia, publicação e motor visual.
- `supabase/migrations/`: esquema e alterações incrementais; revisar ordem e efeitos antes de qualquer alteração.
- `tests/`: testes unitários, banco, editor visual e scripts de navegador.
- `public/`, `scripts/`, `docs/`, configuração e CI.

### Etapas de inspeção (manter lotes pequenos)

| Etapa | Escopo / arquivos a ler | Objetivo | Estado |
|---|---|---|---|
| 01 | `lib/template-config.ts`, `components/template-editor.tsx`, `components/configured-ticket.tsx`, `lib/use-template.ts`, `app/api/templates/route.ts`, `tests/config.test.ts` | Validação, compatibilidade, salvamento e prévia | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 02 | `app/app/validade-proxima/**`, `app/app/modelos-hortifrutti/**`, `app/app/campanhas/[id]/fisico/**`, CSS e migrações correlatas | PDF, recortes, códigos, preços e impressão A4 | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 03 | `app/app/campanhas/**`, `app/app/ofertas/**`, `app/app/produtos/**`, APIs de imagem, `lib/money.ts` | Consistência de catálogo, campanhas, preço e ativos | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 04 | `app/app/campanhas/[id]/gerar/**`, `app/app/conteudo-redes/**`, `lib/media/**`, `app/api/digital-materials/**` | Preview, fontes, exportação e código legado | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 05 | `components/visual-*`, `app/app/editor-visual/**`, `lib/visual-*`, `tests/visual-*` | Operações, persistência e renderização do editor visual | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 06 | `app/app/publicacoes/**`, `app/api/publications/**`, `lib/publications/**`, `lib/meta/**` | Publicação, agendamento, idempotência e auditoria | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 07 | `lib/auth.ts`, `lib/supabase/**`, `proxy.ts`, `app/api/**` restante, `app/app/usuarios/**`, migrações SQL | Autorização, RLS, uploads e integridade | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |
| 08 | `app/app/layout.tsx`, `components/sidebar.tsx`, `app/globals.css`, login, dashboard, configuração, README e demais testes | UX, acessibilidade, CI, documentação e homologação | REVISÃO ESTÁTICA INICIAL CONCLUÍDA; homologação pendente |

**Procedimento para continuidade entre chats:** ler este AUDIT primeiro; selecionar apenas a próxima etapa PENDENTE; registrar os arquivos e intervalos revisados, achados com reprodução, commits e resultados; não repetir o scan completo se a árvore não mudou. Comparar com o SHA de backup para detectar novos arquivos.

## 3. Registro de achados

| ID | Etapa | Arquivo | Achado / risco | Severidade | Situação |
|---|---|---|---|---|---|
| A-001 | 01 | `lib/template-config.ts` | Validação de números opcionais compara intervalos, mas NaN pode atravessar comparações (ex.: opacity, rotation, strokeWidth); proteger todos os parâmetros numéricos opcionais. | P1 | CORRIGIDO nesta branch; testes adicionados, CI aprovado no commit 980f940; integração pendente |
| A-002 | 01 | `app/api/templates/route.ts` | Controle otimista por revision e remoção de upload não confirmado já presentes; testar conflito concorrente em integração. | P2 | PENDENTE teste |
| A-006 | 01 | `app/api/templates/route.ts` | GET não capturava erro de validação de layout persistido, resultando em erro interno sem orientação. | P1 | CORRIGIDO nesta branch; CI aprovado no commit 980f940; integração pendente |
| A-007 | 01 | `tests/config.test.ts` | Não havia regressão explícita para exceção de tamanho de fonte física (1000) versus digital (500). | P2 | CORRIGIDO nesta branch; CI aprovado no commit 980f940; integração pendente |
| A-010 | 03 | `app/app/produtos/actions.ts` | Cadastro manual fixava `gtin_valid: true` para qualquer código, inclusive não GTIN. | P1 | CORRIGIDO nesta branch; CI aprovado no commit 980f940; integração pendente |
| A-011 | 03 | `app/app/campanhas/actions.ts` | Criação e edição de campanha não impediam intervalo de datas invertido. | P1 | CORRIGIDO nesta branch; CI aprovado no commit 980f940; integração pendente |
| A-012 | 03 | `app/app/produtos/actions.ts`, `app/app/produtos/page.tsx` | Importação ERP fazia upsert em lotes e depois excluía todos os registros anteriores a `syncStarted`, expondo a base a perdas por arquivo parcial. | P0 | CORRIGIDO: importação não destrutiva, aviso de lotes parciais e interface alinhada; CI aprovado no commit 980f940; integração pendente |
| A-009 | 02 | `app/app/modelos-hortifrutti/actions.ts` | Substituição/remoção de PDF podia apagar imediatamente a versão anterior e não protegia contra duas edições simultâneas. | P1 | CORRIGIDO nesta branch; CI aprovado no commit 980f940; integração pendente e teste de concorrência |
| A-008 | 02 | `validity-flyer-generator.tsx`, `campaign-physical-generator.tsx` | Implementações EAN-13 duplicadas; risco de divergência entre módulos. Reutilizar algoritmo já presente em `lib/visual-barcode.ts`, mantendo exigência de 13 dígitos nos geradores físicos. | P2 | CORRIGIDO nesta branch; CI aprovado no commit 980f940; integração pendente e teste de scanner |
| A-003 | 02 | `app/app/modelos-hortifrutti/produce-template-generator.tsx` | Recorte 2×2 assume quadrantes iguais; arquivos com margens/gutters exigem seleção de área ajustável. | P2 | PENDENTE verificação com PDF real |
| A-004 | 04 | `app/app/campanhas/[id]/gerar/page.tsx` | Gerador legado ainda coexistente com oficial; mapear diferenças antes de remoção. | P2 | PENDENTE |
| A-005 | 08 | `.github/workflows/ci.yml` | CI possui testes unitários, typecheck, build e navegador do editor visual; falta cobertura dedicada de exportação física A4. | P1 | PENDENTE |
| A-013 | 06 | `lib/meta/publisher.ts` | Meta podia confirmar publicação e a gravação local falhar sem verificação, possibilitando repetição remota ao marcar erro. | P0 | CORRIGIDO: erro de conciliação mantém publishing, exige conferência manual; CI aprovado no commit 980f940; integração pendente |
| A-014 | 07 | `app/api/product-art-composition/route.ts` | PUT exigia apenas login, não papel de edição. | P1 | CORRIGIDO: requireProfile + canEdit; CI aprovado no commit 980f940; integração pendente |
| A-015 | 07 | `app/api/openai/generate-social-image/route.ts` | Endpoint de geração paga não verificava autenticação/permissão. | P0 | CORRIGIDO: requireProfile + canEdit antes de API externa; CI aprovado no commit 980f940; integração pendente |
| A-016 | 07 | `lib/remote-image.ts` | URLs são checadas via DNS antes de fetch, mas resolução do fetch pode diferir (janela de DNS rebinding). | P1 | PENDENTE: fixação de IP/egress control em infraestrutura |
| A-017 | 06 | `lib/meta/publisher.ts` | Uma resposta de sucesso remoto com erro de confirmação local exige conciliação humana; ausência de workflow automático de reconciliação. | P1 | PENDENTE: projetar reconciliação por IDs da Meta, sem republicação |
| A-019 | 03 | `app/app/produtos/actions.ts` | Importação de arquivo sem colunas opcionais pode atualizar campos existentes para `null`/`false` via upsert (ex.: preço, estoque, unidade e pesquisar imagem). | P1 | CORRIGIDO de forma conservadora: planilhas com cabeçalho incompleto e CSV sem cabeçalho são recusados antes do upsert; aguarda CI e homologação com exportação ERP completa |\n| A-020 | 03 | `app/app/produtos/actions.ts` | Linhas parcialmente preenchidas eram ignoradas silenciosamente e códigos duplicados eram sobrescritos dentro do Map antes da gravação. | P1 | CORRIGIDO: rejeita linha sem código/descrição e código duplicado na pré-validação, antes de qualquer lote; CI pendente |\n| A-021 | 03 | `app/app/produtos/actions.ts` | Valores não numéricos preenchidos em preço/estoque eram normalizados para `null`, podendo apagar números existentes via upsert. | P1 | CORRIGIDO: rejeição na pré-validação antes dos lotes; CI pendente |\n| A-022 | 03 | `app/app/produtos/actions.ts` | Conteúdo desconhecido em colunas booleanas GTIN válido/pesquisar imagem era interpretado como `false` ou `null` e sobrescrevia cadastro. | P1 | CORRIGIDO: valida vocabulário Sim/Não antes do upsert; CI pendente |\n| A-018 | 08 | `app/globals.css` | Regras de impressão de código de barras duplicadas, uma `height:100%!important` e outra `height:auto!important`; a última prevalece, comportamento frágil. | P2 | PENDENTE: teste visual A4 antes de consolidar |

## 4. Diário de execução

### 2026-10-02 — preparação e etapa 01
- Backup de código criado no SHA indicado acima.
- Inventário da árvore completo: 149 arquivos; classificação por domínio.
- Lidos inicialmente: `.github/workflows/ci.yml`, `package.json`, `README.md`, `lib/use-template.ts`, `app/api/templates/route.ts`, `lib/auth.ts`, `app/app/page.tsx`, `app/app/campanhas/[id]/gerar/page.tsx`; amostras e/ou conteúdo de `lib/template-config.ts`, `components/template-editor.tsx`, `components/configured-ticket.tsx`, `tests/config.test.ts`, `app/app/modelos-hortifrutti/produce-template-generator.tsx`, `app/api/digital-materials/route.ts`, `app/api/visual-assets/route.ts`, `app/app/campanhas/[id]/gerar/official-template-generator.tsx`.
- Revisão de segurança funcional iniciada: A-001 identificado e corrigido em `lib/template-config.ts`; teste de regressão em `tests/config.test.ts` cobrindo NaN e Infinity em 19 propriedades numéricas opcionais.
- A-006: o GET agora devolve resposta 503 explicativa para layout persistido inválido, sem divulgar detalhes internos.
- A-007: testes de regressão adicionados para limite de fonte física (1000) e digital (500).
- Revisão integral nesta etapa: `lib/use-template.ts`, `app/api/templates/route.ts`, `components/configured-ticket.tsx`, `lib/template-config.ts`, `tests/config.test.ts`; revisão focal de `components/template-editor.tsx` (carregamento, salvamento, upload e movimentação).
- Próximas verificações da etapa 01: testar conflito concorrente da API em ambiente isolado e confirmar UX de alterações não salvas; registrar testes de CI após conclusão.
- Nenhum deploy de produção ou teste contra banco real foi realizado nesta etapa.

## 5. Backlog de homologação manual

- Criar/editar/salvar/recarregar template e tentar salvar versão antiga em duas abas.
- Gerar e imprimir 1 e 4 itens (validade, físico, hortifrutti) com nomes/preços extremos.
- Confirmar leitura de EAN-13 em scanner real, PDF exportado e impressora utilizada pela loja.
- Verificar recorte do PDF de hortifrutti com arte real.
- Gerar feed/story com fontes da marca e comparar prévia/exportação.
- Validar usuários admin/editor/viewer, armazenamento privado e fluxos de publicações em ambiente seguro.
- Verificar backup/restauração real do Supabase antes de qualquer migração operacional.

### 2026-10-02 — início da etapa 02
- Inspecionados: `app/app/validade-proxima/validity-flyer-generator.tsx`, `app/app/modelos-hortifrutti/actions.ts`, `app/app/modelos-hortifrutti/produce-template-generator.tsx`, `app/app/campanhas/[id]/fisico/campaign-physical-generator.tsx` (pontos de código de barras, PDF, preço e impressão).
- A-008: Validade Próxima e Campanha Física passaram a usar o codificador compartilhado `lib/visual-barcode.ts` (já existente). A interface continua exigindo EAN-13 completo com 13 dígitos, sem aceitar automaticamente 12. `tests/barcode.test.ts` verifica comprimento de 95 módulos, guardas, checksum e entradas inválidas.
- Inspeção visual real de A4 e leitura por scanner permanecem pendentes; não são demonstráveis por revisão estática.

### 2026-10-02 — etapa 02, proteção do acervo PDF
- Revisão integral de `app/app/modelos-hortifrutti/actions.ts` e `app/app/modelos-hortifrutti/produce-template-generator.tsx`; revisão focal de `app/globals.css` e do gerador físico.
- A-009: troca/remoção de PDF usa condição otimista sobre o `pdf_path` anteriormente lido; se outra sessão já alterou o modelo, a operação falha com mensagem de recarregamento. O arquivo recém-enviado sem confirmação é removido; os arquivos anteriormente associados permanecem no Storage para recuperação. Não executar limpeza automática de órfãos sem política de retenção e backup.
- Pendente: teste integrado com duas sessões Supabase e impressão real; sem acesso a dados de produção nesta revisão.

### 2026-10-02 — início da etapa 03
- Revisão integral: `app/app/ofertas/actions.ts`, `app/app/produtos/actions.ts`, `app/app/campanhas/actions.ts`, `lib/money.ts`, `app/api/visual-assets/route.ts`.
- A-010: cadastro manual agora exige código numérico de 4–14 dígitos e calcula `gtin_valid` pelo dígito verificador; códigos internos de 4–14 dígitos continuam permitidos e recebem `gtin_valid=false` quando não são GTIN válido.
- A-011: intervalo de datas invertido rejeitado na criação e atualização de campanha; ofertas já tinham essa proteção.
- A-012: removida a exclusão automática de códigos não presentes no arquivo. Importação passa a ser aditiva/atualizadora; `last_seen_at` mantém rastreio dos registros importados. Em falha de lote, mensagem informa quantos itens já foram salvos (upsert não é transação global). Interface agora explica a preservação de produtos ausentes. Homologar importação completa e parcial em ambiente de teste antes de uso operacional; política futura de inativação/limpeza deve exigir confirmação e backup. Nenhum dado real foi alterado nesta auditoria.

### 2026-10-02 — etapa 03, correção de risco P0
- Revisados `app/app/produtos/page.tsx` e novamente `app/app/produtos/actions.ts` nos trechos de importação, deduplicação por código, upsert em lotes e exclusão por `last_seen_at`.
- A-012 corrigido de forma conservadora: nenhum item ERP é excluído por ausência em um arquivo importado. A rotina continua em lotes de 250; falhas informam quantos registros foram efetivamente persistidos, sem prometer rollback. A tela foi atualizada para refletir essa semântica.
- Pendente: testes de integração com exportação completa, parcial e falha simulada entre lotes; desenhar futura função separada de arquivamento de registros obsoletos, com confirmação e possibilidade de restauração.

### 2026-10-02 — varredura transversal das etapas 04–08
- **04 / digital:** inspecionados `app/app/campanhas/[id]/gerar/official-template-generator.tsx`, `page.tsx`, `app/api/digital-materials/route.ts`, `lib/media/canvas-renderer.ts`, `lib/remote-image.ts`, `lib/visual-export.ts`. Gerador legado segue listado como A-004: remover apenas após paridade visual/exportação confirmada.
- **05 / editor visual:** inspecionados `lib/visual-engine.ts`, `lib/visual-operations.ts`, `lib/visual-export.ts`, `components/visual-engine-editor.tsx` (pontos de persistência, erros, exportação), `components/visual-properties.tsx`, `components/visual-renderer.tsx`, `tests/visual-operations.test.ts`, `tests/visual-database.test.ts` e `app/app/editor-visual/page.tsx`. Há testes unitários e de navegador; falta homologação de manipulação/exportação com fontes e imagens reais.
- **06 / publicações:** inspecionados `app/api/publication-drafts/route.ts`, `app/api/publications/process/route.ts`, `app/app/publicacoes/actions.ts`, `lib/meta/publisher.ts`, `lib/publications/validation.ts`. A-013 corrigido: confirmação remota não pode voltar a status de erro/republicação automática se o update local falhar; manter status publishing para conciliação manual e registrar ID remoto no log do servidor. A-017 permanece.
- **07 / acesso e segurança:** inspecionados `lib/auth.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `app/api/product-image/[productId]/route.ts`, `app/api/product-art-composition/route.ts`, `app/api/brand-kit/route.ts`, `app/api/openai/generate-social-image/route.ts`, `supabase/migrations/0002_security_hardening.sql`, `supabase/migrations/20261001112000_produce_pdf_templates.sql`. A-014 e A-015 corrigidos. A-016 requer medida de infraestrutura, não apenas checagem de URL.
- **08 / interface e qualidade:** inspecionados `app/app/layout.tsx`, `components/sidebar.tsx`, `app/globals.css` (regras de impressão), `.github/workflows/ci.yml`, `tests/browser-check.mjs`, `package.json`. A-018 e cobertura A4 ficam no backlog de homologação.
- **Importante:** estas oito etapas receberam scan estrutural e revisão estática focal. Não equivale a inspeção linha a linha dos 149 arquivos nem a homologação de produção. Manter pendências explícitas, não rotular projeto como integralmente validado.

### 2026-10-02 — CI e reforço de confirmação Meta
- Commit `010a0bb4fff70490422c8fe13adb80afb0add2a8`: workflow CI concluído com sucesso no GitHub. Commits posteriores exigem nova execução; não reutilizar resultado anterior como validação do HEAD.
- A-013 reforçado: a confirmação local exige linha efetivamente atualizada com status anterior `publishing` (`select("id").maybeSingle()`), além de ausência de erro do banco. Uma atualização que afetou zero linhas também exige conciliação manual, sem transformar a publicação remota em falha republicável.
- **Critério de merge:** CI verde no HEAD definitivo, revisão das pendências críticas, sem alegar homologação de produção. Merge não executado, conforme combinado.

### 2026-10-02 — evidência da suíte de regressão
- GitHub Actions: [run 37015099562](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37015099562), commit `980f940b34b6490fc4f6eca28c23a09a09e90492`, conclusão `success`.
- Job `Typecheck and build` (ID 110864377493): `Regression tests`, `Typecheck`, `Production build`, `Install browser for visual editor tests`, `Visual editor end-to-end (local fixtures)` e `Save browser verification artifacts`: todos concluídos com `success`.
- Escopo: testes automatizados e navegador com fixtures locais; **não** inclui importação ERP contra Supabase operacional, duas sessões concorrentes, Meta real, impressão A4/scanner ou homologação com usuários.
- Matriz de aceite manual: (1) ERP completo/parcial/falha de lote sem apagar ausentes; (2) edição concorrente de template e PDF; (3) validade, hortifrutti e campanha física impressos em A4, EAN lido em scanner; (4) composição visual e exportação com fontes/imagens reais; (5) permissões de visualizador versus editor; (6) Meta: publicação remota confirmada + falha de update local exige conciliação e nunca republicação automática.
- Decisão: não fazer merge nem deploy como se homologação operacional estivesse concluída. Backup Git original preservado; backup de banco/Storage é etapa separada antes de intervenções nesses dados.

### 2026-10-02 — confirmação da regressão no HEAD e cobertura efetiva do navegador
- GitHub Actions: [run 37019850655](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37019850655), commit `1fe4153de86795b40dfc3a403d90357ace7cb448`, conclusão `success`. Job: testes de regressão, typecheck, build e navegador com fixtures locais aprovados. Artefato `visual-editor-verification` gerado (capturas de tela e PNG exportado).
- Leitura de `tests/browser-check.mjs` confirmou os cenários automatizados: prévia de validade; salvar layout e conferir após reload; render Feed 1080×1080; Story 1080×1920 e download PNG; mídia de publicações sem sobreposição em viewport 1280/390; ausência de erros de runtime no navegador. Estes são testes com fixtures, não provas de impressão ou dados operacionais.
- A-019 identificado na revisão de importação: preservar registros ausentes (A-012) não significa preservar atributos ausentes das linhas presentes. Se o arquivo não contiver preço/estoque/unidade, o mapeamento atual grava valores nulos em upsert; `search_image` assume false. Exigir formato completo até corrigir a semântica de atualização seletiva.

### 2026-10-03 — A-019: contrato de importação seguro
- Antes do primeiro upsert, arquivos com cabeçalho precisam conter: código, descrição, preço, estoque, unidade, tipo de código, GTIN válido e pesquisar imagem. Caso falte qualquer uma das seis colunas complementares, a rotina informa os nomes ausentes e não grava lotes.
- CSV sem cabeçalho temporariamente recusado: seu formato legado não inclui tipo de código, GTIN válido e pesquisar imagem; usar o upsert anterior poderia limpar estes atributos nos registros já existentes. **Mudança de compatibilidade intencional por integridade de dados**. Uma futura importação parcial segura deve atualizar seletivamente apenas colunas presentes, com testes de concorrência.
- Importação com todas as colunas segue aditiva/atualizadora e não exclui produtos ausentes (A-012). Arquivos completos, campos vazios explícitos e falha entre lotes ainda exigem homologação em banco isolado. CI do novo HEAD pendente.

### 2026-10-03 — CI anterior e integridade por linha ERP
- Commit `053763fadc92802b811a99b9d4e8b00f4cb47e99`: [CI 37120667696](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37120667696) concluído com `success`.
- A-020: arquivo com linha contendo somente código ou descrição agora é recusado com número de linha antes do primeiro upsert; duplicatas do mesmo código também são recusadas. Linhas inteiramente vazias permanecem ignoradas. Estes são controles prévios, não transação atômica entre lotes.
- Novos commits após o CI acima exigem nova execução no HEAD. Nenhuma gravação em banco operacional foi realizada.

### 2026-10-03 — CI e pré-validação numérica ERP
- [CI 37121108065](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37121108065), HEAD `b68914a59d1b832a756ad7066d203dba77ba970a`: `success`.
- A-021: preço e estoque preenchidos com texto não numérico ou número não finito passam a gerar erro com linha/campo antes de qualquer upsert; célula vazia permanece `null` intencionalmente para exportações completas. Valores de negócio (preço negativo, estoque negativo) exigem regra operacional explícita antes de impor restrições adicionais.
- Novos commits aguardam CI no HEAD definitivo. Testes com arquivo ERP real devem usar ambiente isolado e cópia de dados, nunca primeira execução direta na produção.

### 2026-10-03 — CI e valores booleanos do ERP
- [CI 37124104822](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37124104822), HEAD `3a459f3ad088aea4b1774eab4ca00a10cd9e9792`: `success`.
- A-022: GTIN válido/pesquisar imagem aceitam células vazias e valores booleanos explícitos `sim/s/true/1/yes/não/nao/n/false/0/no`, sem distinção de caixa; texto não reconhecido provoca erro com linha antes da gravação. Células vazias continuam seguindo o contrato atual de importação completa (GTIN `null`, pesquisar imagem `false`); homologar semântica de vazios com arquivo ERP real.
- Novo HEAD exige CI próprio. PR permanece sem merge.

### 2026-10-03 — publicação Meta: resultado remoto ambíguo
- CI do HEAD anterior `cda9580da194597b7e8c53dd803a06b52c1f7eea`: [run 37124221073](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37124221073) estava em execução na última consulta; não atribuir resultado sem nova confirmação.
- A-013/A-017: a partir do início da chamada remota, uma exceção pode representar resposta perdida após publicação bem-sucedida. O tratamento agora conserva status `publishing` (não elegível a retry automático), registra alerta de conciliação manual em `error_message` quando possível e gera log com ID local. Exceções de pré-validação continuam marcando `error` apenas se a linha ainda estiver em `publishing`.
- Trade-off deliberado: falhas definitivamente remotas também podem ficar em `publishing` até conferência; isto evita duplicação à custa de intervenção manual. Testar com respostas simuladas de sucesso, erro HTTP, timeout e falha no reconhecimento local; sem Meta real nesta etapa. CI do novo HEAD pendente.

### 2026-10-03 — persistência do aviso de conciliação Meta
- O tratamento de resultado remoto ambíguo também verifica o campo `error` retornado pelo Supabase ao tentar registrar `error_message`, além de exceções lançadas; falhas são registradas em log. O status permanece `publishing`, sem nova tentativa automática.
- A alteração não equivale a teste com a Meta real. Antes do merge, simular falha de transporte após envio, erro de reconhecimento local e impossibilidade de persistir o aviso; confirmar que nenhuma dessas condições volta a deixar a publicação elegível ao agendador.

### 2026-10-03 — regressão da política de falhas Meta
- Extraída a decisão de tratamento `publicationFailureDisposition` para `lib/meta/publication-outcome.ts`, utilizada por `lib/meta/publisher.ts` e exercitada em `tests/publication-outcome.test.ts`: falha antes da tentativa remota pode ser retryable; após iniciar a chamada Meta exige conciliação, sem status `error` republicável.
- Cobertura atual é unitária da política, **não** simulação completa de Meta/Supabase. Ainda testar fluxo integrado de erro HTTP, timeout, publicação remota confirmada e falha de atualização local.
- CI do HEAD com os novos testes deve ser verificado antes de aprovar o PR.

### 2026-10-03 — ID remoto para conciliação Meta
- [CI 37124452730](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37124452730), HEAD `0c4f6cfa5273021dabebad99688ea8e6b41f1a58`: `success`, incluindo o teste unitário da política de falhas remotas.
- A-013/A-017: se a Meta retorna `postId`, mas o `update(status=published)` falha, a rotina tenta guardar `postId` em `error_message` com filtro `status=publishing`, mantendo o registro fora da fila automática. Se também falhar esse aviso, registra em log. A mensagem de timeout de processamento de vídeo não recomenda mais republicação automática.
- Pendência: testes de integração com mocks de chamadas Meta e persistência Supabase, conferência de logs operacionais e fluxo administrativo de conciliação. Novo HEAD aguarda CI.

### 2026-10-03 — aviso operacional no detalhe da publicação
- [CI 37124659169](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37124659169), HEAD `8a0740d2c60d362d6c103ced275e38aea9e7f733`: `success`.
- A-017: página `app/app/publicacoes/[id]/page.tsx` agora mostra aviso permanente para `status=publishing` com instrução de conferir a Meta, evitar duplicação e informar o ID local ao administrador. Não depende de `error_message` ter sido persistido. Ações de republicação/reagendamento já são indisponíveis nesse status.
- Ainda não existe ferramenta administrativa de conciliação remota; operação exige conferência humana e procedimento definido. Novo HEAD aguarda CI.

### 2026-10-03 — visibilidade da fila de conciliação Meta
- A-017: `app/app/publicacoes/page.tsx` passa a contar `publishing` separadamente, oferece filtro dedicado e apresenta aviso de não republicação em cada registro. A tela de detalhe já contém ID local e instruções.
- O indicador reúne publicações legitimamente em andamento e publicações cujo resultado é ambíguo; **não** equivale a diagnóstico automático de falha. Conferir horário, histórico e resultado na Meta antes de agir.
- CI do HEAD anterior `a2ef06496890b19348be8109119fa8011da1db72` estava em execução na consulta; resultado final deve ser verificado. CI do novo HEAD pendente.

### 2026-10-03 — exclusão de publicações com concorrência e Storage
- [CI 37124929066](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37124929066), HEAD `5de41b55d7cae85f9b4ea0da722bc3080da64215`: `success`.
- A-023 (P1): exclusão individual e em lote verificavam status em leitura prévia, mas excluíam pais/mídias sem filtro de status na operação final e limpavam Storage mesmo sem confirmação de sucesso. Corrigido com `delete().in("status", ["draft","cancelled","error"]).select("id")`; apenas IDs efetivamente excluídos têm Storage limpo. A FK de `publication_media.publication_id` em `0001_initial.sql` tem `ON DELETE CASCADE`, portanto não se remove mais a mídia relacional antecipadamente.
- Se a exclusão do banco falhar, objetos Storage são retidos. Se a limpeza Storage falhar após exclusão, há log e pode restar órfão para manutenção; exclusão banco+Storage não é transação distribuída. Testar RLS e exclusão em concorrência em ambiente isolado. CI do novo HEAD pendente.

### 2026-10-03 — inventário de mídia obrigatório antes de excluir
- A-023: exclusões individual e em lote agora abortam se a consulta de `publication_media` retornar erro, em vez de excluir o registro pai sem conhecer os caminhos de arquivos a limpar. Falhas registradas no servidor. Continua necessário teste isolado com Supabase/RLS, incluindo falha de Storage posterior à exclusão do banco.

### 2026-10-03 — consultas de elegibilidade fail-closed
- [CI 37125794502](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37125794502), HEAD `ea317ec5c6322223a0b2c129a2e8be3fda3feb71`: `success`.
- A-023: consultas de elegibilidade da exclusão em lote, reenvio de erros em lote e exclusão individual agora verificam `error` explicitamente e registram a falha; nenhuma mutação é iniciada após falha de leitura. Permanece pendente teste integrado de concorrência, permissões/RLS e recuperação de objetos órfãos caso Storage falhe após exclusão no banco.

### 2026-10-03 — cancelamento em lote e falhas do log de auditoria
- A-024 (P2): `bulkPublicationAction` ignorava `error` do cancelamento Supabase e a função auxiliar `audit` ignorava falhas na inserção em `audit_logs`. Agora não registra cancelamento quando o update retorna erro, e falhas da gravação do log são registradas no servidor. A gravação do log continua separada da mutação e não constitui garantia transacional; requer teste RLS e observabilidade operacional.
- CI do novo HEAD deve ser confirmado. A-023 permanece pendente de testes integrados em ambiente isolado.

### 2026-10-03 — remoção individual de mídia
- [CI 37126008094](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37126008094), HEAD `cab4a0e3cadd42c80e90c17dc4ea8ab317337326`: `success`.
- A-025 (P1): `removePublicationMediaAction` apagava o objeto Storage mesmo se a exclusão de `publication_media` falhasse. Agora requer confirmação via `delete().select("id").maybeSingle()` antes de remover Storage, e registra falhas de limpeza. Risco residual: checagem de status da publicação ocorre antes da exclusão da mídia (sem trava transacional); testar corrida com início de publicação e considerar RPC transacional para bloqueio por estado.

### 2026-10-03 — validação de pré-condições e manual Meta
- [CI 37126290195](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37126290195), HEAD `bc2f5c4be9ff667eb6903436f76a60afd1edae7a`: `success`.
- A-026 (P1): `schedulePublicationAction` podia tratar erro de consulta de `publication_media` como lista vazia; agora interrompe em erros da publicação ou da mídia. Escrita de `error_message` após validação negativa também é condicionada a estados editáveis, evitando atualizar `publishing`/`published` após mudança de status.
- A-027 (P2): `addPublicationMediaAction` agora interrompe em erro/contagem nula da consulta do limite de 10 mídias; se a consulta da última posição falhar depois do upload, tenta limpar o objeto recém-enviado e não insere uma ordenação presumida. `removePublicationMediaAction` distingue erros de consulta de ausência de publicação/mídia.
- Criado `docs/META-RECONCILIATION.md` com passos para confirmar o resultado na Meta, preservar evidência e impedir reenvio quando houver incerteza. Nenhum estado de produção é alterado pelo manual.
- Pendências: teste integrado com RLS, concorrência na edição/publicação, limites simultâneos de mídia e limpeza de objetos órfãos; o controle de até 10 mídias ainda não é transacional.

### 2026-10-03 — observabilidade de upload de mídia
- A-027: leitura inicial da publicação em `addPublicationMediaAction` agora distingue erro de registro ausente. Falha de inserção de mídia após upload registra o motivo, tenta remover apenas o objeto recém-criado e interrompe sem indicar sucesso. Falhas da limpeza após erro de ordenação/inserção são registradas com `publicPath` para investigação de objeto órfão.
- CI `37126541182` estava em andamento na última consulta; confirmar execução do HEAD desta rodada. Ainda não há transação distribuída entre Postgres e Storage.

### 2026-10-03 — confirmação de agendamento e cancelamento
- A-028 (P1): `schedulePublicationAction` verificava pré-condições em leitura anterior, mas o update final aceitava qualquer status editável. Agora o update compara status, rede e tipo que foram efetivamente validados, e exige retorno do ID atualizado; falha ou zero linhas não é tratado como sucesso. `cancelScheduledPublicationAction` também exige confirmação da transição `scheduled → cancelled` e registra falhas.
- Limitação: mídia e legenda ainda podem mudar concorrentemente sem lock/versionamento; agendamento + mídia requerem teste transacional/RPC antes de afirmar proteção completa. Não houve alteração de banco/produção nesta rodada.

### 2026-10-03 — unicidade do caminho de mídia
- A-029 (P2): nome do objeto em `social-media` para mídia copiada de campanha dependia apenas de timestamp em milissegundos + nome de origem. Uploads simultâneos podiam disputar o mesmo caminho (com `upsert:false`). Acrescentado `crypto.randomUUID()` por upload; não altera arquivos já existentes.
- Verificar CI e manter teste integrado de concorrência e referências compartilhadas de Storage como pendência. 

### 2026-10-03 — confirmação de mutações editoriais
- A-030 (P2): `savePublicationAction` e `returnToDraftAction` ignoravam o resultado do update. Ambas exigem agora `select("id").maybeSingle()`, registram falha ou zero linhas e só revalidam a página após confirmação. A restrição de status continua aplicada no update, inclusive contra mudança para `publishing`/`published` entre renderização e envio do formulário.
- Pendência: feedback de erro visível ao usuário ainda é limitado a log servidor; o CI valida tipagem/build/testes, não homologação de RLS real.

### 2026-10-03 — referências compartilhadas no Storage
- CI `37126845232` para o HEAD `8d5441078c40b988f17425bce389a2994cb6223f`: sucesso.
- A-031 (P1): após remover registro de mídia, publicação individual ou lote, o código apagava o objeto `social-media` sem verificar se outro registro `publication_media` ainda referenciava o mesmo `storage_path`. Agora consulta as referências restantes e remove somente caminhos sem referência; se a consulta falhar, preserva Storage e registra a impossibilidade de verificar. Caminhos são deduplicados na remoção em lote.
- Limitação: verificação e remoção de Storage não são atômicas; inserção concorrente da mesma referência ainda exige política transacional/imutabilidade do caminho e testes de integração com RLS. A exclusão no banco já confirmada não é revertida por falha na limpeza.

### 2026-10-03 — delimitação de encerramento
- Criado [AUDIT-CLOSURE.md](AUDIT-CLOSURE.md) com quatro blocos finais de revisão técnica e matriz de aceite em ambiente isolado (ERP, templates, hortifrutti, físico/digital, autorização, Meta, concorrência e rede). O prazo em blocos não equivale à duração da homologação externa.
- O PR permanece sem merge até revisão do diff, CI final e aprovação explícita. Pendências arquiteturais não devem ser reclassificadas como resolvidas apenas por CI.

### 2026-10-03 — bloco final 1/4: integridade ERP
- CI `37127115888` para HEAD `e3f964bbdc0ede1ffd71314958c6422a840a58fc`: sucesso.
- A-032 (P2): parser CSV aceitava fim de arquivo com campo entre aspas não encerrado, podendo interpretar um arquivo truncado como linha válida. Agora lança erro antes de iniciar qualquer upsert. Removido texto de sucesso para modalidade sem cabeçalho, que já é recusada por segurança.
- Escopo deste bloco: revisão focal da importação ERP, sem alegar transação global de múltiplos lotes. Falhas durante gravação de lote ainda podem deixar lotes anteriores persistidos, sem exclusão destrutiva. Testar com arquivos reais em ambiente isolado.

### 2026-10-03 — bloco final 1/4: recuperação de PDFs
- CI `37127339354`, HEAD `bff7e66843d444ce5277d020e15f0f14e56959ca`: sucesso.
- A-033 (P2): compensação do upload PDF após falha/conflito no update condicional não inspecionava erro do Storage; agora registra `id`, caminho do novo objeto e erro de limpeza para recuperação de órfão. O PDF anterior continua retido; remoção sem `id` é rejeitada antes da consulta.
- A-009 permanece dependente de teste real com duas sessões e de procedimento de limpeza pós-backup; não existe transação distribuída Postgres/Storage.

### 2026-10-03 — bloco final 2/4: API de composição visual
- A-034 (P2): `PUT /api/product-art-composition` aceitava URL de imagem com esquema arbitrário e geometria convertida com `Number(...)||fallback`, inclusive infinito em x/y e escala. Agora exige URL absoluta HTTP(S), limita tamanho de URL/identificadores/legendas, restringe a transformação aos primeiros 12 elementos e normaliza apenas números finitos; esquemas `data:`, `javascript:` e outros são descartados.
- A autorização `requireProfile + canEdit` permanece. URLs HTTP(S) ainda são conteúdo externo e não devem ser confundidas com fetch servidor seguro; verificar política de imagem/renderização no teste de navegador.

### 2026-10-03 — bloco final 2/4: rotas de mídia digital
- CI `37127948590`, HEAD `a4ea9a3668f7726a9fbb761cea553625998a37de`: sucesso.
- A-035 (P2): `publication-drafts` e `digital-materials` usavam timestamp em milissegundos e nome como caminho; uploads simultâneos podiam colidir. Ambos agora incluem UUID por upload, mantendo `upsert:false`.
- A-036 (P1): em falha de inserção de `publication_media`, `publication-drafts` excluía o objeto Storage independentemente do resultado da exclusão do pai. Agora só compensa Storage após confirmação da exclusão condicional do rascunho; falhas de exclusão/limpeza são registradas com IDs/caminhos. Falha na criação do pai também registra erro da limpeza do objeto recém-enviado.
- Pendente: testes reais de RLS, concorrência e recuperação de objetos órfãos; Postgres e Storage não compartilham transação.

### 2026-10-03 — bloco final 2/4: substituição do logo da marca
- CI `37128255241`, HEAD `ca9bf134e26c966c348a6dfae36e44b71b3d6826`: sucesso.
- A-037 (P1): upload de logo usava `Date.now()` como nome e, após update sem verificação de linha, apagava imediatamente o logo anterior. Duas sessões podiam disputar nome/atualização e eliminar um arquivo ainda necessário. Agora o caminho inclui UUID, a atualização compara `logo_path` previamente lido e exige confirmação do registro; em conflito/falha tenta limpar somente o upload novo, registrando erro da compensação. O logo anterior é preservado para recuperação.
- A política de retenção/limpeza de logos antigos requer backup e rotina separada. Validar concorrência e RLS em ambiente isolado.

### 2026-10-03 — bloco final 2/4: fontes do Kit da Marca
- CI `37128838393`, HEAD `bf4aba0151a359cb3f60bda36d6f07a09c222060`: sucesso.
- A-038 (P1): desativação de fonte apagava imediatamente seu objeto Storage, embora modelos antigos possam referenciar a família; também ignorava erro ao consultar/atualizar os campos que usam a fonte. Agora consulta fonte/configuração com erro explícito, confirma a desativação condicional e verifica o update de fallback. Preserva o arquivo para compatibilidade/recuperação; falha parcial é registrada e comunicada. Compensação de upload de fonte também registra erro de remoção.
- Limitação: desativação e atualização de `brand_settings` são duas operações, não transação única; concorrência na configuração de fontes requer homologação e, se necessário, RPC transacional.
