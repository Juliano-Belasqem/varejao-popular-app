# Encerramento da auditoria — plano de homologação

A revisão estática inicial das oito etapas está registrada em [AUDIT.md](AUDIT.md). Este documento separa **conclusão técnica da branch** de **homologação operacional**. Nenhum CI substitui validação com Supabase, Storage, Meta, impressora ou dados representativos.

## Blocos restantes da revisão técnica
1. **Integridade e concorrência:** revisar importação ERP, substituição PDF, edição/agendamento/exclusão de publicações e caminhos compartilhados de Storage. Não declarar atomicidade onde não existe. Priorizar P0/P1; riscos de arquitetura não corrigíveis com segurança sem ambiente devem ser bloqueios de homologação.
2. **Segurança e autorização:** conferir APIs de escrita, papéis, RLS, acesso ao Storage e `lib/remote-image.ts`. DNS rebinding (A-016) exige estratégia de rede/egress e não deve ser marcado como resolvido por validação de URL em código.
3. **Regressão visual/funcional:** executar CI, testes do editor, layouts feed/story, impressão física A4 e códigos de barras com material real. Registrar diferenças entre gerador legado e atual.
4. **Fechamento:** consolidar achados e pendências, inspecionar diff do PR #81 contra main, registrar HEAD e CI final, elaborar roteiro de implantação e reversão; **aguardar aprovação explícita para merge**.

## Homologação obrigatória em ambiente isolado

| Área | Cenário e evidência requerida | Condição de aceite |
|---|---|---|
| ERP | Importação completa, cabeçalho ausente, duplicados, valores inválidos e falha de lote; comparar snapshot anterior/posterior | Arquivo inválido não inicia lotes; importação parcial nunca apaga produtos anteriores |
| Templates | Dois editores salvam a mesma revisão; recuperar layout persistido corrompido | Conflito explícito; GET não expõe erro interno |
| Hortifrutti | PDF real 4 quadrantes, upload concorrente e substituição | Recorte correto e arquivo anterior recuperável |
| Material físico | 1/folha, 4/folha, A4, preço, GTIN com leitor real e cortes | Sem truncamento; código lido corresponde ao produto |
| Digital | Feed/story, imagens, tipografia, prévia, download em desktop/mobile | Sem sobreposição, exportação nas dimensões corretas |
| Segurança | Perfis sem edição tentam APIs de escrita/geração paga; RLS por tabela/bucket | Operação negada e nenhum efeito colateral |
| Meta | Sucesso remoto + falha de confirmação local; timeout de resposta; processamento lento; reenvio concorrente | Nenhuma republicação automática de resultado incerto; conciliação rastreável |
| Publicações/Storage | Exclusão concorrente com início de publicação; mídias com caminho compartilhado; falha de limpeza | Publicação em processamento preservada; arquivo referenciado não é removido |
| Rede | URLs remotas e cenário DNS rebinding em infraestrutura controlada | Egress não alcança redes internas/metadata |

## Regras de entrega
- Guardar link para o último CI aprovado, SHA do HEAD, screenshots e resultados de homologação por cenário.
- Não aplicar migrações nem operações destrutivas no Supabase de produção como parte da auditoria.
- Antes de implantação: backup verificável de banco e Storage, snapshot de variáveis Vercel e plano de rollback compatível com migrações.
- Estado final possível: **revisão técnica concluída com homologação pendente**. Não rotular como sistema 100% testado até que os cenários acima sejam executados.

