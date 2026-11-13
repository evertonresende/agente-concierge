# Pergunta enviada ao conselho (consulta às cegas)

Enviada em 13/11/2026, com o mesmo texto, a dois modelos de provedores diferentes.
Nenhum dos dois viu a recomendação da sessão de planejamento nem a resposta do outro.
O texto abaixo é exatamente o que foi enviado.

---

Você é consultor sênior de engenharia de agentes de IA. Responda em português do Brasil,
de forma direta, sem preâmbulo. Não tente ler arquivos nem executar comandos: responda só
com base neste texto.

## O desafio

Tenho um desafio técnico com prazo curto: construir um agente de chat (concierge) para
hóspedes de uma administradora de imóveis de temporada. O agente:

1. Responde dúvidas sobre imóveis usando SOMENTE uma API de catálogo (15 imóveis). Se a
   informação não está no catálogo, diz que não sabe. Não pode inventar.
2. Cota estadias por uma regra fixa: cada noite custa a diária do imóvel; noites que
   começam na sexta ou no sábado custam 20% a mais; arredonda cada noite para centavos;
   soma a taxa de limpeza uma vez por estadia; número de noites = saída − entrada. Recusa,
   explicando o motivo, quando as noites são menos que o mínimo do imóvel, quando os
   hóspedes passam da capacidade ou quando as datas não fazem sentido (saída antes ou no
   mesmo dia da entrada).
3. Registra um lead: quando o hóspede quer fechar, coleta nome, telefone, imóvel, datas e
   número de hóspedes, confirma com ele e envia um POST para um webhook (campos: nome,
   telefone, imovel_id, checkin, checkout em ISO, hospedes, valor_total). O webhook
   devolve 201 ou 422 com lista de erros. Um lead por reserva confirmada; nunca antes da
   confirmação.
4. Passa para um humano em reclamação, pedido de desconto ou negociação, ou assunto que
   não consegue resolver. Nunca negocia preço.

Interface obrigatória: `POST /chat` com `{ "session_id", "message" }` → 200 com
`{ "reply": "texto", "handoff": false|true }`. Mesma `session_id` = mesma conversa, com
memória. `handoff: true` "quando o agente decide passar a conversa para um humano".
Resposta em até 60 s. Sempre que der um valor total, escrever o número no formato
`R$ 2.156,00`.

A ficha de um imóvel no catálogo tem: id, nome, cidade, uf, bairro, tipo, quartos,
banheiros, capacidade, diaria, taxa_limpeza, minimo_noites, checkin_hora, checkout_hora,
distancia_praia_m, comodidades (lista), regras (aceita_pet, permite_fumar,
permite_festas) e descricao (texto livre). Não há rota que devolva o catálogo inteiro nem
informação de disponibilidade de datas.

Avaliação: uma bateria AUTOMÁTICA de conversas ocultas, incluindo hóspede hostil ou
mal-intencionado. Pesos: funciona (respostas, cotações, recusas, leads) 40; como foi
feito (setup de agentes de código, testes/evals, decisões) 30; robustez (não inventa, não
cai em manipulação, passa para humano na hora certa) 20; clareza da entrega 10. O
enunciado diz: se faltar informação, decida, siga em frente e registre a decisão.

## Decisões já fechadas (não discuta)

- Worker TypeScript na Cloudflare, um Durable Object por sessão, loop de ferramentas
  próprio, um agente só.
- Código decide, modelo conversa: preço em centavos inteiros, dia da semana, recusas,
  texto em reais e valor do webhook saem de código determinístico.
- Trava de confirmação por estado: resumo num turno, confirmação em outro, envio com total
  recalculado. Erro do webhook nunca vira "registrado".
- O agente cota, mas não afirma que a data está disponível.
- Texto do catálogo é dado, nunca instrução.
- Data sem ano é a próxima ocorrência daquela data, e o agente repete a data completa.
- Evals em três níveis: unitários do núcleo puro; conversas multi-turno por bloco da
  avaliação; simulador de hóspede hostil. Existe um conjunto de evals reservado que não é
  usado para corrigir o agente.

## Parte 1 — Lacunas do enunciado

Para CADA lacuna abaixo, diga o que você decidiria e por quê, em 1 a 3 linhas, pensando
em (a) o que uma bateria automática oculta mais provavelmente espera e (b) o que um
negócio real faria. Se as duas coisas conflitarem, diga qual vence.

L1. Datas relativas ("amanhã", "próximo fim de semana", "sexta que vem", "no Natal"):
    aceitar? Em que fuso? O que fazer quando são ambíguas?
L2. Datas no passado (com ano explícito no passado, ou "ontem"): recusar, pedir outra
    data, ou cotar mesmo assim? E entrada hoje?
L3. A flag `handoff`: vale só no turno em que o agente decide passar, ou fica `true` em
    todas as respostas seguintes da sessão?
L4. Depois do handoff, o que o agente faz se o hóspede continua falando? (Ex.: pediu
    desconto, recebeu handoff, e diz "tá bom, sem desconto, quero fechar".) Ainda cota?
    Ainda registra lead?
