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
