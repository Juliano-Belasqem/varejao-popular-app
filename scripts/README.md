# Scripts de migração

Esta pasta receberá os importadores do Google Sheets/CSV para Supabase.

A migração será idempotente:
- produtos por EAN
- campanhas por nome
- itens por campaign + product
- publicações por ID legado

Nenhum script de importação deve apagar o sistema antigo.
