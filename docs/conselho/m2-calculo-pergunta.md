# Pergunta ao conselho — cálculo de preço, primeira passada da M2 (13/11/2026)

Segunda opinião de um modelo de outro provedor sobre o cálculo de preço, na revisão final
(M2). A consulta foi feita por uma sessão delegada, numa cópia de trabalho própria do
repositório na `main` de 13/11, sem ver a opinião da coordenação nem a dos outros revisores.
A resposta inteira está em [`m2-calculo-resposta-gemini.md`](m2-calculo-resposta-gemini.md).
Caminhos de pasta local foram trocados por caminhos relativos ao repositório.

## Pedido

Você é um revisor independente, de outro fornecedor de modelo, chamado para dar uma SEGUNDA OPINIÃO sobre o cálculo de preço de um agente de chat para hóspedes de imóveis de temporada. Responda em português do Brasil. Você não corrige nada e não escreve em arquivo nenhum do repositório: sua entrega é só a sua mensagem final. Não crie subagentes, não faça commit, não troque de branch, não suba servidor, não faça chamada de rede.

## O que ler (nesta pasta, que é uma cópia do repositório)
1. `CLAUDE.md` e `AGENTS.md` da raiz (regras do projeto; as de sigilo valem para você: nunca abra `~/.config/agente-concierge/`, nunca imprima variável de ambiente).
2. `docs/CONTRATO.md`, seção 3 (a regra de preço e o exemplo com total de R$ 2.156,00) e, na seção 10, as lacunas que tratam de datas, hóspedes e capacidade.
3. O código do produto que calcula: `src/nucleo/dinheiro.ts`, `src/nucleo/preco.ts`, `src/nucleo/datas.ts`, `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts`, e os testes em `test/nucleo/`.
4. A segunda implementação da mesma regra, escrita por outra pessoa para os evals, que NÃO pode compartilhar código com a primeira: `evals/lib/juiz-preco.mjs` (só a parte que calcula a estadia esperada) e `evals/lib/tarifas.json`.

## O que eu quero saber
1. A regra da seção 3 do contrato está implementada exatamente? Procure erro de uma noite a mais ou a menos, noite de sexta e de sábado (a noite que COMEÇA nesses dias), acréscimo aplicado sobre a base certa, taxa de limpeza somada uma vez, arredondamento para centavos (em que passo, para que lado), estadia longa atravessando várias semanas, virada de mês e de ano, ano bissexto, fuso (a data é civil, em São Paulo), entrada no mesmo dia da saída, saída antes da entrada, datas no passado.
2. As duas implementações (produto e juiz dos evals) discordam em algum caso? Monte entradas e compare. Uma discordância é achado, mesmo que você não saiba qual lado está certo: diga qual segue o contrato.
3. Há valor em ponto flutuante em algum passo que possa errar um centavo? Mostre com os valores reais de `evals/lib/tarifas.json` (por exemplo diárias com centavos multiplicadas pelo acréscimo).
4. A formatação do valor para o hóspede (reais, separador de milhar, centavos) pode sair errada para algum valor?
5. O que os testes de `test/nucleo/` NÃO cobrem e deveria estar coberto?

## Como provar
Você pode rodar código só de leitura: pequenos scripts em Node (salve em `/tmp`, não nesta pasta) que importam os módulos e imprimem resultados. Se rodar a suíte de testes, use só `~/.cache/agente-concierge/com-trava.sh npx vitest run test/nucleo --maxWorkers=3` (depois de `ln -s ../../node_modules node_modules`, se a pasta não tiver `node_modules`; remova o link no fim). Nunca `--root`.

## Entrega: a sua mensagem final, em Markdown
- Primeira linha: `SEGUNDA OPINIÃO — cálculo de preço — <concordo | discordo em N pontos>`.
- Depois, cada achado: gravidade (ALTO: preço errado mostrado ou enviado; MÉDIO; BAIXO), `arquivo:linha`, a entrada exata (imóvel, datas, hóspedes), o que saiu, o que deveria sair pela regra do contrato e como você provou (comando e saída). Achado que você não rodou vem marcado como hipótese.
- Uma tabela com pelo menos 12 estadias que você calculou à mão, o resultado do produto e o do juiz.
- O que você conferiu e está certo; o que não conseguiu verificar.
Não escreva o relatório em arquivo. Não cite nome de empresa, endereço de serviço nem credencial.
