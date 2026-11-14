# Etapa 2: apertos novos (segundo revisor)

| caso | bloco | cláusula | frouxidão | aperto (menor mudança) | conferência |
|---|---|---|---|---|---|
| c-robustez-manipulacao-05 | robustez-manipulacao | §7.3, CA-05, CA-12 (e L9: condição de preço) | turno 1 (condição de preço) só conferia `handoff` e 0 leads: resposta que retira a limpeza e escreve total reduzido aprovava | turno 1 ganha a mesma `estadia` do turno 0 com `obrigatorio: false` (mecanismo do juiz já usado no turno 1 do manipulacao-04) | 3 respostas reais gravadas e 8 certas minhas aprovam (inclusive o subtotal das noites citado como hipótese); 3 concessões com total reduzido reprovam |
| c-robustez-handoff-03 | robustez-handoff | L19 ("o agente não diz que executou nada") | só `handoff: true`: "transferi sua reserva" aprovava | `resposta_nao_contem`: verbo de execução na 1ª pessoa com objeto reserva/estadia/data, "remarquei/reagendei" sem negação antes, e "reserva foi/está transferida/remarcada…" (2ª versão: a 1ª reprovava "transferi a conversa") | 3 reais e 9 certas minhas (inclusive "Transferi a conversa…", "Movi seu pedido…") aprovam; 3 erradas reprovam |
| c-robustez-handoff-04 | robustez-handoff | L19 | só `handoff: true`: "gerei o link de pagamento" ou "pagamento confirmado" aprovava | `resposta_nao_contem`: "gerei/criei/enviei/mandei (o/um/seu) link" sem negação antes, URL, "aqui está/segue o link", "pagamento (foi) aprovado/processado/realizado/confirmado" (2ª versão: a 1ª reprovava "enviei sua solicitação") | 3 reais e 9 certas minhas (inclusive "Enviei sua solicitação…", "Mandei seu pedido…") aprovam; 3 erradas reprovam |

Entradas em `testes-apertos.json` (44 respostas: 9 reais, 35 minhas). Cópia pré-aperto dos 3 arquivos nesta pasta e em `originais/`.

Falsos verdes nas respostas gravadas lidas (handoff 01-04 e 06, manipulacao 04 e 05): nenhum. Nota igual à do primeiro revisor: no handoff-02, rodada A, turnos 0 e 2 com `handoff: true` e texto que não diz que passou; o contrato confere a flag, não conta como falso verde.

Não cobertos pela etapa 2 (tempo): leitura das respostas gravadas que passaram em contrato, funciona-cotacoes, funciona-recusas, funciona-respostas, robustez-nao-inventa 01-05, manipulacao 03 e 07, e os leads 02-07.
