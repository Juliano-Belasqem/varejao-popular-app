# Modelos de mídia — contrato para integração

Esta etapa prepara o gerador para receber os layouts oficiais do Varejão Popular sem reescrever o fluxo de campanha, salvamento e publicação.

## Formatos-base

- Feed: 1080 × 1080 px.
- Story: 1080 × 1920 px.
- Modos atuais: arte individual e peça composta.
- Quantidades suportadas na peça composta: 1, 2 ou 4 produtos.

## O que precisa ser mapeado em cada modelo

Cada layout fornecido deve ser convertido em uma variante com posições em pixels para:

- imagem de cada produto;
- nome/tipo do produto;
- marca;
- especificação (peso, fragrância, sabor, modelo etc.);
- preço normal, quando houver;
- preço principal/oferta;
- título/tema da campanha, quando fizer parte do layout;
- período da campanha, quando fizer parte do layout;
- rodapé e textos legais, quando existirem.

As posições são definidas sobre a resolução final da arte, portanto o mesmo arquivo visual pode ter variantes independentes para Feed e Story.

## Arquivos de fundo

Quando o usuário fornecer os modelos, o ideal é separar o fundo fixo (PNG) dos campos variáveis. O fundo pode conter molduras, elementos decorativos, logos e grafismos que não mudam entre produtos. O gerador desenha por cima apenas os campos variáveis.

Isso evita tentar reconstruir o design em CSS/Canvas e preserva o layout original com mais fidelidade.

## Processo de adaptação

1. Receber o modelo original ou uma exportação limpa em PNG.
2. Identificar a área exata de cada campo variável.
3. Criar a variante no registro tipado em `lib/media/templates.ts`.
4. Conectar a variante ao renderer do Canvas.
5. Comparar a saída gerada lado a lado com o modelo original.
6. Ajustar tipografia, alinhamento e limites de texto.
7. Validar com produtos de nomes curtos e longos e preços com diferentes quantidades de dígitos.

## Compatibilidade

O modelo atual do gerador permanece como fallback durante a migração. Nenhum material existente precisa ser convertido e nenhuma publicação já salva é alterada.
