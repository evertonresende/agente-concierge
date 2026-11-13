# Resposta do Gemini — revisão do Marco 1

Pergunta: [`m1-pergunta.md`](m1-pergunta.md). Consulta às cegas em 13/11/2026, de uma pasta
vazia fora do repositório, com `agy -p "<pergunta>" --model gemini-4-hydrogen-high`.
Resposta inteira, sem edição.

---

### 1. Cálculo de preço

Nenhum defeito encontrado. O que foi conferido:

- **Centavos inteiros e arredondamento por noite:** `reaisParaCentavos` (`src/nucleo/dinheiro.ts`) converte com `Math.round(reais * 100)`; `diariaComAcrescimo` (`src/nucleo/preco.ts`) aplica `Math.floor((120 * diariaCentavos + 50) / 100)` exatamente conforme L14, multiplicando cada bloco de noites já em centavos inteiros antes de somar `taxaLimpezaCentavos`.
- **Noite que começa em sexta ou sábado e dia da semana civil:** `interpretarData`, `indiceDiaDaSemana`, `diasEntre` e `somarDias` (`src/nucleo/datas.ts`) operam em datas civis via `Date.UTC` / `T00:00:00Z` sem efeito de fuso ou horário de verão, rejeitando datas inexistentes (ex.: `30/02`) em `montar`. Em `cotar` (`src/nucleo/preco.ts`), `temAcrescimo` marca índices `5` (sexta) e `6` (sábado), e `Math.floor(noites / 7) * 2 + resto` contabiliza corretamente a partir da noite de `checkin` até a noite anterior ao `checkout` (no exemplo do contrato `GRM-301`, `15/01/2027` sexta a `18/01/2027` segunda resulta em `3` noites, `2` com acréscimo, total `215600` centavos → `"R$ 2.156,00"`).
- **Três recusas e limites exatos:** `cotar` (`src/nucleo/preco.ts`) recusa `noites <= 0` (`datas_invalidas`, diferenciando mesmo dia e saída anterior), `noites < regras.minimoNoites` (`minimo_noites`, aceitando igualdade), e quando `hospedes` é informado, recusa não inteiro ou `< 1` (`hospedes_invalido`) e `hospedes > regras.capacidade` (`capacidade`, aceitando igualdade).
- **Conversão para o webhook:** `corpoDoLead` (`src/lead.ts`) usa `centavosParaReais` (`src/nucleo/dinheiro.ts`), que valida inteiro não negativo e divide por `100` (`215600` → `2156`).

---

### 2. Trava de confirmação

Sobre o envio sem resumo/confirmação em turnos distintos e uso duplicado: conferido `confirmar` (`src/lead.ts`), `rodarTurno` (`src/agente/loop.ts`), `montarResumo` e `confirmarReserva` (`src/agente/ferramentas/lead.ts`). `confirmar` exige `pendente` prévio, verifica `turnoAtual <= pendente.turno` (`mesmo_turno`), reordena `confirmar_reserva` para o fim do lote em `rodarTurno` (ignorando-a se ferramenta anterior encerrou o turno com `respostaFinal`) e grava `envios[chave]` antes do POST (impedindo reuso da confirmação). Na mudança de dados, porém, há dois defeitos:

1. **Cotação inválida após resumo não invalida a confirmação pendente**
   - **Arquivo e trecho:** `src/agente/ferramentas/cotacao.ts`, em `cotarEstadia`, linhas iniciais:
     `const aberto = pendenteAberto(contexto.cofre.ler())?.reserva ?? null;`
     `const pedido = await prepararPedido(argumentos, contexto, aberto?.hospedes);`
     `if (!pedido.ok) return { paraOModelo: { erro: pedido.erro } };`
   - **Cenário que quebra:** Turno 1 mostra resumo válido de `GRM-301` (grava `pendente`). Turno 2: o hóspede pede alteração para uma data inexistente (`"30/02/2027"`), data incompleta ou imóvel não encontrado; o modelo chama `cotar`, `prepararPedido` retorna `{ ok: false }` e `cotarEstadia` sai antes de chamar `invalidarPendente(contexto.cofre)`, mantendo o `pendente` antigo ativo (diferente de `montarResumo`, que invalida quando `respostaFinal === undefined`). Se no Turno 3 houver um `"sim"`, o `confirmar_reserva` envia o lead da reserva anterior que o hóspede já havia alterado.
   - **Severidade:** Média.
   - **Correção:** Chamar `invalidarPendente(contexto.cofre)` também quando `!pedido.ok` em `cotarEstadia` (quando `aberto` existir).

