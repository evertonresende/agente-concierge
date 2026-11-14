# Rascunho: cortes e o que faria com mais tempo

Rascunho da frente N para duas seções do `DECISOES.md`. A coordenadora revisa e leva o
texto para lá; depois este arquivo sai. Fontes: o log do
[backlog](exploracoes/BACKLOG-CONCIERGE-2026-11.md), o [`DECISOES.md`](../DECISOES.md) e a
lista de limites do [README](../README.md). Itens que dependem do fim da leva 2 estão
marcados: a preencher.
<!-- PREENCHER: estado final dos cortes depois da leva 2 (monitor diário, G, H, P20, P21) -->

## Cortes: o que ficou de fora e por quê

| # | Ficou de fora | Por quê | Fonte |
|---|---|---|---|
| 1 | Juiz de decisão (segundo modelo) para handoff e confirmação | Mais uma chamada por pedido só se justificava se os evals desses dois pontos falhassem depois da leva 2. A trava de confirmação foi resolvida em código (F) e o handoff pela chamada focada ao modelo (P17) | X11 |
| 2 | Rede de palavras que liga `handoff` por código | Em duas rodadas do verificador, ela passou mensagens comuns para humano com recusa pronta; corrigir lista de palavras já tinha falhado. Ficou a chamada focada ao modelo, com o custo declarado nos limites | P17 |
| 3 | Fechar mudança misturada com pergunta só pelo texto do hóspede | Falhou em duas rodadas do verificador. Ficou o sinal exato da pergunta do próprio agente e uma pergunta fechada ao modelo | P18 |
| 4 | Candidato da OpenAI com chave própria | Ordem do Éverton: a chave deixou de ser usada. A ligação feita antes da ordem foi desfeita e ficou no histórico | X16, X18 |
| 5 | Modelo GPT pelo AI Gateway com crédito da plataforma | A conta não tinha crédito do gateway (402) e ninguém comprou crédito | X17, X19 |
| 6 | `gpt-oss-120b` como principal ou como último nível de reserva | O Éverton quis um modelo mais recente e não quis um terceiro nível | X19, X21 |
| 7 | Nível de raciocínio muito alto | Não ganhou acerto sobre o alto e dobrou o p95 | X24 |
| 8 | Limite de taxa no gateway de `producao` | Revogado antes de aplicar: o Éverton resolveu o limite de gasto na conta do provedor do modelo | P23, X29 |
| 9 | Endereço padrão do Worker como URL de entrega | A plataforma barra nele alguns clientes HTTP, e isso não se desliga. A entrega usa o hostname próprio, por rota do Worker, sem escrita no DNS | X28, P22 |
| 10 | "Fim de semana" sem datas e "dia 15" sem mês | Adivinhar a convenção ou o mês erra a estadia e o preço; o agente pede as datas | L1a, P6 |
| 11 | Textos fixos em outros idiomas além de português e inglês | Outro idioma recebe o texto fixo em português; o modelo nunca reescreve o resumo | L15 |
| 12 | Saída sem ano a mais de 90 noites da entrada | Um erro de digitação comum virava cotação de quase um ano; o código recusa e pede as datas com o ano | P21 (em verificação) |
| 13 | Monitor diário de saúde | Segundo item da linha de corte do backlog; estado final: a preencher | backlog, linha de corte |
| 14 | Exports de sessão do Gemini por linha de comando | O programa guarda as conversas num banco próprio, sem formato de mensagem. As respostas do conselho estão inteiras em `docs/conselho/` | X29 |

## O que faria com mais tempo

1. **Mais rodadas por modelo e por nível.** Entre duas rodadas do mesmo nível, 13 de 98
   casos trocaram de resultado, e o nível alto teve uma rodada só. Mais rodadas dariam
   intervalo para cada número.
2. **CHECK no runtime real automatizado.** Defeitos que o vitest não pega (o Worker que não
   subia, o `fetch` recusado como método de objeto) só apareceram no runtime real. Uma
   rodada curta contra o servidor local entraria no gate de merge.
3. **Conferência com papel próprio.** Hoje o pedido de correção chega ao modelo como texto
   de usuário, no nível do hóspede. Com mais tempo, testaria formas de o modelo distinguir
   as duas origens.
4. **Handoff sem depender só do modelo.** Uma rede de código para o pedido explícito de
   humano, com bateria negativa de mensagens comuns antes de entrar, seguindo o princípio
   da P17 (precisão antes de cobertura).
5. **Mudança misturada com pergunta.** Ampliar as formas reconhecidas no texto do
   hóspede, com a bateria de 106 mensagens do verificador como critério.
6. **Número por extenso** na conferência de valores, e o total amarrado à estadia por mais
   do que rótulo e datas.
7. **Memória de cotação em conversa longa.** Guardar a última cotação no estado da sessão,
   para o agente repetir o valor em vez de cotar de novo quando ela sai da janela de
   mensagens.
8. **Segurança da revisão final.** Limite de gasto por sessão ou por cliente, credencial de
   sessão além do `session_id`, cabeçalhos de proteção na página e prazo de apagamento dos
   dados da sessão.
9. **Log sem eco de dado.** Mascarar o texto de erro da plataforma antes de gravar, para
   nenhum dígito de dado do hóspede chegar ao log.
10. **Webhook real.** Conhecer o corpo do `422` e o formato da lista depois do primeiro lead
    real, e ajustar o tratamento de campo apontado.
11. **Leitura humana dos exports.** Um detector de trecho copiado do enunciado, para
    reduzir a leitura humana das sessões marcadas.
12. **Juiz de decisão (X11).** Medir um segundo modelo como juiz nos dois pontos de maior
    risco, se os evals finais mostrarem falha de handoff ou de confirmação.

<!-- PREENCHER: acrescentar o que a leva 2 e as três rodadas finais mostrarem -->
Itens do fim da leva 2: a preencher.
