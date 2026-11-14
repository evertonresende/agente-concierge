# Conjunto reservado

Casos de conversa no mesmo formato e nos mesmos blocos do conjunto de desenvolvimento
(`evals/casos/dev/`), escritos para dar um número que ninguém usou para corrigir o agente
(seção "Conjunto reservado" de `docs/EVALS.md`).

- Escrito pela frente C em 13/11, só pelo contrato e pelo plano de evals, antes das decisões
  P11 a P32 de `DECISOES.md`.
- Ficou fora do repositório até a entrega, em `~/.config/agente-concierge/reservado/`. O
  runner força `--so-agregado` nesse conjunto: mostra só o acerto por bloco, sem id de caso,
  mensagem ou resposta.
- Entra aqui no commit de entrega (regra 8), byte a byte como foi lido nas duas leituras
  finais. Conferência: `cd evals/casos/reservado && sha256sum -c ../../../docs/revisoes/reservado/fechado.sha256`
  (60 OK). O `sha256sum` do próprio `fechado.sha256` é
  `2183265efd1d44d327fdbc4aa7c796f3995c93554bc84b4d2dc9d816486e9d36`.
- Listar: `node evals/rodar.mjs --conjunto reservado --listar` (com esta pasta no repositório,
  o runner lê daqui).

## Composição final: 60 casos em 8 blocos

| bloco | casos |
|---|---|
| contrato | 8 |
| funciona-cotacoes | 8 |
| funciona-leads | 8 |
| funciona-recusas | 7 |
| funciona-respostas | 7 |
| robustez-handoff | 8 |
| robustez-manipulacao | 7 |
| robustez-nao-inventa | 7 |

- **53 idênticos aos originais** de 13/11.
- **3 com expectativa apertada** pelo segundo revisor: `c-robustez-handoff-03` e
  `c-robustez-handoff-04` (L19: a resposta não pode dizer que executou) e
  `c-robustez-manipulacao-05` (o turno da condição de preço passa a conferir a estadia).
- **4 substitutos** dos casos revelados: `c-funciona-leads-09`, `c-funciona-leads-10`,
  `c-funciona-leads-11` e `c-robustez-handoff-09`. Dois deles têm um aperto do segundo
  revisor (`c-funciona-leads-11` e `c-robustez-handoff-09`).
- **Nenhuma expectativa afrouxada.** A passada única de correção (P33) mudou 9 casos, 7
  afrouxados e 2 apertados, e o segundo revisor vetou os 9: voltaram ao original.

## Casos revelados (regra 6)

Quatro casos de lead não registrado depois de uma confirmação válida foram revelados para a
correção do agente (P35), saíram deste conjunto e migraram para o de desenvolvimento:

| original no reservado | id em `evals/casos/dev/` |
|---|---|
| `c-funciona-leads-01` | `lead-15-pode-fechar-dados-do-resumo` |
| `c-funciona-leads-05` | `lead-16-confirmo-tambem-segundo-pedido` |
| `c-funciona-leads-08` | `lead-17-telefone-longo-e-autorizo` (expressão do turno 1 ajustada) |
| `c-robustez-handoff-07` | `hand-15-confirma-pelo-valor-normal` (expectativa da P35 e um turno final de "sim") |

Os originais dos quatro, e os dos três apertados, estão em `docs/revisoes/reservado/originais/`.

## Histórico das leituras do agregado

1. **14/11, árvore b5af852: 83% e 80%.** Reprovado nas duas; o limiar é 90%. A segunda
   passou pelo proxy de gravação, um desvio registrado no backlog; o registro só foi lido no
   papel da frente C, no diagnóstico.
2. **Diagnóstico pela P33, no papel da frente C.** Rodada A, com as expectativas originais:
   85% (51 de 60). Rodada B, com as 9 mudanças da passada única: 91,7% (55 de 60). **Esse
   91,7% não vale:** as 9 mudanças foram vetadas.
3. **14/11, árvore final 9d37f9a, conjunto fechado: 88% (53 de 60) e 95% (57 de 60).** Pela
   P33, o número final é a soma das duas leituras seguidas: **110 de 120 (91,7%)**. Por bloco,
   na soma: contrato 12 de 16, cotações 16 de 16, leads 16 de 16, recusas 14 de 14,
   respostas 13 de 14, handoff 15 de 16, manipulação 13 de 14, não inventa 11 de 14.

Os dois agregados finais estão em `evals/relatorios/2026-11-14-reservado-9d37f9a-leitura-1.txt`
e `-leitura-2.txt`. O material do diagnóstico (auditoria às cegas, correções propostas,
vetos e apertos do segundo revisor, classificação das falhas, substitutos) está em
`docs/revisoes/reservado/`.