2. **`montar_resumo` para reserva já registrada não invalida resumo pendente de outra reserva**
   - **Arquivo e trecho:** `src/agente/ferramentas/lead.ts`, em `montarResumo` (`if (resultado.respostaFinal === undefined) invalidarPendente(contexto.cofre);`) e `resumir` (`if (anterior === "registrado") return jaRegistrado(pendente);` / `if (anterior) return { ..., respostaFinal: INCERTO, handoff: true };`).
   - **Cenário que quebra:** Reserva A já foi registrada (`envios[A] = "registrado"`). Turno 2: hóspede monta resumo da Reserva B (`pendente = B`). Turno 3: hóspede pede para fechar de novo a Reserva A; `montar_resumo` entra em `resumir`, cai em `jaRegistrado` e retorna com `respostaFinal` preenchido, fazendo `montarResumo` pular `invalidarPendente`. O `pendente` da Reserva B continua ativo e uma confirmação no turno seguinte pode enviar a Reserva B.
   - **Severidade:** Média.
   - **Correção:** Chamar `invalidarPendente(contexto.cofre)` em `resumir` antes de retornar `jaRegistrado` ou `INCERTO` (ou sempre no início de `montarResumo` antes de `tentarResumir`).

*(Observação sobre mudança de `nome` ou `telefone` sem chamada de ferramenta: caso o hóspede altere nome/telefone em texto livre e o modelo chame `confirmar_reserva` diretamente sem chamar `montar_resumo`, não há validação no código porque os textos das mensagens não passam por parser fora das ferramentas.)*

---

### 3. POST do lead e idempotência

Conferidos: gravação síncrona de `"enviando"` em `cofre` sem `await` entre a checagem de `agora.envios[chave]` e `marcar(cofre, chave, "enviando")` (`src/lead.ts`); persistência em SQLite sobrevivendo a reinício do Durable Object no meio do POST; travamento de `cofre.salvar` via `turnoAberto = false` em `Sessao.processar` (`src/sessao.ts`) caso `comPrazo` (`rodarTurno`) expire durante o `fetch`; bloqueio por `ENVIO_LEADS !== "ligado"` e `destinoPermitido` antes de `recotar`/`marcar`/`postar` (seguindo L24); e política de tempo esgotado (`TEMPO_DO_WEBHOOK_MS = 10_000` em `postarLead`) retornando `motivo: "incerto"` → `INCERTO` + `handoff: true` sem retry e sem `GET`.

Defeitos encontrados:

1. **Ausência de nova tentativa para resposta `5xx` do webhook (regra L11)**
   - **Arquivo e trecho:** `src/lead.ts`, em `postarLead` e `confirmar`:
     `status = await deps.postar(...);`
     `if (status !== 201) { marcar(cofre, chave, "falhou"); return { tipo: "nao_registrado", motivo: "resposta" }; }`
   - **Cenário que quebra:** O hóspede confirma uma reserva válida e o webhook responde `503` (ou `500`/`502`). Em vez de executar a nova tentativa prevista em L11 ("`5xx`: uma nova tentativa; se persistir, diz que não conseguiu registrar, com `handoff: true`"), o código grava `"falhou"` na primeira resposta `503`, bloqueia a reserva e encerra com `handoff: true`.
   - **Severidade:** Alta.
   - **Correção:** Em `confirmar`, quando `status >= 500 && status < 600`, realizar exatamente uma nova chamada a `deps.postar` antes de marcar `"falhou"` e retornar `nao_registrado`.

