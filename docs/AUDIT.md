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
| 01 | `lib/template-config.ts`, `components/template-editor.tsx`, `components/configured-ticket.tsx`, `lib/use-template.ts`, `app/api/templates/route.ts`, `tests/config.test.ts` | Validação, compatibilidade, salvamento e prévia | EM ANÁLISE |
| 02 | `app/app/validade-proxima/**`, `app/app/modelos-hortifrutti/**`, `app/app/campanhas/[id]/fisico/**`, CSS e migrações correlatas | PDF, recortes, códigos, preços e impressão A4 | EM ANÁLISE |
| 03 | `app/app/campanhas/**`, `app/app/ofertas/**`, `app/app/produtos/**`, APIs de imagem, `lib/money.ts` | Consistência de catálogo, campanhas, preço e ativos | EM ANÁLISE |
| 04 | `app/app/campanhas/[id]/gerar/**`, `app/app/conteudo-redes/**`, `lib/media/**`, `app/api/digital-materials/**` | Preview, fontes, exportação e código legado | INVENTARIADO |
| 05 | `components/visual-*`, `app/app/editor-visual/**`, `lib/visual-*`, `tests/visual-*` | Operações, persistência e renderização do editor visual | INVENTARIADO |
| 06 | `app/app/publicacoes/**`, `app/api/publications/**`, `lib/publications/**`, `lib/meta/**` | Publicação, agendamento, idempotência e auditoria | INVENTARIADO |
| 07 | `lib/auth.ts`, `lib/supabase/**`, `proxy.ts`, `app/api/**` restante, `app/app/usuarios/**`, migrações SQL | Autorização, RLS, uploads e integridade | INVENTARIADO |
| 08 | `app/app/layout.tsx`, `components/sidebar.tsx`, `app/globals.css`, login, dashboard, configuração, README e demais testes | UX, acessibilidade, CI, documentação e homologação | INVENTARIADO |

**Procedimento para continuidade entre chats:** ler este AUDIT primeiro; selecionar apenas a próxima etapa PENDENTE; registrar os arquivos e intervalos revisados, achados com reprodução, commits e resultados; não repetir o scan completo se a árvore não mudou. Comparar com o SHA de backup para detectar novos arquivos.

## 3. Registro de achados

| ID | Etapa | Arquivo | Achado / risco | Severidade | Situação |
|---|---|---|---|---|---|
| A-001 | 01 | `lib/template-config.ts` | Validação de números opcionais compara intervalos, mas NaN pode atravessar comparações (ex.: opacity, rotation, strokeWidth); proteger todos os parâmetros numéricos opcionais. | P1 | CORRIGIDO nesta branch; testes adicionados, aguardando CI |
| A-002 | 01 | `app/api/templates/route.ts` | Controle otimista por revision e remoção de upload não confirmado já presentes; testar conflito concorrente em integração. | P2 | PENDENTE teste |\n| A-006 | 01 | `app/api/templates/route.ts` | GET não capturava erro de validação de layout persistido, resultando em erro interno sem orientação. | P1 | CORRIGIDO nesta branch; aguarda CI |\n| A-007 | 01 | `tests/config.test.ts` | Não havia regressão explícita para exceção de tamanho de fonte física (1000) versus digital (500). | P2 | CORRIGIDO nesta branch; aguarda CI |\n| A-010 | 03 | `app/app/produtos/actions.ts` | Cadastro manual fixava `gtin_valid: true` para qualquer código, inclusive não GTIN. | P1 | CORRIGIDO nesta branch; aguarda CI |\n| A-011 | 03 | `app/app/campanhas/actions.ts` | Criação e edição de campanha não impediam intervalo de datas invertido. | P1 | CORRIGIDO nesta branch; aguarda CI |\n| A-012 | 03 | `app/app/produtos/actions.ts`, `app/app/produtos/page.tsx` | Importação ERP fazia upsert em lotes e depois excluía todos os registros anteriores a `syncStarted`, expondo a base a perdas por arquivo parcial. | P0 | CORRIGIDO: importação não destrutiva, aviso de lotes parciais e interface alinhada; CI pendente |\n| A-009 | 02 | `app/app/modelos-hortifrutti/actions.ts` | Substituição/remoção de PDF podia apagar imediatamente a versão anterior e não protegia contra duas edições simultâneas. | P1 | CORRIGIDO nesta branch; aguarda CI e teste de concorrência |\n| A-008 | 02 | `validity-flyer-generator.tsx`, `campaign-physical-generator.tsx` | Implementações EAN-13 duplicadas; risco de divergência entre módulos. Reutilizar algoritmo já presente em `lib/visual-barcode.ts`, mantendo exigência de 13 dígitos nos geradores físicos. | P2 | CORRIGIDO nesta branch; aguarda CI e teste de scanner |
| A-003 | 02 | `app/app/modelos-hortifrutti/produce-template-generator.tsx` | Recorte 2×2 assume quadrantes iguais; arquivos com margens/gutters exigem seleção de área ajustável. | P2 | PENDENTE verificação com PDF real |
| A-004 | 04 | `app/app/campanhas/[id]/gerar/page.tsx` | Gerador legado ainda coexistente com oficial; mapear diferenças antes de remoção. | P2 | PENDENTE |
| A-005 | 08 | `.github/workflows/ci.yml` | CI possui testes unitários, typecheck, build e navegador do editor visual; falta cobertura dedicada de exportação física A4. | P1 | PENDENTE |

## 4. Diário de execução

### 2026-10-02 — preparação e etapa 01
- Backup de código criado no SHA indicado acima.
- Inventário da árvore completo: 149 arquivos; classificação por domínio.
- Lidos inicialmente: `.github/workflows/ci.yml`, `package.json`, `README.md`, `lib/use-template.ts`, `app/api/templates/route.ts`, `lib/auth.ts`, `app/app/page.tsx`, `app/app/campanhas/[id]/gerar/page.tsx`; amostras e/ou conteúdo de `lib/template-config.ts`, `components/template-editor.tsx`, `components/configured-ticket.tsx`, `tests/config.test.ts`, `app/app/modelos-hortifrutti/produce-template-generator.tsx`, `app/api/digital-materials/route.ts`, `app/api/visual-assets/route.ts`, `app/app/campanhas/[id]/gerar/official-template-generator.tsx`.
- Revisão de segurança funcional iniciada: A-001 identificado e corrigido em `lib/template-config.ts`; teste de regressão em `tests/config.test.ts` cobrindo NaN e Infinity em 19 propriedades numéricas opcionais.
- A-006: o GET agora devolve resposta 503 explicativa para layout persistido inválido, sem divulgar detalhes internos.\n- A-007: testes de regressão adicionados para limite de fonte física (1000) e digital (500).\n- Revisão integral nesta etapa: `lib/use-template.ts`, `app/api/templates/route.ts`, `components/configured-ticket.tsx`, `lib/template-config.ts`, `tests/config.test.ts`; revisão focal de `components/template-editor.tsx` (carregamento, salvamento, upload e movimentação).\n- Próximas verificações da etapa 01: testar conflito concorrente da API em ambiente isolado e confirmar UX de alterações não salvas; registrar testes de CI após conclusão.\n- Nenhum deploy de produção ou teste contra banco real foi realizado nesta etapa.

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
