# Varejão Popular

Aplicação interna do Varejão Popular para campanhas, materiais digitais e publicações em redes sociais.

## Desenvolvimento local

### 1. Preparar o projeto

```bash
npm install
```

Crie um arquivo `.env.local` na raiz do projeto usando `.env.example` como referência e preencha apenas as credenciais necessárias. Os arquivos `.env` e `.env.local` são ignorados pelo Git e não devem ser enviados ao repositório.

### 2. Rodar localmente

```bash
npm run dev
```

Abra `http://localhost:3000` no navegador.

### 3. Validar antes de abrir ou aprovar um PR

```bash
npm run check
```

Esse comando executa o typecheck e um build local de produção.

## Fluxo recomendado

1. Atualize a `main` local.
2. Crie ou entre na branch da fase em desenvolvimento.
3. Faça as alterações e teste com `npm run dev`.
4. Antes do PR, rode `npm run check`.
5. Abra o PR somente após a validação local.
6. Faça o merge na `main` apenas depois da aprovação funcional.

O repositório valida pull requests para `main` via GitHub Actions. Os Preview Builds automáticos da Vercel são ignorados fora da `main`; o deploy de produção continua sendo disparado pela `main`.

## Publicações

O módulo de publicações suporta fluxo de rascunho, revisão, agendamento e publicação via Meta, com proteção de token, histórico e ações operacionais.
