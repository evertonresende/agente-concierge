# Resposta do GPT — revisão do Marco 1

Pergunta: [`m1-pergunta.md`](m1-pergunta.md). Consulta às cegas em 13/11/2026, de uma pasta
vazia fora do repositório, com `codex exec -m gpt-6-astra --skip-git-repo-check -s read-only -`
(pergunta pela entrada padrão). Resposta inteira, sem edição.

---

1. **Crítica — O POST não exige um “sim” validado pelo código.**

   **Arquivo e trecho:** `src/agente/ferramentas/lead.ts`, `confirmarReserva`, e `src/lead.ts`, `confirmar`: a única verificação do turno é `turnoAtual <= pendente.turno`; a mensagem do hóspede nem chega à função.

   **Cenário:** o turno 1 apresenta o resumo; no turno 2 o hóspede escreve “acho que sim”, “tem piscina?” ou “sim, se fizer por R$ 2.000”. Se o modelo chamar `confirmar_reserva`, o código envia o POST normalmente. A descrição da ferramenta orienta o modelo, mas não impede esse caminho. Uma alteração de nome ou telefone também pode ser ignorada se o modelo chamar diretamente a confirmação.

   **Correção:** exigir uma autorização vinculada ao resumo vigente, produzida pela validação da mensagem atual, bloqueando hesitação, perguntas, condições e mudanças de dados antes de executar a confirmação.

2. **Alta — Uma alteração inválida pode deixar o resumo antigo confirmável.**

   **Arquivo e trecho:** `src/agente/ferramentas/cotacao.ts`, `if (!pedido.ok) return ...`, antes de `invalidarPendente`; `src/agente/ferramentas/lead.ts`, invalidação somente depois de `await tentarResumir(...)`.

   **Cenário:** existe resumo para 15–18/01/2027; o hóspede muda a entrada para `31/02/2027`. A ferramenta `cotar` recebe essa data, `prepararPedido` devolve erro e o resumo de janeiro permanece pendente. Um “sim” posterior pode enviar janeiro. Se a leitura do catálogo lançar durante uma tentativa de montar o resumo alterado, a invalidação também não acontece.

   **Correção:** invalidar o resumo anterior antes dos retornos de erro e das operações assíncronas de uma alteração, mantendo-o invalidado quando os novos dados não puderem ser validados.

3. **Alta — Um resumo pode ficar autorizável sem ter sido devolvido ao hóspede.**

   **Arquivo e trecho:** `src/agente/ferramentas/lead.ts`, `apresentarResumo(...)` antes do retorno de `textoDoResumo(...)`; `src/sessao.ts`, gravação do histórico em `transactionSync` posterior à gravação do estado do lead.

   **Cenário:** `apresentarResumo` persiste o pendente; depois, a transação que salva o histórico falha. `src/index.ts` devolve a contingência, não o resumo, mas o pendente continua salvo. Na próxima mensagem, uma chamada a `confirmar_reserva` pode enviar esse pedido. Um reinício entre a persistência do pendente e a devolução do resumo abre a mesma janela.

   **Correção:** vincular a elegibilidade do pendente à conclusão persistida do turno com aquela resposta de resumo e impedir a confirmação de pendentes pertencentes a turnos incompletos.

4. **Alta — Falta a segunda tentativa exigida para `5xx`.**

   **Arquivo e trecho:** `src/lead.ts`, `if (status !== 201) { marcar(..., "falhou"); return ...; }`.

   **Cenário:** o primeiro POST recebe `503`; uma segunda tentativa receberia `201`. O código faz apenas uma tentativa, marca a reserva como falha e bloqueia todos os envios posteriores dessa chave, contrariando L11.

   **Correção:** permitir exatamente uma repetição para resposta HTTP `5xx`, mantendo a reserva protegida contra confirmações concorrentes e sem repetir quando o resultado for incerto.

5. **Média — O tratamento de `422` descarta a informação necessária para corrigir o pedido.**

   **Arquivo e trecho:** `src/lead.ts`, `postarLead`, em `await resposta.body?.cancel()` e no retorno somente do status; `confirmar`, que transforma qualquer não `201` em `"falhou"`.

   **Cenário:** o webhook responde `422` com um erro que identifica `nome`. O corpo é descartado e o agente encaminha para humano, sem pedir a correção. Mesmo que o nome seja corrigido depois, a chave da reserva não inclui nome, então `resumir` encontra o marcador anterior e impede o novo resumo/envio.

   **Correção:** preservar e interpretar defensivamente os erros de `422`, permitindo correção seguida de novo resumo e confirmação quando houver campo identificável, e usando handoff quando não houver.

6. **Média — A fila preserva a ordem de entrada no objeto, não necessariamente a chegada ao `/chat`.**

   **Arquivo e trecho:** `src/index.ts`, `await pedido.json()` antes de `conversar(message, chegada)`; `src/sessao.ts`, `this.fila.then(...)`, que não usa `chegada` para ordenar.

   **Cenário:** a requisição A chega primeiro com uma alteração de datas, mas seu corpo demora a ser recebido; B chega depois com “sim”, termina de carregar primeiro e entra antes no objeto. B pode confirmar o resumo antigo antes de A invalidá-lo.

   **Correção:** estabelecer uma sequência de mensagens por sessão na entrada e processá-la nessa ordem, incluindo o tratamento de mensagens anteriores ainda não recebidas integralmente.

7. **Cálculo de preço — sem defeito identificado para entradas válidas nos trechos fornecidos.**

   Conferi a exclusão da noite do checkout, sexta/sábado pelo início da noite, calendário UTC sem efeito de horário de verão, arredondamento antes da soma e limpeza uma única vez. Os limites usam corretamente `noites < minimoNoites`, `hospedes > capacidade` e `noites <= 0`.

   Em verificação isolada das expressões, o exemplo resultou em `215600` centavos, a diária de `24550` resultou em `29460`, e a contagem otimizada coincidiu com a contagem noite a noite em 693 combinações. A conversão final produz o número `2156`; JSON não precisa preservar os zeros de `2156.00`. A validação da entrada monetária do catálogo não pode ser conferida integralmente porque `regrasDaFicha` não foi fornecida.

8. **Demais verificações de envio e fila.**

   O marcador `"enviando"` é gravado antes do POST. Uma confirmação repetida da mesma chave encontra o marcador e não reenvia; reinício com esse marcador persistido também bloqueia reenvio. Timeout ou erro de rede não provoca repetição nem GET. `ENVIO_LEADS` diferente de `"ligado"` bloqueia o POST e produz handoff. Somente `201` leva ao resultado `"registrado"`.

   Dentro de uma instância de `Sessao`, a corrente de promises serializa as chamadas na ordem em que entram em `conversar`; a rejeição de uma não bloqueia a próxima. Duas confirmações simultâneas da mesma reserva não geram dois POSTs nesse caminho. A fila é apenas em memória: os trechos não oferecem recuperação de mensagens que estavam aguardando quando o objeto reinicia.
