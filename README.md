# Varejão Popular — nova plataforma

Migração do sistema atual em Google Apps Script para Next.js + Supabase + Vercel.

## Princípio da migração

O sistema antigo permanece funcionando até que cada módulo esteja validado na nova plataforma.

## Stack

- Next.js 16 / App Router
- TypeScript
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- Vercel
- Meta Graph API

## Primeira instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

Depois aplique `supabase/migrations/0001_initial.sql` no projeto Supabase.

## Perfis

- `admin`
- `editor`
- `viewer`

## Módulos planejados

1. Auth + estrutura
2. Produtos e imagens
3. Campanhas e itens
4. Publicações
5. Meta (Instagram/Facebook)
6. Scheduler
7. Gerador de material digital
8. Migração final dos dados do Google Sheets
