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
| A-019 | 03 | `app/app/produtos/actions.ts` | Importação de arquivo sem colunas opcionais pode atualizar campos existentes para `null`/`false` via upsert (ex.: preço, estoque, unidade e pesquisar imagem). | P1 | CORRIGIDO de forma conservadora: planilhas com cabeçalho incompleto e CSV sem cabeçalho são recusados antes do upsert; aguarda CI e homologação com exportação ERP completa |\n| A-020 | 03 | `app/app/produtos/actions.ts` | Linhas parcialmente preenchidas eram ignoradas silenciosamente e códigos duplicados eram sobrescritos dentro do Map antes da gravação. | P1 | CORRIGIDO: rejeita linha sem código/descrição e código duplicado na pré-validação, antes de qualquer lote; CI pendente |\n| A-018 | 08 | `app/globals.css` | Regras de impressão de código de barras duplicadas, uma `height:100%!important` e outra `height:auto!important`; a última prevalece, comportamento frágil. | P2 | PENDENTE: teste visual A4 antes de consolidar |

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
