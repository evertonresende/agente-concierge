# Etapa 4: substitutos (segundo revisor; não reescrevo)

Totais conferidos com o juiz do export (centavos): 1.198,00; 1.030,00; 811,50; 930,00. Todos batem. Capacidades e mínimos dentro de `tarifas.json`.

| substituto | contrato (duas direções) | paráfrase do retirado? | veredito |
|---|---|---|---|
| c-funciona-leads-09 | ok: L13 (criança conta, 3 = capacidade), L6, L9 "confirmo", P13 "esse resumo", P15 interjeição | sim: mesmo fluxo de 2 turnos do leads-01, mesmo formato de telefone, e o turno medido é a mesma confirmação ("confirmo" + referência ao resumo) com outras palavras | contestado (EVALS regra 6) |
| c-funciona-leads-10 | ok: L15 (resumo fixo em inglês, total em R$), P15 "all correct", "please confirm" | não | em ordem |
| c-funciona-leads-11 | P19 e L9 ok, mas a expressão da resposta à dúvida só aceita "11:00" e "11h": "11 horas", "11 da manhã" e "às onze" reprovam (testado, `t-l11.json`). Exige mais que o contrato (L9: responde à pergunta). Horário da ficha não conferido (ficha fora do export) | não | contestado (L9) |
| c-robustez-handoff-09 | L3, L4, P15 + "pode fechar" (L9) + P13 ok; o turno 0 só confere `handoff`, a mesma frouxidão de L19 apertada no handoff-03 e no 04 | sim: mesmo roteiro de 3 turnos do handoff-07 (gatilho → desiste "no normal" → resumo → confirma "pode … o pedido"), só troca o gatilho | contestado (EVALS regra 6; L19) |

## Rodada 2 (reescritos às 04:15)

| substituto | veredito | motivo |
|---|---|---|
| c-funciona-leads-09 | contestado | paráfrase (EVALS regra 6): percurso novo (3 turnos) e total certo (1.704,96), mas o turno medido repete a construção do retirado: "pode fechar" + referência aos "dados" ("Quero sim, pode fechar com esses dados." x "Pode fechar, confirmo os dados do resumo.") |
| c-funciona-leads-11 | em ordem depois de aperto | a expressão da hora saiu (fim do excede), mas o turno passou a aprovar resposta que ignora a pergunta (L9: "responde"). Aperto: `resposta_contem` exige menção à saída (saída/sair/sai/check-out/deixar), sem fixar hora (ficha fora do export). 6 certas aprovam, 3 erradas reprovam |
| c-robustez-handoff-09 | em ordem depois de aperto | cenário novo (problema durante a estadia, outra viagem, BMB-202, total 4.920,00 certo, mínimo e capacidade ok). Frouxidão de L19 resolvida em parte: "liguei para o encanador" e "já está combinado" aprovavam. Aperto: 3ª proibida com liguei/telefonei/combinei sem negação antes e "já está combinado/agendado/marcado". 8 certas aprovam, 6 erradas reprovam |

## Rodada 3 (turno medido reescrito às 04:25)

| c-funciona-leads-09 | em ordem | confirmação "Isso aí, manda ver essa reserva!": duas formas da P15 + referência da P13, sem "confirmo", "pode fechar", "encaminhar" nem referência a "dados"/"resumo" dos retirados; expectativa (1 lead, handoff false) dentro da L9/P13/P15. Sem aperto |
