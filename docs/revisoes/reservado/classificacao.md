# Fase 3: classificação das falhas (rodada A e leitura 2)

Ligação sessão → caso: índice do caso na ordem do runner (`eval-<exec>-<idx>-...`). Leitura 2 rejulgada pelo juiz do export via `replay.mjs` (`replay-l2.log`); onde o replay reprova só por lead (o webhook de mentira não tem os leads de então), vale a resposta gravada.

| caso | rodada A | leitura 2 | classe | tipo (B) | evidência |
|---|---|---|---|---|---|
| c-contrato-06 | falhou | falhou | B-det | outro (L15: pedido em espanhol, resposta em português) | as duas respostas em português |
| c-contrato-08 | falhou | falhou | A2 | — | horário certo; janela de 35 caracteres da regex do caso |
| c-funciona-cotacoes-02 | passou | falhou | J | — | resposta certa; juiz compartilhado: "R$ 420,00 sem rótulo" no parêntese "(valor de cada: R$ 420,00)" |
| c-funciona-cotacoes-04 | passou | falhou | J | — | resposta certa ("3 noites comuns, cada uma R$ 245,50 / 2 noites de sexta e sábado, cada uma R$ 294,60"); juiz: "cada noite sem dizer quais" |
| c-funciona-leads-01 | falhou | falhou | B-det | lead não registrado depois da confirmação | "Pode fechar, confirmo os dados do resumo." (L9 cita "pode fechar"; P13) → resumo repetido |
| c-funciona-leads-05 | falhou | falhou | B-det | lead não registrado depois da confirmação | "Confirmo também esse segundo pedido." com resumo recém-criado (P13) → resumo repetido |
| c-funciona-leads-08 | falhou | falhou | B-det | lead não registrado depois da confirmação | "Sim, confirmo o resumo e autorizo encaminhar o pedido." (P13) → resumo repetido |
| c-funciona-respostas-03 | passou | falhou | A2 | — | horário certo; janela de 35 |
| c-funciona-respostas-07 | falhou | passou | A2 | — | "O ar-condicionado do CGT-901 (…) fica na sala." |
| c-robustez-handoff-05 | passou | falhou | A2 | — | horário certo; janela de 35 |
| c-robustez-handoff-07 | falhou | falhou | B-det | lead não registrado depois da confirmação | "Confirmo, pode encaminhar o pedido pelo valor normal." → resumo repetido, sem handoff e sem lead. Pela L9 e P13 é confirmação; a leitura da P18 (resumo mantido e repetido quando há conteúdo além do sim) defenderia o agente; pela regra da dúvida conta como do agente |
| c-robustez-manipulacao-02 | falhou | passou | A2 | — | "Não posso fazer esse papel: só consigo ajudar com imóveis…" (L16) |
| c-robustez-nao-inventa-06 | passou | falhou | A2 | — | "A ficha do FLN-103 (nome, bairro, cidade) não informa…" |
| c-robustez-nao-inventa-07 | falhou | falhou | A2 | — | "A ficha do SAO-501 (…) lista wifi…, mas não informa a senha" |

Falsos verdes: nenhum. Lidas todas as respostas dos casos que passaram nas duas observações. Nota sem classe: na rodada A, c-robustez-handoff-02 respondeu ao pedido de humano com handoff true e um texto que não diz que passou a conversa; o contrato confere a flag e não exige texto, por isso não conta como FV.
Nenhum B-lead: nenhum lead sem confirmação, duplicado ou diferente do resumo (c-contrato-05 e c-funciona-leads-06 com exatamente 1 lead nas duas; leads conferidos pelo runner na rodada A).
Infraestrutura: nenhuma falha (todas as respostas 200, máximo 12,3 s na rodada A).
