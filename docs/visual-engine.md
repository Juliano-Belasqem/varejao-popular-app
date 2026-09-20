# Motor Visual Universal

O PR #48 entrega a fundação de Ofertas e um editor utilizável de ponta a ponta em `/app/editor-visual`. Campanhas e geradores anteriores continuam com suas rotas e contratos. A migration `20260920050000_offers_foundation.sql`, já aplicada, não foi alterada nesta conclusão.

## Documento e renderização

`VisualDocument.version = 1` continua válido. Os campos originais representam a primeira prancheta; `pages` acrescenta outras pranchetas com nome, tamanho, unidade, fundo e elementos próprios. Documentos antigos sem `pages` continuam abrindo. O nome da primeira prancheta também identifica o template.

Elementos de texto, imagem, forma, EAN-13 e grupo usam coordenadas da prancheta. Pixels e milímetros são suportados, com presets Feed, Story, A4 e quarto de A4 e dimensões livres. O fundo é separado do conteúdo. `VisualRenderer` é compartilhado por edição, preview, SVG, PNG e impressão/PDF.

Grupos guardam IDs de filhos com coordenadas locais. `groupSize` preserva o espaço original dos filhos durante redimensionamento. Transformações afins usam rotação, inclinação e escala; desagrupar mantém a geometria e a ordem das camadas. `scaleX/scaleY` são opcionais, com padrão 1, e preservam também a tipografia ao desagrupar. Opacidade de um grupo é composta como grupo; desagrupar distribui sua opacidade pelos filhos (sobreposições translúcidas podem mudar a composição).

O editor oferece seleção com Shift, seleção geral, grupos aninhados, bloqueio herdado, visibilidade, duplicação, copiar/colar, ordenação real das camadas, alinhamento à seleção/prancheta/grupo, distribuição, encaixe configurável, guias, zoom, pan, oito alças, rotação e histórico de desfazer/refazer. Uma interação de arraste gera uma entrada de histórico; Escape, perda de foco ou cancelamento do ponteiro desfaz a interação incompleta. Alt suspende os encaixes e Shift mantém proporção, eixo ou passos de rotação.

Texto possui fonte livre ou do Kit da Marca, peso, itálico, cor, alinhamento, contorno, espaçamento, entrelinha e sombra. O texto quebra linhas pela métrica da fonte disponível no navegador e é recortado na caixa. Imagens têm contain/cover/fill e posição do recorte. Formas incluem retângulo, elipse e linha. EAN-13 valida o dígito verificador e mantém as áreas silenciosas; sua leitura física depende também do tamanho e qualidade de impressão. Preço segmentado é um grupo editável de moeda, reais, centavos e unidade.

## Dados e componentes

Bindings resolvem caminhos próprios em objetos; acesso a protótipos é rejeitado. O preview começa com dados explicitamente identificados como exemplo. A biblioteca permite selecionar uma Oferta real, incluindo produto, imagem autenticada, preço, unidade, datas e campanha, além do logo atual do Kit da Marca. JSON personalizado permite testar bindings adicionais sem mudar o esquema.

Seleções podem ser salvas como templates de categoria `component`. Inserir um template/componente copia a primeira prancheta com novos IDs e mantém os bindings; alterações posteriores no original não modificam as cópias existentes. Templates, ofertas e histórico são paginados, sem um limite total artificial de registros.

## Persistência e acesso

O salvamento usa a RPC existente `save_visual_template`: template e nova versão são gravados atomicamente, com bloqueio de linha para numerar versões. Abrir uma versão anterior e salvar cria outra versão; não altera as anteriores. Em edição simultânea cada salvamento gera seu próprio snapshot; não há mesclagem automática entre editores. Salvar como cópia cria outro template.

Uploads de PNG/JPEG/WebP usam o bucket privado existente `template-assets`, com a RLS já instalada. `/api/visual-assets` verifica usuário ativo, exige editor/admin no upload, valida assinatura e tamanho (4 MB, limite do bucket), usa nomes únicos e nunca sobrescreve um arquivo anterior. O documento guarda uma rota autenticada estável, não uma URL assinada que expira. Arquivos anteriores permanecem disponíveis para o histórico. Não há remoção automática de uploads órfãos nesta etapa.

As actions verificam perfil ativo e o salvamento verifica papel de editor/admin. Viewers podem abrir/exportar templates e consultar histórico, mas não gravar versões ou imagens. A validação rejeita transformações inválidas, estilos malformados, fontes de imagem inseguras, ciclos, IDs duplicados, referências inexistentes e filhos pertencentes a múltiplos grupos.

## Saídas e limites de execução

SVG incorpora imagens e fontes utilizadas do Kit da Marca. PNG usa a mesma arte e escala escolhida. A impressão reúne todas as pranchetas com tamanhos físicos próprios; o diálogo do navegador permite salvar em PDF. JSON mantém o documento editável para importação. Exportar com imagens indisponíveis falha com mensagem, em vez de omitir silenciosamente conteúdo. Recursos externos precisam permitir leitura pelo navegador (CORS); reenvio pelo editor evita essa dependência.

Somente PNG tem uma proteção de memória do navegador: 64 milhões de pixels e 16.384 pixels por eixo. SVG continua disponível para dimensões maiores. Não há limite artificial de elementos, pranchetas ou tamanho de fonte. O limite de transporte de Server Actions existente continua em 10 MB; imagens enviadas não ocupam esse corpo porque ficam no Storage.

## Validação

`pnpm test`: regressões existentes, geometria, snap, grupos, ordenação, serialização, validação, EAN-13 e execução real da migration em PGlite com RLS e versões imutáveis.

`pnpm typecheck` e `pnpm build`: validação TypeScript e build de produção.

`node tests/run-visual-browser.mjs`: inicia fixtures locais e o build de produção; testa edição, arraste, bloqueio, resize girado, undo/redo, uploads, preview de Oferta, salvamento/reabertura, múltiplas pranchetas, restauração, componentes, SVG/PNG, viewport móvel e permissões. `TEST_BROWSER_CHANNEL=chrome` permite usar Chrome local; no CI o Playwright instala Chromium. Nenhuma credencial ou dado de produção é necessário. Artefatos ficam em `test-results/`.

## Próximas etapas do produto

Adoção deste motor pelos geradores existentes, geração em lote e ligação dos materiais a Publicações continuam etapas posteriores da arquitetura aprovada. O editor desta etapa não substitui os fluxos atuais nem publica materiais. O `ignoreCommand` do Vercel permanece bloqueando builds de branches fora da main; merge e deployment dependem de aprovação explícita.
