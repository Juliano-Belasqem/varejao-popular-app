# Entrega 2 — Relações de fornecedores e reservas

Esta primeira fase cria relações de um único fornecedor com itens, quantidades parciais e vínculo opcional a ocorrências.

- Funcionários (`editor`) cadastram fornecedores, ocorrências e rascunhos.
- Rascunhos não reservam saldo e não expõem custos.
- Apenas administradores finalizam ou cancelam relações.
- A finalização usa `finalize_supplier_relation`: bloqueia a relação e cada produto em ordem determinística, confere `products.stock` menos reservas ativas e grava o ledger de reservas na mesma transação.
- O cancelamento usa `cancel_supplier_relation`: marca a reserva como liberada, sem apagar o histórico, e registra auditoria em `audit_logs`.
- A API protegida está em `/api/relations`; a tela responsiva está em `/app/relacoes`.

O desenho deixa espaço para as próximas fases adicionarem snapshots, PDF A4 e valores monetários controlados por administrador. NF-e/DANFE continuam externos ao fluxo, no Guappo.

## Homologação

Aplicar a migração somente no banco local de homologação `127.0.0.1:55434`, banco `varejao_manual_homolog`, usando o fluxo normal do Supabase CLI/projeto. Não apontar comandos para produção. Preservar `.data/manual-homologation-photos-v2` sem limpeza ou migração destrutiva.
