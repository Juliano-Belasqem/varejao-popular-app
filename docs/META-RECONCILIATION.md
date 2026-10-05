# Conciliação manual de publicações Meta

Este procedimento é para operadores autorizados quando uma publicação permanece em **Publicando** ou o resultado remoto é incerto. Não executa publicações nem altera dados automaticamente.

## Regra de segurança
**Não clicar novamente em Publicar, não duplicar a publicação e não alterar `publishing` para `error` apenas por tempo decorrido.** Uma requisição à Meta pode ter sido concluída mesmo se a resposta se perdeu. O scheduler só seleciona `scheduled`, não `publishing`.

## Verificação
1. Abra **Publicações → Em processamento / conciliação** e o detalhe do item. Registre ID local, rede, tipo, horário, campanha, legenda, mídia e mensagem de erro. Observe que `publishing` também pode indicar uma operação ainda ativa.
2. Consulte a conta correta no Meta Business Suite e a publicação no Instagram/Facebook, conferindo conteúdo, horário, rede e identificador remoto quando disponível. Uma ausência momentânea na interface não prova falha: aguarde propagação/processamento e, para vídeos, verifique o processamento do contêiner.
3. Procure nos logs da aplicação pelo ID local. Se a Meta confirmou um post ID mas o banco não registrou `published`, o serviço tenta conservar o ID remoto em `error_message` e no log. Preserve a evidência, sem expor tokens.
4. Classifique **com evidência**:
   - **Confirmada na Meta:** registre ID/URL remotos e horário; administrador deve conciliar o estado local com `published` por procedimento controlado, preservando trilha de auditoria.
   - **Falha comprovada antes de qualquer criação/publicação remota:** somente após evidência suficiente, administrador pode reclassificar como erro recuperável e decidir uma nova tentativa.
   - **Resultado incerto, processamento ativo ou evidência insuficiente:** mantenha `publishing`, registre observações e escale para verificação manual. Nunca reenvie automaticamente.
5. Confira se não houve publicação duplicada, salve o resultado da conciliação em registro de incidente e valide a listagem.

## Limites da implementação atual
- Não existe nesta auditoria um botão de conciliação que modifique `published`/`error` nem rotina de deduplicação remota. Alterações administrativas no banco exigem autorização, backup e trilha de auditoria; **não executar SQL improvisado em produção**.
- Falhas de persistência do aviso podem deixar apenas o log do servidor; o detalhe mostra um alerta padrão e o ID local independentemente do aviso.
- A confirmação de Meta não torna banco e API remota uma transação única. Testes ponta a ponta com credenciais e contas de homologação ainda estão pendentes.
