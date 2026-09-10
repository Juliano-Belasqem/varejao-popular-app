# Varejão Popular

Aplicação interna do Varejão Popular para campanhas, materiais digitais e publicações em redes sociais.

## Desenvolvimento

```bash
npm install
npm run typecheck
npm run build
```

O repositório valida pull requests para `main` via GitHub Actions. Os Preview Builds automáticos da Vercel são ignorados fora da `main`; o deploy de produção continua sendo disparado pela `main`.

## Publicações

O módulo de publicações suporta fluxo de rascunho, revisão, agendamento e publicação via Meta, com proteção de token, histórico e ações operacionais.
