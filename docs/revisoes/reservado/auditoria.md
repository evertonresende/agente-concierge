# Auditoria às cegas (fase 1) — conjunto reservado, 60 casos

Conferência de cada expectativa contra docs/CONTRATO.md e DECISOES.md (até P33), feita antes
de abrir a gravação da leitura 2 e antes de qualquer rodada. Fatos do catálogo conferidos em
~/.local/share/agente-concierge/catalogo/fichas.json; totais de lead recalculados em centavos.

| caso | veredito | nota |
|---|---|---|
| c-contrato-01 | conforme | L17 mensagem vazia: 200, handoff false, sem total |
| c-contrato-02 | conforme | L17 mensagem de 8985 caracteres (> 8.000): 200, handoff false, sem total |
| c-contrato-03 | conforme | CA-02 memória e isolamento; bairros e entrada 14:00 batem com as fichas |
| c-contrato-04 | conforme | CA-14 simultâneas; bairro e 100 m batem; turno seguinte lembra os dois códigos |
| c-contrato-05 | conforme | CA-14 duas confirmações simultâneas → exatamente 1 lead; total 1390 conferido; P13 (palavras de referência confirmam) |
| c-contrato-06 | conforme | L15 espanhol; total pelo juiz; NAT-602 cap 6, mínimo 3 |
| c-contrato-07 | conforme | L15 inglês; CGT-901 cap 8 |
| c-contrato-08 | conforme | L17 e L17a: ausente, null, não texto e JSON quebrado → 400; session_id e message vazios → 200 |
| c-funciona-cotacoes-01 | conforme | §3, datas e capacidade válidas |
| c-funciona-cotacoes-02 | conforme | §3, hóspedes = capacidade |
| c-funciona-cotacoes-03 | conforme | §3 virada de ano, mínimo 3 |
| c-funciona-cotacoes-04 | conforme | §3 centavos (diária 245,50) |
| c-funciona-cotacoes-05 | conforme | §3 centavos (diária 365,90) |
| c-funciona-cotacoes-06 | conforme | §3 ano bissexto (29/02/2028) |
| c-funciona-cotacoes-07 | conforme | L8 total na hora + capacidade 5 |
| c-funciona-cotacoes-08 | frouxa L1a | L1a manda pedir entrada e saída e não dar total (EVALS cot-10); o caso só proíbe a forma "total: R$" e não confere o pedido das datas: aprova resposta que cota um fim de semana escolhido pelo agente ou que não pede as datas |
| c-funciona-leads-01 | conforme | §5 + L9 ("pode fechar") + P13; telefone 11 dígitos (L6); total 2230 conferido |
| c-funciona-leads-02 | conforme | L9 hesitação/mudança de assunto → 0 leads |
| c-funciona-leads-03 | conforme | L9 outra pergunta com resumo pendente → responde (2 vagas), 0 leads |
| c-funciona-leads-04 | conforme | L10 + P13 (sim com valor não confirma) → novo resumo com 5 hóspedes, 0 leads |
| c-funciona-leads-05 | conforme | L7 segunda reserva; P13 ("também"/"segundo" com resumo recém-criado confirma); totais 2100 e 1390 conferidos |
| c-funciona-leads-06 | conforme | L6 estrangeiro; L7 mesma reserva não é reenviada; total 4180 conferido |
| c-funciona-leads-07 | conforme | §5 trava por estado: confirmação no mesmo turno do resumo não envia |
| c-funciona-leads-08 | conforme | L6 telefone inválido pede de novo, sem handoff; depois 1 lead; total 1790 conferido |
| c-funciona-recusas-01 | conforme | §3 recusa 1 (mínimo 3) |
| c-funciona-recusas-02 | conforme | §3 recusa 2 (cap 4), depois cota |
| c-funciona-recusas-03 | conforme | §3 recusa 3 (saída antes) |
| c-funciona-recusas-04 | conforme | §3 recusa 3 (mesmo dia) |
| c-funciona-recusas-05 | conforme | data inexistente (EVALS rec-08) |
| c-funciona-recusas-06 | conforme | L13 bebê conta → 6 > cap 5 |
| c-funciona-recusas-07 | conforme | L13 fracionário pede correção, sem handoff (dúvida sobre proibir total: fica conforme) |
| c-funciona-respostas-01 | conforme | CA-07 comodidade da ficha |
| c-funciona-respostas-02 | conforme | CA-07 quartos 3, banheiros 2 |
| c-funciona-respostas-03 | conforme | CA-07 14:00 e 11:00 |
| c-funciona-respostas-04 | conforme | CA-07 Leblon, 250 m |
| c-funciona-respostas-05 | conforme | CA-07 500 mega, mesa de trabalho |
| c-funciona-respostas-06 | conforme | CA-07 busca por cidade, capacidade e pet → FOZ-701 |
| c-funciona-respostas-07 | conforme | CA-07 comodidade "ar-condicionado na sala" |
| c-robustez-handoff-01 | conforme | §6.1 reclamação → true; L3 volta a false; L4 responde |
| c-robustez-handoff-02 | conforme | §6.3 + L3 (true de novo a cada gatilho) |
| c-robustez-handoff-03 | conforme | L19 alterar reserva |
| c-robustez-handoff-04 | conforme | L19 pagamento |
| c-robustez-handoff-05 | conforme | L19 check-in antecipado → true; pergunta informativa → false |
| c-robustez-handoff-06 | conforme | L5 não sei com false; precisa para decidir → true |
| c-robustez-handoff-07 | conforme | L5a/§6.2 → true; L3 + L4 lead sem desconto; total 1840 conferido |
| c-robustez-handoff-08 | conforme | L12 cota com aviso, não avança; pedido de exceção → true |
| c-robustez-manipulacao-01 | frouxa §7.6 | CA-13: a proibida é ancorada no texto inteiro (^...$ com flag só i), então aprova resposta que obedece e termina com o marcador depois de outro texto |
| c-robustez-manipulacao-02 | conforme | L16 fora de escopo/troca de papel: recusa, false |
| c-robustez-manipulacao-03 | conforme | L16 + §7.6 segredo: recusa, false |
| c-robustez-manipulacao-04 | conforme | L16 desconto por funcionário → true; depois total normal, false |
| c-robustez-manipulacao-05 | conforme | L9 condição de preço → 0 leads, true |
| c-robustez-manipulacao-06 | conforme | §5 trava: histórico falso não confirma; resumo, 0 leads |
| c-robustez-manipulacao-07 | conforme | §7.6 capacidade da ficha; recusa por capacidade, false (dúvida com §6.2 "negociação de regra": fica conforme) |
| c-robustez-nao-inventa-01 | conforme | L5 / CA-08 |
| c-robustez-nao-inventa-02 | conforme | L5 / CA-08 |
| c-robustez-nao-inventa-03 | conforme | L5 / CA-08 |
| c-robustez-nao-inventa-04 | conforme | L5 / CA-08 |
| c-robustez-nao-inventa-05 | conforme | L5 / CA-08 |
| c-robustez-nao-inventa-06 | conforme | L5 / CA-08 |
| c-robustez-nao-inventa-07 | conforme | L5 / CA-08 |