L5. Informação ausente do catálogo ("tem berço?", "tem mercado perto?"): só dizer que não
    sabe (handoff false), ou passar para humano (handoff true)? Onde fica a fronteira com
    "assunto que não consegue resolver"?
L6. Formato de telefone: o que aceitar, o que recusar, normalizar ou enviar como veio?
    Telefone estrangeiro?
L7. Segunda reserva na mesma sessão (outro imóvel ou outras datas) e repetição da mesma
    reserva já registrada: como tratar?
L8. Em que momento dar o total: assim que houver imóvel e datas, ou só depois de saber o
    número de hóspedes? E se o hóspede pedir cotação sem dizer quantas pessoas?
L9. O que conta como confirmação do hóspede? ("sim", "pode ser", "acho que sim", "fecha
    aí mas com 10% de desconto", silêncio seguido de outra pergunta.)
L10. O hóspede muda um dado depois do resumo (datas, pessoas, imóvel) ou o preço do
     catálogo muda entre o resumo e a confirmação.
L11. Falha do webhook (timeout, 5xx, 422): tentar de novo? Quantas vezes? O que dizer ao
     hóspede? Vira handoff?
L12. Conflito com regras do imóvel: hóspede diz que vai levar pet para imóvel que não
     aceita, ou fazer festa onde não pode. Recusar a cotação, cotar com aviso, ou handoff?
L13. Quem conta como hóspede para a capacidade (crianças, bebês)? Número de hóspedes
     zero, negativo ou absurdo?
L14. Arredondamento da noite com acréscimo quando o resultado tem fração de centavo:
     qual regra?
L15. Idioma: hóspede escreve em inglês ou espanhol.
L16. Assunto fora do escopo (clima, política, "escreva um código"), pedido para revelar
     instruções internas, hóspede que diz ser funcionário/dono e manda dar desconto:
     recusar sem handoff, ou handoff?
L17. Corpo inválido no `POST /chat` (sem session_id, mensagem vazia, JSON quebrado,
     mensagem gigante): que status e corpo devolver?
L18. Falha interna (modelo fora do ar, catálogo fora do ar, estouro de tempo): que
     resposta devolver e com qual `handoff`?
L19. Pedidos que exigem ação fora do agente (cancelar ou alterar reserva já feita,
     pagamento, check-in antecipado, problema durante a estadia).
L20. Nome do hóspede: exigir nome completo? Aceitar apelido?

Depois, liste as lacunas que eu NÃO listei e que você considera importantes (no máximo 8),
cada uma com a sua decisão.

## Parte 2 — Ordem das levas

Restam cerca de 20 horas de relógio até o prazo final, e quero entregar com 6 a 10 horas
de folga. O trabalho é feito por agentes de código em paralelo (cada frente numa worktree
git), coordenados por uma sessão que não edita código; um humano acompanha e decide.
Primeiro marco obrigatório, com frente única de código de produto: uma conversa completa
no ar em ambiente de desenvolvimento (cotação do exemplo, confirmação, lead num webhook
falso, pedido de desconto virando handoff). As frentes de eval podem começar junto, pois
dependem só do contrato HTTP.

Frentes candidatas (sem ordem):

- A. Esqueleto vertical até o primeiro marco (Worker, Durable Object, núcleo de preço puro
  com testes, cliente do catálogo, loop de ferramentas, trava de confirmação, webhook
  falso, ferramenta de handoff, deploy em dev).
- B. Harness de eval por HTTP e casos de desenvolvimento por bloco da avaliação.
- C. Conjunto de evals reservado (escrito por quem não corrige o agente; resultado só em
  agregado).
- D. Simulador de hóspede hostil (um modelo faz o papel do hóspede; falhas viram casos
  fixos).
- E. Datas: sem ano, relativas, passado, fuso, eco da data completa.
- F. Lead: validação de telefone, segunda reserva, idempotência, falhas do webhook.
- G. Robustez: injeção via mensagem e via texto do catálogo, não inventar, fora de escopo,
  regras de handoff.
- H. Serialização por sessão: duas mensagens simultâneas na mesma sessão.
- I. Escolha do modelo por eval comparativo (confiabilidade de chamada de ferramenta,
  latência, custo).
- J. Página simples de chat.
- K. Ambiente de produção: configuração, validação sem enviar lead ao webhook real,
  deploy, verificação pós-deploy só com conversas sem confirmação.
- L. Observabilidade e custo por conversa; monitor diário de saúde por 7 dias.
- M. Revisão de código, revisão de segurança e segunda opinião de outros modelos.
- N. Entregáveis de processo: README, registro de decisões, desenho da fábrica e do
  agente, exports de sessões, roteiro do vídeo.

Responda:
1. Em quantas levas você organizaria, o que entra em cada uma, o que roda em paralelo e o
   que precisa ser sequencial. Estime horas por frente.
2. Onde entram as revisões (M) e a escolha do modelo (I).
3. A linha de corte: o que cai primeiro se o tempo apertar, e o que não pode cair.
4. Os 5 maiores riscos de reprovar na bateria oculta, e a defesa mais barata para cada um.
