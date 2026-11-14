# Frente A — esqueleto até o Marco 1

- Export de sessão de trabalho. Índice e regras em [README.md](README.md).
- Tipo: sessão de frente.
- Aberta por: [Coordinate Concierge Challenge Delivery](03-coordinate-concierge-challenge-delivery.md).
- Branch: `frente-a`. Provedor: claudeAgent.
- Sessões que ela abriu (1):
  - Revisão de código frente A (subagente)
- Só o texto das mensagens: sem chamada e resultado de ferramenta, raciocínio, anexo, lembrete de sistema, bloco de instrução injetado e resumo de compactação. Sem data e hora. Máscaras descritas no índice.

---

## Mensagem · Usuário (coordenação)

Você é a frente A — esqueleto vertical até o Marco 1 do projeto agente-concierge. Trabalhe só nesta worktree (branch frente-a).

Leia inteiro, antes de tudo: CLAUDE.md, docs/CONTRATO.md e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, o topo ("Primeiro marco"), a seção "Sessão A", "Regras que valem para toda frente" e "Dono de arquivo". Leia também docs/VERIFICACOES.md §1 a §4 e, em docs/EVALS.md, o nível 1 e a seção das duas mensagens simultâneas. Não existe outra fonte de requisitos.

Objetivo: o agente funcionando de ponta a ponta em dev até o Marco 1 — a cotação do exemplo do contrato §3 devolve R$ 2.156,00, o hóspede recebe o resumo, confirma em outro turno, o lead chega ao webhook falso com os 7 campos, e um pedido de desconto devolve handoff true. Atende CA-01, CA-02, CA-04, CA-06, CA-09, CA-10, CA-11, CA-14 e CA-17 no nível do esqueleto.

