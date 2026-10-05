# Homologação isolada — concorrência de publicação e mídia

**Não executar em produção.** Preparar projeto Supabase/PostgreSQL descartável, aplicar as migrations da branch na ordem prevista e usar UUIDs e arquivos de teste. O teste PGlite do CI verifica estados e cascata, mas não representa duas conexões simultâneas.

## Pré-requisitos
- Banco isolado com `20261003090000_guard_publication_media_mutation.sql` aplicada.
- Duas sessões SQL independentes, A e B, conectadas ao mesmo banco; não utilizar o SQL Editor como se duas abas garantissem conexões distintas.
- Inserir uma publicação `draft` e uma mídia vinculada. Guardar seus UUIDs em `<PUBLICATION_ID>` e `<MEDIA_ID>` nos comandos abaixo.
- Preferir transações curtas. Em sessão de teste, usar `SET LOCAL lock_timeout = '3s'` na sessão que deverá aguardar; um timeout confirma contenção, não por si só a correção de todo o fluxo.

## Cenário 1 — claim primeiro, edição depois
**Sessão A:**
```sql
begin;
update public.publications
set status = 'publishing'
where id = '<PUBLICATION_ID>' and status = 'draft'
returning id, status;
-- Mantenha a transação aberta temporariamente.
```
**Sessão B:**
```sql
begin;
set local lock_timeout = '3s';
delete from public.publication_media where id = '<MEDIA_ID>';
-- Esperado: aguarda lock de A; poderá atingir lock_timeout.
rollback;
```
**Sessão A:** `commit;`

**Sessão B (nova transação):**
```sql
delete from public.publication_media where id = '<MEDIA_ID>';
-- Esperado: exceção Cannot modify media while publication is processing or published.
```
Verificar que a mídia permanece no banco.

## Cenário 2 — edição primeiro, claim depois
Recriar dados de teste em `draft`.
**Sessão B:**
```sql
begin;
delete from public.publication_media where id = '<MEDIA_ID>';
-- Mantenha a transação aberta.
```
**Sessão A:**
```sql
begin;
set local lock_timeout = '3s';
update public.publications set status='publishing'
where id='<PUBLICATION_ID>' and status='draft' returning id;
-- Esperado: aguarda lock de B; poderá atingir lock_timeout.
rollback;
```
**Sessão B:** `commit;`

**Sessão A (nova transação):**
```sql
update public.publications set status='publishing'
where id='<PUBLICATION_ID>' and status='draft' returning id;
select count(*) from public.publication_media where publication_id='<PUBLICATION_ID>';
-- Esperado: mídia excluída antes do claim; count=0.
```

## Casos adicionais obrigatórios
1. Repetir com perfis `editor`, `viewer` e usuário desativado, verificando RLS e permissões efetivas; não apenas a conexão de administrador.
2. Testar INSERT e UPDATE em `publication_media` durante `publishing` e `published`; UPDATE de `publication_id` deve ser rejeitado.
3. Excluir publicação elegível com `ON DELETE CASCADE`, verificando remoção relacional, sem assumir que Storage foi removido.
4. Simular falha de remoção Storage e referência compartilhada; objeto deve ser retido quando a exclusividade não puder ser confirmada.
5. Verificar timeout e erro de conexão da Meta após o início da chamada remota: estado deve permanecer para conciliação, sem republicação automática.

**Critério de aceite:** registrar comandos, saídas, IDs descartáveis, papéis, versão de migration, tempos/locks observados e conclusão por cenário. Não executar publicação real na Meta nem apontar Storage para buckets de produção.

## Verificação dos ambientes conectados — 03/10/2026
- Consulta somente leitura confirmou dois projetos acessíveis: `vtrgecsqvzbdvkkoorqb` (migrations do aplicativo de mídia, até `produce_pdf_templates` e variante física) e `atmgfzqzslidfmuguenf` (`varejao-estoques-homolog`, migrations de estoque/pedidos). Ambos sem branches de desenvolvimento listadas na consulta.
- **Não aplicar esta migration ao projeto de mídia diretamente**, pois não foi designado como descartável. **Não reutilizar `varejao-estoques-homolog`**: seu esquema é de outro aplicativo.
- Pré-requisito de execução remota: criar/aprovar um projeto descartável específico ou uma branch isolada do projeto de mídia, verificar eventual custo antes de criar, aplicar as migrations necessárias e então executar o roteiro de duas sessões. Nenhum teste remoto ou DDL foi executado nesta consulta.