2. **Resposta `422` descarta o corpo, nunca pede correção de campo e bloqueia a chave mesmo para mudança de `nome` (regra L11)**
   - **Arquivo e trecho:** `src/lead.ts`, em `postarLead` (`await resposta.body?.cancel(); return resposta.status;`), em `confirmar` (`if (status !== 201) { marcar(cofre, chave, "falhou"); ... }`) e `src/agente/ferramentas/lead.ts`, em `resumir` (`if (anterior) return { paraOModelo: { nao_registrado: true }, respostaFinal: INCERTO, handoff: true };`).
   - **Cenário que quebra:** O hóspede informa o nome `"A"` ou telefone inválido e confirma; o webhook responde `422` com JSON apontando o campo `nome` (ou `telefone`). `postarLead` cancela o corpo sem lê-lo, `confirmar` marca `envios[chave] = "falhou"` e `confirmarReserva` dispara `handoff: true` sem pedir a correção nem refazer o resumo como exige L11. Além disso, se o campo apontado for `nome` (ausente de `chaveDaReserva`), a marcação `"falhou"` impede qualquer novo `montar_resumo` posterior para o mesmo imóvel/datas/hóspedes/telefone.
   - **Severidade:** Alta.
   - **Correção:** Retornar também o corpo nas respostas `422` em `postarLead`, não gravar `"falhou"` em `envios[chave]` no `422` e, caso o corpo aponte um campo corrigível, solicitar a correção ao hóspede sem `handoff`.

3. **Rejeição de `Promise` não tratada quando `comPrazo` estoura durante o `POST`**
   - **Arquivo e trecho:** `src/sessao.ts`, em `Sessao.processar` (`if (!turnoAberto) throw new Error("turno encerrado");`) combinado com `src/lead.ts`, em `confirmar` (`marcar(cofre, chave, "registrado")` / `"falhou"` após `await deps.postar(...)`).
   - **Cenário que quebra:** O loop já consumiu 40 s no modelo (`ORCAMENTO_MS = 45_000`) e inicia `confirmar_reserva`; após 5 s aguardando `deps.postar` (cujo timeout próprio é 10 s), `comPrazo` em `rodarTurno` rejeita, `Sessao.processar` termina o turno com `CONTINGENCIA` e define `turnoAberto = false`. Quando `deps.postar` resolve ou rejeita aos 6 s, `confirmar` chama `marcar(...)` → `cofre.salvar(...)`, lançando `Error("turno encerrado")` dentro de uma promise abandonada sem `.catch()`. (A idempotência continua preservada porque `"enviando"` permanece no SQLite.)
   - **Severidade:** Baixa.
   - **Correção:** Envolver as chamadas pós-`await` de `marcar` em `confirmar` (ou retornar sem lançar quando `!turnoAberto` após já ter encerrado o turno) ou capturar a rejeição da promise abandonada em `comPrazo`.

---

### 4. Fila por sessão

Nenhum defeito de serialização, recuperação de erro ou duplicação de lead encontrado. O que foi conferido:

- **Serialização e ordem de chegada:** Em `Sessao.conversar` (`src/sessao.ts`), `const vez = this.fila.then(() => this.processar(mensagem, chegada));` e `this.fila = vez.catch(() => undefined);` atualizam `this.fila` de forma síncrona antes de retornar, garantindo que chamadas simultâneas à mesma sessão no Durable Object executem `processar` estritamente uma por vez e na ordem de chegada em `conversar`. *(Nota de comportamento documentado: como `chegada` em `src/index.ts` é capturado antes da fila e `prazo = chegada + ORCAMENTO_MS`, se a primeira mensagem consumir todo o orçamento de 45 s, a segunda mensagem enfileirada entra em `rodarTurno` com prazo esgotado e retorna `CONTINGENCIA` imediatamente.)*
- **Erro não trava nem fura a fila:** Como `this.fila` recebe `vez.catch(() => undefined)`, uma rejeição em `processar` propaga apenas para a promise `vez` do chamador que falhou (tratada em `chat` em `src/index.ts`), enquanto `this.fila` resolve para `undefined` e libera a execução da próxima mensagem na ordem correta.
- **Duas confirmações simultâneas:** Além de a fila do Durable Object impedir que a segunda mensagem comece `processar` antes do término completo da primeira (quando o estado `"registrado"` ou `"falhou"` já foi persistido), `confirmar` (`src/lead.ts`) verifica `agora.envios[chave]` e grava `marcar(cofre, chave, "enviando")` de forma síncrona, sem nenhum `await` intermediário, antes de iniciar `deps.postar`.

