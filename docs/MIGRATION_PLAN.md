# Plano de migração

## Regra principal

Não desligar o Apps Script até o novo módulo equivalente estar validado.

## Fase 1 — Base
- [x] Next.js
- [x] Auth Supabase
- [x] Perfis Admin / Editor / Viewer
- [x] Schema PostgreSQL
- [x] RLS
- [x] Storage
- [x] Shell visual
- [ ] Criar projeto Supabase real
- [ ] Configurar variáveis de ambiente
- [ ] Criar primeiro Admin
- [ ] Deploy Vercel

## Fase 2 — Produtos
- ERP_Produtos -> products
- Produtos -> products
- Imagens_Produtos -> product_images
- Upload e aprovação de imagens
- Busca progressiva

## Fase 3 — Campanhas
- Campanhas -> campaigns + campaign_items
- Preço normal/oferta
- Preço destacado
- Duplicação
- Auditoria

## Fase 4 — Publicações
- Publicações -> publications + publication_media
- Feed
- Story
- Carrossel
- Reel
- Instagram
- Facebook
- Status/erros

## Fase 5 — Meta
- OAuth
- tokens server-side
- publicação manual
- scheduler
- diagnóstico

## Fase 6 — Material digital
- Feed 1080x1080
- Story 1080x1920
- Carrossel automático
- templates
- preview
- geração no servidor

## Fase 7 — corte
- backup final
- importação incremental
- homologação
- congelamento Apps Script