Arquivos seus (coluna "Leva 1" da tabela de donos): package.json, lockfile, tsconfig.json, wrangler.jsonc, configuração do vitest, src/** e test/**. Qualquer outro arquivo: pare e avise. falso/ é da frente B1 e evals/ é das frentes B2 e D, que rodam em paralelo com você.

Critérios de aceite: os 6 da seção "Sessão A", com CHECK e ESPERA. Cumprido = saída 0 e o marcador de ESPERA na saída.

Fora do escopo: datas relativas, sem ano e no passado (frente E); validação de telefone, segunda reserva e nova tentativa de webhook (frente F); casos de ataque e matriz fina de handoff (frente G); qualquer secret ou deploy de producao.

O que você precisa saber e não está no backlog:
1. Deploy em dev é seu. Credencial: `CLOUDFLARE_API_TOKEN="$(cat [caminho local])"` no mesmo comando do wrangler, nunca ecoado, nunca gravado em arquivo. A conta: `CLOUDFLARE_ACCOUNT_ID`, que já está em [caminho local]; carregue o arquivo no mesmo comando. Não escreva account_id no wrangler.jsonc.
2. `LEADS_URL_DEV` ainda não existe. A frente B1 está construindo o webhook falso; quando ele estiver publicado em dev, eu gravo `LEADS_URL_DEV` no arquivo de ambiente e aviso nesta thread. Até lá, teste a trava de confirmação com mock nos testes. Não publique o webhook falso você mesma.
3. Depois do primeiro deploy, acrescente `AGENTE_URL_DEV=<url>` ao arquivo de ambiente, sem imprimir o valor. A partir daí o gate de sigilo trata o host de dev como termo proibido em arquivo versionado: ele não entra em código, teste, documento nem commit.
4. O bloco `marco1` dos evals está sendo escrito pela frente B2. O critério 5 (critério de integração 1) quem roda sou [nome], depois dos merges. Para o seu relatório, rode a conversa do Marco 1 em dev por curl e diga o resultado de cada um dos quatro passos (total, resumo, lead conferido por GET no webhook falso, handoff).
5. Modelo inicial: um nativo do Workers AI de docs/VERIFICACOES.md §2, atrás da variável MODELO e do adaptador único em src/modelo.ts. A escolha final é da frente I, que vai testar também modelos de terceiros pelo AI Gateway: deixe o adaptador pronto para trocar de modelo só pela variável.
6. O gate de sigilo lê o reflog: as palavras squash, amend e rebase não entram em assunto de commit nem em nome de branch.
7. Subagentes de revisão e de verificação usam o modelo Opus. Não use workflows nem ultracode: o orçamento de uso está apertado.

Regras duras: nenhum POST ao webhook real (você nem monta a URL real); nunca imprimir segredo; gate de sigilo antes de cada commit e de cada push; nunca squash, amend ou rebase; um commit por mudança lógica, com push da branch frente-a a cada commit; lacuna do contrato ou critério impossível: pare e avise, não decida comportamento de produto.

Ao terminar: revisão de código por subagente code-reviewer sobre o seu diff, achados corrigidos, npm test verde, commit e push da sua branch, e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK, o que ficou de fora, commits. Sem colar diff. Se a ferramenta t3_thread_send existir na sua sessão, mande o mesmo relatório para a thread da coordenadora (id [id]). Se travar em lacuna ou em algo que dependa de mim, avise do mesmo jeito em vez de esperar.

## Mensagem · Assistente

Contexto lido (contrato, backlog, verificações, evals) e dependências instaladas. Agora confiro a configuração real do wrangler e do plugin de teste antes de escrever o código.

## Mensagem · Assistente

Núcleo de preço pronto e verde (23 testes). Limpo um teste, faço o primeiro commit com o gate de sigilo e sigo para a trava do lead.

## Mensagem · Assistente

Trava do lead pronta (26 testes verdes). Commit e depois catálogo, modelo, ferramentas e o loop.

## Mensagem · Assistente

Adaptador do modelo e cliente do catálogo escritos. Agora as ferramentas, o prompt e o loop.

## Mensagem · Usuário (coordenação)

Coordenadora: `LEADS_URL_DEV` já está em [caminho local] O webhook falso está publicado em dev e conferido (FALSO OK). O valor é o segmento próprio do agente de dev: use-o como secret `LEADS_URL` do ambiente dev no primeiro deploy.

- falso/ entrou na main (README em falso/README.md). Se quiser o falso local para teste de integração, faça `git merge origin/main` (merge, nunca o comando proibido de reescrita) e suba-o na porta 8795.
- Modos de falha: por requisição, cabeçalho `x-falso-modo`; por segmento, modo gravado em `PUT /modos/<segmento>`. A frente B1 ainda vai mudar o modo gravado (validade e escopo por telefone) e o modo de atraso (guardar antes de esperar). Não dependa do modo gravado nos seus testes: para 422, 500 e tempo esgotado use mock.
- Não rode DELETE no segmento de dev: só a coordenadora limpa essa lista.

## Mensagem · Assistente

Recebido: uso `LEADS_URL_DEV` como secret `LEADS_URL` já no primeiro deploy, sem URL provisória. Sigo com prompt, loop, sessão e rotas.

## Mensagem · Assistente

Loop de ferramentas verde (19 testes). Agora os testes do Durable Object (fila, memória, isolamento) e das rotas.

## Mensagem · Assistente

Testes verdes (94) e quatro commits enviados. Agora o primeiro deploy em `dev`, com os secrets por arquivo temporário e sem imprimir a URL.

## Mensagem · Assistente

Marco 1 passou em `dev` nos quatro passos; agora corrijo os três problemas que as variações acharam: resposta degenerada (`!!!!`), resumo gerado pelo modelo após troca de data e hífens/negrito que quebrariam checagens de texto.

## Mensagem · Assistente

Corrigidos os três problemas, com teste para cada um (100 testes verdes). Faço os commits, publico em `dev` e repito as conversas.

## Mensagem · Assistente

Tudo passou em `dev`: Marco 1 (4 passos) e as 8 variações. Agora rodo os CHECKs do backlog e mando o diff para revisão de código.

> Subagente chamado: Revisão de código frente A

## Mensagem · Assistente

A revisão encontrou dois caminhos de lead indevido e três problemas médios; vou corrigir todos, com um teste para cada um.

## Mensagem · Assistente

Os dois achados graves estão corrigidos e provados (o teste falha sem a correção). Commit, novo deploy em `dev` e repetição das conversas.

## Mensagem · Assistente

CHECKs refeitos no HEAD: todos com saída 0 (109 testes). Falta provar o `npm run dev` local e conferir dois "sim" seguidos em `dev`.

## Mensagem · Assistente

Tudo commitado, enviado e publicado em `dev`. Envio o relatório para a thread da coordenadora.

## Mensagem · Assistente

Marco 1 está no ar em `dev` e passou nos quatro passos; o relatório abaixo também foi enviado para [Coordinate Concierge Challenge Delivery]([url]).

**Relatório da frente A** (branch `frente-a`, HEAD `aca6c7a`, 12 commits de `91ac83f` a `aca6c7a`, todos enviados)

1. **Feito:** configuração do projeto com `dev` e `producao`, núcleo de preço, datas e dinheiro, cliente do catálogo, adaptador do modelo (`@cf/openai/gpt-oss-120b`), loop de ferramentas, trava de confirmação, Durable Object com fila e SQLite, `/chat`, `/saude`, página mínima, cabeçalhos `x-uso-*` e log por turno sem dado pessoal. Publicado em `dev`, com `AGENTE_URL_DEV` gravada no arquivo de ambiente.
2. **CHECKs 1 a 4:** todos com saída 0.
   - `npm test -- preco`: `exemplo do contrato: R$ 2.156,00` passando (15 testes).
   - `npm test -- nucleo`: 26 testes, inclui 245,50 × 1,2 = 29460.
   - `npm test -- sessao`: `uma mensagem por vez` passando; o teste falha se a fila for removida.
   - `npm test -- lead`: 27 testes.
   - `npm test` completo: 109 testes, sem erro não tratado. Gate: `SIGILO OK`.
3. **CHECK 6:** `/saude` em `dev` devolve `ambiente: "dev"`, `leads_destino: "falso"`, `envio_leads: "ligado"`. O `npm run dev` local também sobe e responde.
4. **CHECK 5:** não rodei, é da coordenadora. A conversa do Marco 1 por curl em `dev` passou 4 de 4:
   - total `R$ 2.156,00`;
   - resumo com total e datas, sem "registrad", 0 leads;
   - depois do "sim", 1 lead conferido por GET no webhook falso, com os 7 campos (`valor_total` 2156);
   - desconto com `handoff: true`.
5. **Outras conversas em `dev`:** passaram as recusas por mínimo e por capacidade, total sem hóspedes, tudo de uma vez, hesitação, troca de data junto com o sim, dois sins seguidos e simultâneos (1 lead) e duas perguntas simultâneas.
6. **Revisão de código (Opus):** dois achados altos, corrigidos com teste que falha sem a correção.
   - Ferramenta cortada pelo prazo gravava o resumo depois da resposta, e o sim seguinte enviava um lead de resumo nunca mostrado.
   - Confirmação pedida antes de uma cotação no mesmo lote enviava os dados antigos.
   - Mais três médios corrigidos: prompt, estadia longa e total anexado a recusa.
7. **Duas escolhas minhas, para aceitar ou reverter:**
   - Resumo, resultado da confirmação e falha saem em texto fixo de código, em português. A L15 não vale nesses turnos.
   - Qualquer cotação de outra estadia com resumo em aberto troca o resumo, mesmo quando o hóspede só perguntou (fronteira L9/L10).
8. **Arquivos novos sem dono na leva 2:** `src/env.ts`, `src/agente/ferramentas/tipos.ts`, `src/agente/ferramentas/pedido.ts` e `test/apoio.ts`. Há acoplamento: `cotacao.ts` (E) chama `resumir` em `ferramentas/lead.ts` (F), e os dois usam `pedido.ts`.
9. **Já feito, para ninguém refazer:** L8, L13, L14 e o básico de L17, L17a e L18.
10. **Fora, por escopo:** datas relativas, sem ano e no passado (E); telefone, segunda reserva, 422 e nova tentativa em 5xx (F); matriz de handoff e ataques (G). Hoje qualquer resposta diferente de 201 vira "não consegui registrar", com handoff.
11. **Riscos conhecidos:**
    - total errado escrito pelo modelo continua na resposta, ao lado do total anexado pelo código (G);
    - telefone com e sem +55 gera chaves de reserva diferentes (F);
    - o modelo inicial teve picos de 13 a 16 s e uma resposta degenerada, hoje descartada e pedida de novo (I).
12. **Sobras:** ficaram cerca de 13 leads de teste meus no segmento de `dev` do webhook falso; não rodei DELETE.

Próximo passo: rodar o critério de integração 1 (`--bloco marco1`) depois dos merges.

## Mensagem · Usuário (coordenação)

Coordenadora: conferi a sua entrega. Reproduzi os quatro CHECK e os 109 testes, o /saude, e o bloco marco1 deu 100% e EVAL OK contra dev, com 1 lead de 7 campos conferido por GET. O verificador independente (que também é a revisão do Marco 1) aprovou com ressalvas: nenhum defeito nos caminhos que não se desfazem (preço batido contra referência em BigInt, trava, POST com prazo estourado e reinício do objeto, fila), mas duas altas seguram o merge. Dois modelos de outros provedores, consultados às cegas, acrescentaram dois pontos na trava. Mesma branch, mesmos arquivos, mesmas regras. Não precisa publicar de novo em dev: eu publico a partir da main depois do merge.

CORRIGIR ANTES DO MERGE
1. [alta] src/agente/loop.ts ~75-79: `comTotais` só acrescenta o total certo; um total errado escrito pelo modelo continua na resposta, e test/loop.test.ts ~40 aceita "R$ 2.000,00" ao lado de "R$ 2.156,00". Contraria o contrato §2, §7.7 e CA-05. Correção: todo valor em reais no texto do modelo que não esteja entre os valores que o código devolveu naquela conversa é trocado ou retirado. O teste passa a exigir que o valor errado não apareça.
2. [alta] A suíte não guarda o que as frentes F e H vão editar. Quatro defeitos plantados passaram: fila sem o `.catch`; `ligado: true` e `destinoPermitido: true` fixos na sessão (src/sessao.ts ~97-98); estado do lead só em memória; nova tentativa dentro de `postarLead` no tempo esgotado (test/lead.test.ts ~248 não conta os fetches). Escreva os testes que pegam os quatro: uma mensagem cujo processamento lança não trava a seguinte; ENVIO_LEADS desligado e destino não permitido dão zero POST pelo caminho da sessão; resumo, reinício do objeto e "sim" dão 1 lead com o estado vindo do storage; tempo esgotado dá exatamente 1 fetch. Dois cuidados que o verificador achou ao escrever os dele: o reinício segura uns 10 s por causa dos timers de `AbortSignal.timeout` (o teste precisa de timeout maior), e o teste de "processamento que lança" deixava 1 erro não tratado na saída, o que não é verde.
3. [alta, do conselho] src/agente/ferramentas/cotacao.ts: com resumo pendente, uma cotação com dado inválido (data inexistente, imóvel não encontrado) retorna em `if (!pedido.ok)` antes de `invalidarPendente`. O resumo antigo fica confirmável, e um "sim" depois envia a estadia que o hóspede tinha tentado mudar. O mesmo vale se a leitura do catálogo lançar ao montar um resumo alterado. Correção: invalidar o pendente antes dos retornos de erro, com teste.
4. [média, do conselho] src/agente/ferramentas/lead.ts: pedir o resumo de uma reserva já registrada (ou marcada como incerta) cai em resposta final e pula `invalidarPendente`; o resumo pendente de outra reserva continua valendo. Correção: invalidar também nesse caminho, com teste.

BAIXAS, SE COUBEREM (uma linha cada; se não couber, diga e passam para a leva 2)
5. src/lead.ts ~188-193: o fetch do lead segue redirecionamento; um 307/308 reenviaria o corpo a outro host. `redirect: "manual"`.
6. src/nucleo/dinheiro.ts ~7: valor com 3 casas é arredondado sem aviso; recuse valor com mais de 2 casas e inclua 1,15 e 4,35 no teste.
7. src/nucleo/preco.ts ~43: com data malformada, `cotar` devolve ok com total NaN (hoje inalcançável); recuse quando `noites` não for inteiro.

NÃO MEXA (vão para a leva 2, com dono)
- A validação por código de que a mensagem é um "sim" inequívoco (L9), o 5xx com nova tentativa, o 422 e a separação dos marcadores "falhou" e "incerto": frente F.
- O orçamento da mensagem que esperou na fila e o teto do Worker abaixo de 60 s; resumo confirmável sem ter sido entregue: frente H.
- As suas duas escolhas: o Éverton decidiu. (a) L15: resumo, confirmação e falha continuam textos fixos de código, e passam a existir em português e em inglês (a frente F faz). (b) L10: aceito, vale sempre o último resumo mostrado.

CHECK: `npm test` sem falha e sem erro não tratado; para cada item de 1 a 4, o nome do teste e a confirmação de que ele falha quando você desfaz a correção; gate de sigilo antes de cada commit e push. Relatório de até 10 linhas, com os commits. Sem colar diff.

## Mensagem · Assistente

Plano: corrigir os itens 1 a 4 com teste que falha sem a correção, cobrir os quatro defeitos plantados do item 2, e incluir as três baixas (5, 6, 7), que cabem.

## Mensagem · Assistente

Correções aplicadas e suíte verde. Agora os testes novos de cada item e a prova de que cada um falha sem a correção.

## Mensagem · Assistente

Todas as 13 mutações foram pegas pelos testes novos (cada correção desfeita derruba pelo menos um teste). Rodo a suíte inteira e faço os commits.

## Mensagem · Assistente

Tudo commitado e enviado, com os CHECKs refeitos no HEAD. Envio o relatório à coordenadora.

## Mensagem · Assistente

Os quatro itens obrigatórios e as três baixas estão corrigidos na `frente-a` (HEAD `28e6717`), e o mesmo relatório foi para [Coordinate Concierge Challenge Delivery]([url]). Não publiquei em `dev`, que segue na versão `aca6c7a`.

**Relatório da frente A — correções da revisão do Marco 1**

1. **CHECK:** `npm test` com saída 0, 128 testes em 9 arquivos, zero erro não tratado. `-- preco` 16, `-- nucleo` 28, `-- sessao` 10, `-- lead` 29, todos saída 0. `tsc --noEmit` limpo. `SIGILO OK` antes de cada commit e push.
2. **Item 1** (`61b85fd`, `28e6717`): todo valor em reais no texto do modelo é conferido contra os valores que o código já escreveu na conversa. O mesmo valor em outro formato volta ao formato do código; valor que nenhuma ferramenta devolveu sai com a frase. Falham sem a correção:
   - "total errado escrito pelo modelo não chega ao hóspede; só o total do código"
   - "valor do código escrito em outro formato volta ao formato do código"
   - "valor que nenhuma ferramenta devolveu sai da resposta, mesmo sem cotação no turno"
3. **Item 2** (`681d174`): cada defeito plantado derruba um teste.

   | Defeito plantado | Teste que falha |
   |---|---|
   | fila sem o `.catch` | "mensagem cujo processamento lança não trava a seguinte" |
   | `ligado: true` fixo | "ENVIO_LEADS diferente de ligado: a confirmação pela sessão não faz nenhum POST" |
   | `destinoPermitido: true` fixo | "webhook no host do catálogo fora de producao: a confirmação pela sessão não faz nenhum POST" |
   | estado do lead só em memória | "resumo, reinício do objeto e sim: 1 lead, com o estado vindo do storage" |
   | nova tentativa em `postarLead` | "tempo esgotado: exatamente 1 fetch, sem nova tentativa" |

4. **Duas mudanças de código que saíram do item 2**, para a frente H saber:
   - `Sessao.conversar` não rejeita mais: processamento que lança vira a resposta de contingência com handoff (L18). Isso também eliminou o erro não tratado na saída.
   - Os tempos limite do catálogo e do webhook cancelam o relógio ao terminar. O teste de reinício roda em 30 ms, sem os ~10 s de espera.
5. **Item 3** (`0a40913`): com resumo em aberto, cotação com dado inválido ou catálogo que lança invalida o pendente antes de responder. Cada um falha sem a linha correspondente:
   - "cotação com data inexistente depois do resumo derruba a confirmação pendente"
   - "cotação com imóvel que não existe depois do resumo derruba a confirmação pendente"
   - "catálogo fora do ar em cotar com dado novo depois do resumo derruba a confirmação pendente"
   - "catálogo fora do ar em montar_resumo com dado novo depois do resumo derruba a confirmação pendente"
6. **Item 4** (`0a40913`): pedir de novo uma reserva já enviada invalida o resumo em aberto de outra. Teste: "pedir de novo uma reserva já registrada derruba o resumo em aberto de outra reserva"; falha sem a correção.
7. **Baixas:** as três couberam, e cada uma tem teste que falha se a correção for desfeita.
   - 5: `redirect: "manual"` no POST do lead (`681d174`).
   - 6: valor com mais de duas casas é recusado, com 1,15 e 4,35 no teste (`6c7c53b`).
   - 7: data malformada é recusada em `cotar` (`6c7c53b`).
8. **Efeito colateral do item 1:** frase em que o modelo faz conta própria (por exemplo, "2 noites × R$ 708,00 = R$ 1.416,00") sai inteira, porque 1.416,00 nunca veio do código.
9. **Não mexi** no que ficou para a leva 2: L9 por código, 5xx, 422, marcadores "falhou" e "incerto", orçamento da fila e textos em inglês.
10. **Commits novos:** `61b85fd`, `0a40913`, `681d174`, `6c7c53b`, `28e6717`.

Próximo passo: merge `--no-ff` da `frente-a` na `main` e deploy de `dev` a partir dela.

## Mensagem · Usuário (coordenação)

Coordenadora: correções conferidas (128 testes; plantei de novo três dos defeitos numa cópia e a suíte pegou os três). A frente A entrou na main (merge 45ca6ef), eu publiquei em dev a partir da main e o critério de integração 1 deu `BLOCO marco1: 100%` e `EVAL OK`. Marco 1 verde.

Um último pedido, pequeno, antes de a leva 2 sair, porque só você tem os arquivos na cabeça e na leva 2 eles passam a ter quatro donos diferentes. É só encanamento de interface, sem mudar comportamento. Comece com `git merge origin/main`.

O `Contexto` das ferramentas (src/agente/ferramentas/tipos.ts) não tem duas coisas de que duas frentes vão precisar, e quem monta o contexto é src/sessao.ts, que na leva 2 é de outra frente:
1. `mensagem: string` — o texto da mensagem do hóspede neste turno. A frente F vai usar para validar por código que a confirmação é um "sim" inequívoco (L9).
2. `hoje: string` — a data civil de hoje no fuso America/Sao_Paulo, em AAAA-MM-DD, vinda de um relógio que os testes conseguem injetar. A frente E vai usar para datas relativas, data sem ano e data no passado (L1, L1b, L2).

O que fazer: acrescentar os dois campos ao `Contexto`; preencher em src/sessao.ts (o relógio é o mesmo que a sessão já usa, com um jeito de injetar no teste); a conversão de instante para data civil de São Paulo fica numa função pura em src/nucleo/datas.ts, com teste (inclua a virada do dia: 23h59 e 00h01 de São Paulo, e um instante em que a data UTC já é a do dia seguinte); atualizar test/apoio.ts para os contextos de teste trazerem os dois campos. Nenhuma ferramenta passa a usar os campos agora.

CHECK: `npm test` sem falha e sem erro não tratado; `npm run tipos` limpo; gate de sigilo; commit e push. Relatório de até 5 linhas com o commit. Depois disso a sua frente está encerrada.

## Mensagem · Assistente

Os dois campos estão no contexto, com a função pura de data e os testes (130 verdes, tipos limpos). Confiro que o teste novo pega um preenchimento errado e faço o commit.

## Mensagem · Assistente

O `Contexto` das ferramentas agora traz `mensagem` e `hoje`, no commit `59b441f` da `frente-a`, já enviado; o relatório também foi para [Coordinate Concierge Challenge Delivery]([url]).

1. **[nome]:** `mensagem` é o texto do hóspede como chegou, sem trim; `hoje` é a data em `AAAA-MM-DD` no fuso `America/Sao_Paulo`. A sessão preenche os dois e nenhuma ferramenta usa ainda.
2. **Função pura:** `dataCivilEmSaoPaulo(instanteMs)` em `src/nucleo/datas.ts`, testada em 23h59 e 00h01 de São Paulo, com a data UTC já no dia seguinte, na virada de ano e em 29/02.
3. **Relógio injetável:** `Dependencias.agora` em `src/sessao.ts`, com padrão `Date.now`. Ele alimenta só o `hoje`; o prazo de 45 s continua no relógio real, para um relógio falso de teste não estourar o orçamento.
4. **Testes:** `test/apoio.ts` ganhou `criarContexto(...)` e `HOJE_DE_TESTE`, e `test/loop.test.ts` já usa. O teste novo da sessão falha se o `hoje` for preenchido pela data UTC.
5. **CHECK:** `npm test` com saída 0, 130 testes e zero erro não tratado; `npm run tipos` limpo; `SIGILO OK` antes do commit e do push.

A branch partiu de `git merge origin/main`, e a `main` não tinha mexido nos meus arquivos. Frente A encerrada.
