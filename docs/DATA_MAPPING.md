# Mapeamento do sistema atual

## Produtos
Google Sheets `Produtos`
-> `products`
-> `product_images`

## ERP_Produtos
-> campos ERP em `products`

## Campanhas
Cada linha atual representa uma campanha + item.
Na nova base:
- `campaigns`: cabeçalho da campanha
- `campaign_items`: produtos/preços da campanha

## Publicações
-> `publications`
-> `publication_media`

## Usuários
O login PIN deixa de existir.
Usuários passam para Supabase Auth + `profiles`.

## Auditoria
-> `audit_logs`

## Imagens
Drive deixa de ser a origem principal.
Arquivos passam para Supabase Storage:
- product-images
- digital-materials
- social-media
