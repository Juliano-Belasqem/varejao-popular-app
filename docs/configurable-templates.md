# Kit da Marca e templates configuráveis

O Kit da Marca fica em `/app/marca`, disponível no menu principal também no celular. O endereço antigo redireciona para a nova página. Logo, cores e fontes são usados nos geradores; a tipografia é agrupada em Campanhas, Validade Próxima e Conteúdo para Redes/Comunicados. Materiais já exportados não são reescritos.

## Templates

Validade Próxima e o gerador oficial de Campanhas têm **Configurar template e campos**. O fundo e o layout são independentes: trocar o fundo mantém as posições; restaurar posições mantém o fundo. A prévia responde às alterações, mas elas só se tornam globais ao salvar.

- Fundos: PNG/JPG/WebP ou PDF de uma página, até 20 MB na entrada; o navegador converte para PNG de até 4 MB. O PDF usa um worker local da mesma versão do leitor, sem CDN.
- Validade: opção de extrair o quadrante superior esquerdo de um arquivo com quatro peças iguais. O fundo padrão foi extraído do PDF de referência fornecido pelo usuário.
- Campos: X/Y, largura, altura, tamanho de fonte, alinhamento, peso, cor e visibilidade. Coordenadas em porcentagem; fonte em um espaço de desenho de 1000 unidades de largura. A folha mantém quatro ofertas e impressão A4.
- O fundo original já contém título, rodapé e marca. Título/rodapé dinâmicos começam ocultos para evitar duplicação; podem ser habilitados ao usar outro fundo. Um logo global personalizado ocupa o espaço da marca original. Cores embutidas no arquivo de fundo são preservadas; ajustes de campos prevalecem sobre a identidade global.
- Feed e Story mantêm configurações independentes. O gerador composto também usa a identidade global; seu arranjo de 2/4 produtos continua automático.
- Substituições usam nomes únicos no bucket privado `template-assets`; o caminho persistido é separado das URLs assinadas temporárias. Os objetos anteriores são conservados para recuperação administrativa, sem interface de histórico nesta versão.
- `revision` impede que uma sessão sobrescreva silenciosamente o template alterado em outra. Erros de carregamento impedem a exportação e são exibidos ao usuário.

## Banco e publicação futura

**Esta alteração não aplica migrações nem publica a aplicação.** Após aprovação do usuário, aplicar `supabase/migrations/20260919035044_configurable_templates_and_product_images.sql` antes de disponibilizar o novo código. As migrações anteriores, inclusive `0007_brand_kit_configuration.sql`, são pré-requisitos.

A migração cria `art_templates`, o bucket privado e suas políticas. Perfis ativos leem templates; somente admin/editor alteram. `anon` não recebe acesso. As funções de imagens usam `SECURITY INVOKER`, RLS e bloqueio por produto para cadastrar, trocar ou excluir a imagem principal em uma transação. Uma falha preserva a imagem anterior. Exclusão do objeto de Storage ocorre depois da transação de metadados.

Imagens de produtos são baixadas pelo SDK autenticado. O endpoint tenta primeiro a principal e depois outras imagens aprovadas, sem cache persistente de uma versão antiga. Downloads externos validam IPv4/IPv6, redirecionamentos, tipo/assinatura, tempo e tamanho; a correção de IPv6 evita rejeitar hosts públicos que também têm registros AAAA. A busca Google ainda depende da chave SerpApi já usada pelo projeto.

## Validação

Use Node 22 e `pnpm@11.19.0`:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

O CI executa testes de regressão, typecheck e build. Os testes de banco aplicam a migração em PostgreSQL local embutido (PGlite), com perfis editor/viewer/inativo/anon, e verificam permissões, persistência e atomicidade de imagens. Não acessam produção.

Para os testes de navegador, em terminais separados:

```sh
node tests/mock-supabase.mjs
# Defina NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329
# e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-key antes de iniciar:
pnpm dev
pnpm exec playwright install chromium
pnpm test:browser
```

Opcionalmente `TEST_BROWSER_CHANNEL=chrome` usa Chrome instalado; `TEST_CDP_URL` conecta a um navegador de teste já aberto. A fixture escuta apenas em localhost. Os testes cobrem alterações de layout com recarga, conversão de PDF, substituição de fundos, Feed/Story, exportação PNG, upload de produto, marca e prévias em 1280/390 px. Capturas ficam em `test-results/`.

Esses testes usam respostas locais simuladas para Auth/Storage/REST; as políticas SQL são verificadas separadamente em PostgreSQL. O funcionamento com credenciais reais de busca externa e o fluxo autenticado contra o Supabase de produção precisam de conferência após a aplicação autorizada da migração. A configuração existente da Vercel ignora builds de branches diferentes de `main`; este PR não modifica essa regra.