## Evidência técnica consolidada — 03/10/2026
- CI aprovado após correção da regressão A-039: [run 37129343855](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37129343855), commit `ac8a6409df1bb2ee0707746f99bb7cb74b0c23e4`. O erro anterior [37129249657](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37129249657) decorreu da inserção indevida da validação de upload em GET; correção registrada em AUDIT.md.
- CI executa `pnpm test`, `pnpm run typecheck`, `pnpm run build` e `node tests/run-visual-browser.mjs` com fixtures locais. O artefato `visual-editor-verification` tem retenção de sete dias e inclui prévias e exportações. Não interpretar screenshots locais como homologação com banco real ou dispositivo de impressão.
- PR de trabalho: [#81](https://github.com/Juliano-Belasqem/varejao-popular-app/pull/81), branch `audit/phase-01-foundation`; backup Git: `backup/pre-audit-2026-10-02`, base `2fe48e260eb4a692394d7b10fe4b6621af8fc58b`. O backup de Git não inclui banco, Storage nem variáveis Vercel.

## Pendências e bloqueios de liberação
1. **A-016 — SSRF / DNS rebinding:** validação de URL não garante o destino de conexão; estabelecer controle de saída/egress e testar DNS/redirects em infraestrutura controlada antes de liberar fetch remoto irrestrito.
2. **Integridade entre banco e Storage:** a concorrência de publicação/mídia foi validada em duas sessões no Supabase isolado. Ainda permanecem para homologação operacional os fluxos que cruzam banco e Storage (fontes/logos/PDF), pois não há transação distribuída.
3. **Meta:** testar falha após sucesso remoto e confirmação local, processamento lento e conciliação manual conforme [META-RECONCILIATION.md](META-RECONCILIATION.md). Não executar publicações reais de teste em contas de produção.
4. **Impressão e visual:** testar com PDF de hortifrutti real, A4 1/4 e 1/folha, fontes da marca, código GTIN lido por scanner físico, layouts feed/story e dispositivos representativos.
5. **Autorização/Storage:** a matriz principal de tabelas RLS foi executada em ambiente isolado e revelou/corrigiu acesso de leitura de perfil inativo. Permanece homologação específica de buckets/URLs assinadas e fluxos de Storage.

## Sequência segura para aprovação
1. Revisar alterações e pendências do PR; anexar evidências de homologação isolada e registrar correções adicionais no mesmo relatório.
2. Obter backup restaurável de banco/Storage e registro das configurações de implantação; preparar rollback e avaliar migrações separadamente.
3. Confirmar CI verde no **HEAD final** (o CI de commit anterior não certifica commits documentais posteriores), verificar o diff e só então solicitar aprovação explícita do merge.
4. Após aprovação, observar a implantação e validar os fluxos críticos com dados não destrutivos. Não presumir que a prévia da Vercel esteja ativa: o comentário automático do PR registra deployment ignorado.

**Estado:** revisão técnica automatizada avançada; homologação operacional e aceite de implantação pendentes. Sem autorização para merge neste documento.

## Mitigação A-016 — bloqueio preventivo de download remoto (03/10/2026)
- `downloadRemoteImage()` agora falha antes de qualquer DNS/conexão se `REMOTE_IMAGE_EGRESS_PROTECTED !== "true"`. A importação de imagem por URL fica **desabilitada por padrão**, sem desativar uploads de arquivos locais. Isto é uma mitigação fail-closed, não prova de eliminação de DNS rebinding.
- **Não configurar a variável como true apenas para restaurar a função.** Primeiro implementar saída de rede que bloqueie em tempo de conexão IPv4/IPv6 privados, loopback, link-local, metadata e redirecionamentos para destinos proibidos; registrar quem controla DNS e o destino efetivo da conexão. Testar rebinding com DNS controlado e redirects antes de habilitar.
- A equipe deve comunicar na interface/operacional que a importação por URL depende da proteção de infraestrutura; utilizar upload de arquivo local enquanto estiver bloqueada.

## Evidência e execução A-042 — concorrência (03/10/2026)
- CI [37130699761](https://github.com/Juliano-Belasqem/varejao-popular-app/actions/runs/37130699761) aprovado no commit `3eeb288f771e6ac2be85629589b204e6fdba254d`, incluindo teste PGlite `tests/publication-media-guard.test.ts` da migration `20261003090000_guard_publication_media_mutation.sql`.
- Roteiro reproduzível de duas sessões e matriz de aceite em [PUBLICATION-CONCURRENCY-TEST.md](PUBLICATION-CONCURRENCY-TEST.md). A execução real em PostgreSQL/Supabase isolado foi concluída posteriormente nos dois sentidos, conforme seção abaixo. Transações envolvendo Storage permanecem fora do escopo desse teste.

## Homologação Supabase isolada — 05/10/2026
- Ambiente descartável `varejao-midia-audit-pr81` criado em `sa-east-1`; o projeto de estoque de homologação foi pausado temporariamente para liberar a vaga do plano gratuito. Produção não foi alterada.
- Esquema completo da branch aplicado com sucesso, inclusive `20261003090000_guard_publication_media_mutation.sql`. Teste transacional no PostgreSQL real confirmou bloqueio de DELETE/UPDATE de mídia quando a publicação está `publishing`, edição permitida após retorno a `draft` e `ON DELETE CASCADE` sem mídia órfã.
- Security Advisor detectou execução RPC indevida de `public.audit_publication_change()` (`SECURITY DEFINER`) por `anon`/`authenticated`. A-043 corrigido por migration **forward-only** `20261005120000_restrict_publication_audit_trigger_function.sql`: execução revogada de `public, anon, authenticated` e mantida para `service_role`. A migration histórica `0006_publication_audit_trigger.sql` foi restaurada, evitando depender de alteração retroativa em bancos onde ela já foi aplicada. Reexecução do Security Advisor no ambiente isolado: **zero lints**.
- Performance Advisor: 17 FKs sem índice de cobertura, 10 grupos de políticas permissivas sobrepostas e 1 ocorrência de `auth.uid()` sem initplan em `audit_logs`. Tratar como dívida de desempenho; avisos de índices não usados não são conclusivos neste banco recém-criado.
- Matriz autenticada executada posteriormente com usuários descartáveis sob `role authenticated` e `auth.uid()` correspondente; ver seção de RLS abaixo.
- A execução intersessões foi concluída posteriormente nos dois sentidos; ver seção de concorrência abaixo.

### Concorrência real em duas sessões — 05/10/2026
- Cenário claim-first executado com duas conexões simultâneas no projeto isolado: a sessão A alterou a publicação de `draft` para `publishing` e manteve a transação aberta por 5 s; a sessão B tentou excluir a mídia após 1 s. A exclusão não ocorreu e terminou com `Cannot modify media while publication is processing or published`, confirmando que a mutação não atravessa o claim concorrente.
- Cenário media-first executado em duas conexões: a sessão de exclusão adquiriu primeiro o lock do pai, removeu a mídia e manteve a transação aberta; a tentativa concorrente de claim só concluiu depois da liberação. Estado final confirmado: publicação `publishing`, `media_count=0`. Isso demonstra serialização consistente nos dois sentidos e elimina a pendência de teste intersessões do A-042.
- CI do HEAD documental anterior `a48e8705cd436d755aa194a19865b351601f0754`: run `37313727196`, conclusão `success`.

### Hardening de desempenho/RLS — 05/10/2026
- Migration `20261005150000_performance_hardening.sql`: adicionados índices de cobertura para as 17 FKs apontadas pelo Performance Advisor e otimizada a política de inserção de `audit_logs` para avaliar `auth.uid()` via initplan. Homologada com sucesso no Supabase descartável.
- Migration `20261005153000_rls_policy_performance.sql`: políticas de edição `FOR ALL` das tabelas apontadas pelo Advisor foram separadas em `INSERT`, `UPDATE` e `DELETE`, preservando as políticas `SELECT` e a condição `public.can_edit()`. Homologada com sucesso no ambiente isolado.
- Após as duas migrations: **Security Advisor = 0 lints**; Performance Advisor não reporta mais FKs sem índice, `auth_rls_initplan` nem políticas permissivas sobrepostas. Restam apenas avisos informativos de índices ainda não utilizados, sem valor conclusivo num banco descartável recém-criado e sem carga representativa.

### Matriz RLS autenticada e perfil inativo — 05/10/2026
- Foram criados usuários descartáveis de homologação para `editor`, `viewer` e `editor` inativo e as consultas foram executadas sob `role authenticated` com `auth.uid()` correspondente.
- Editor ativo: `current_role() = editor`, `can_edit() = true`; escrita protegida confirmada em publicação/campanha nos testes executados.
- Viewer ativo: `current_role() = viewer`, `can_edit() = false`; leitura autenticada confirmada e tentativas de escrita em produtos/campanhas/publicações/ERP foram rejeitadas pela RLS nos casos executados.
- Perfil inativo: `current_role() = null` e `can_edit() = false`. A matriz revelou que políticas legadas `SELECT USING (true)` ainda permitiam leitura. A migration `20261005160000_require_active_profile_for_reads.sql` substituiu essas políticas por verificação de perfil ativo em produtos, imagens, campanhas/itens, publicações/mídia, ERP, hortifrutti e kit da marca. Após aplicação, o usuário inativo retornou zero linhas nas tabelas amostradas e continuou bloqueado para escrita.
- Algumas repetições positivas foram bloqueadas pela camada de segurança da integração antes de alcançar o banco; esses casos não são contabilizados como aprovados. A evidência acima registra somente operações efetivamente executadas.
- Security Advisor após o hardening estrutural reporta apenas `auth_leaked_password_protection` (configuração de Supabase Auth, não migration/RLS). Validar/habilitar proteção de senhas vazadas no projeto definitivo. Performance Advisor mantém apenas `unused_index` informativo no banco descartável sem carga representativa.
- CI do HEAD `1608210efe2eb73655bacd61f805a7794d010c3a`: run `37329047300`, conclusão `success`.
