# Auditoria de segurança com a skill `security-audit` (14/11/2026)

Uma passada rápida e parcial, feita em 14/11/2026, depois da construção e com a entrega já no
ar, por ordem do Éverton (X37 em [`DECISOES.md`](../../DECISOES.md)). Ferramenta: a skill
`security-audit` da Cloudflare (código aberto, licença MIT, repositório
`cloudflare/security-audit-skill`), no modo de auditoria completa, perfil `quick`. Alvo: a
`main` publicada no commit `db96f2f`, cujo código do agente é o da árvore `9d37f9a`.

Este arquivo diz o que a rodada cobriu e o que não cobriu, o que foi executado e o que foi só
leitura de código, o veredito da skill para cada achado e o que foi corrigido no mesmo dia.

**O que a rodada não é.** O perfil `quick` roda uma leva só de caçadores e um crítico de
cobertura no fim, e a própria skill manda apresentar o resultado como cobertura parcial. Onde
não há achado confirmado, a conclusão é só esta: esta passada não confirmou nada ali. A skill
auditou o `db96f2f`. As correções feitas depois não foram auditadas de novo por ela; cada uma
teve verificador independente próprio (seção "Correções feitas no mesmo dia").

## Como rodou

| Fase da skill | Quem | O que fez |
|---|---|---|
| Reconhecimento | 4 agentes, só leitura | mapa da arquitetura, fronteiras de confiança e 19 unidades de cobertura (superfície × fronteira × classe de ataque), com 8 dos 10 guias de domínio da skill |
| Caça | 6 caçadores, numa leva só | cada um com 2 a 4 unidades; devolvem checagens, candidatos e notas de endurecimento |
| Verificação | 1 verificador novo por candidato | no `quick`, a validação do candidato e a conferência final do registro são o mesmo agente, que não caçou |
| Crítico de cobertura | 1, no fim | aponta lacunas; no `quick` o que ele pede vira unidade adiada, sem segunda leva |

Os 14 agentes rodaram em Claude Opus 5.5, com esforço alto; a sessão principal, em Claude Fable
5.2, montou os prompts com os textos da skill, consolidou os resultados e escreveu os arquivos
da rodada. Guias de domínio usados: IA e LLM, protocolo web e autenticação, lado do cliente,
nuvem e implantação, exaustão de recursos, protocolos e mensagens, isolamento e ciclo de vida
de dados, cadeia de dependências. Ficaram fora, com motivo: segurança de memória (só há
TypeScript e JavaScript) e aplicativo nativo ou IPC local (não existe no repositório).

A saída da skill (ledger de cobertura, registros, relatórios) fica na pasta padrão dela, fora
do repositório. Os dois validadores da skill passam, e o estado da rodada é `complete`: todo
candidato teve disposição independente.

## Regras de execução

- Por causa da auditoria: nenhuma chamada ao agente publicado, ao catálogo real, ao webhook
  real nem a modelo, e nenhuma eval. A decisão 11 não mudou.
- Leitura de código num clone local do commit, só para leitura.
- Código do alvo só rodou dentro de um sandbox do sistema operacional: sem rede, ambiente
  vazio, alvo e dependências só para leitura, escrita só numa pasta de rascunho em memória,
  limites de CPU, memória, processos, tamanho de arquivo e tempo. O resultado só sai do sandbox
  por código da sessão principal, por lista fechada de nomes e de tamanho.

## O que foi executado e o que foi só leitura

62 checagens ficaram registradas: 60 por leitura de código e 2 por execução local no sandbox.
As duas execuções são do mesmo achado (o confirmado, abaixo): uma do caçador e a reprodução
independente do verificador, com as ferramentas reais do agente, catálogo e webhook falsos em
memória e dados fictícios. Tudo o mais é leitura.

## Cobertura

23 unidades no fim: 16 cobertas, 3 com candidato e 4 adiadas.

| Superfície | Classes de ataque olhadas | Estado |
|---|---|---|
| `POST /chat` | injeção; controle de acesso por `session_id`; trabalho antes da autenticação; extração de contexto; lógica de negócio | 3 cobertas, 2 com candidato |
| Chamadas de ferramenta vindas do modelo | injeção por argumento de ferramenta; ligação entre confirmação e ação | cobertas |
| Respostas do catálogo | injeção indireta por texto recuperado | coberta |
| Página `GET /` | XSS no DOM | coberta |
| `GET /saude` | vazamento por diagnóstico | coberta |
| Saídas do Worker (POST do lead e GET do catálogo) | manuseio de recurso externo | coberta |
| Webhook falso de `dev` | controle de acesso; injeção | 1 coberta, 1 com candidato |
| Configuração e secrets | segredos; deriva de controle entre ambientes | cobertas |
| Ferramentas locais (`evals/`, `scripts/`) | injeção | coberta |
| Todas as rotas e o repositório | o óbvio; curinga; encadeamento entre fronteiras | cobertas |

### O que não foi coberto

- **Quatro unidades adiadas**, pedidas pelo crítico final e não executadas (o `quick` não roda
  segunda leva): retenção e apagamento do dado pessoal na sessão e no registro do gateway de
  IA; quantidade de sessões e de linhas guardadas sem teto; o Worker de `dev` como segunda
  superfície pública; custo das expressões regulares que leem a mensagem do hóspede.
  Sobre a primeira, um fato que o Éverton conferiu na configuração em 14/11: o gateway de
  `producao` está com a coleta de log desligada, e o de `dev`, ligada (com dados sintéticos).
  O registro do pedido no gateway, com nome e telefone, não existe em `producao`. A parte da
  sessão continua aberta: é o limite 28.
- **Tudo o que está fora do código:** configuração da zona e do gateway (regra de taxa, WAF,
  limite de gasto, retenção de logs), comportamento do modelo real, do catálogo real e do
  webhook real. Fato decisivo desse tipo vira bloqueio de um registro "precisa de validação".
- **Vulnerabilidade conhecida de dependência:** não houve consulta (sem rede).
- **As correções:** a skill não rodou de novo sobre elas.

## Achados da skill

A skill só dá severidade a achado confirmado, e só confirma com resultado observado numa
execução local limitada. "Precisa de validação" é uma pista com caminho no código e um fato
decisivo fora dele; não é vulnerabilidade confirmada.

| # | Achado | Veredito da skill | Severidade | Destino |
|---|---|---|---|---|
| 1 | A confirmação do lead não refaz a regra da data de entrada. A regra L2 do contrato (entrada anterior a hoje é recusada) vale ao cotar e ao montar o resumo, e não era refeita na hora do envio | confirmado, com reprodução independente no sandbox | baixa (probabilidade baixa, impacto baixo; confiança alta) | Corrigido em 14/11, por decisão do Éverton no mesmo dia (`e85de28`): a confirmação refaz a regra com o mesmo relógio do resumo (fuso de São Paulo, entrada hoje aceita). Se a data de entrada já passou, nada é enviado, o resumo é descartado e o modelo recebe o motivo, para explicar e pedir novas datas, com `handoff: false`. O texto dessa explicação é escrito pelo modelo e não foi medido (limite 70 do README) |
| 2 | `POST /chat` sem autenticação consome o modelo pago do operador sem teto por cliente nem agregado visível no código | precisa de validação | sem severidade | Não muda no código: é o contrato do `POST /chat` (X37, item 4). Vale a decisão que já existia (P23 revogada, X29), reafirmada pelo Éverton em 14/11: é o limite 24 do README, com o limite de gasto na conta do provedor do modelo como controle e sem regra de taxa hoje. Sem pendência nova |
| 3 | Webhook falso de `dev` grava leads sem teto de quantidade, de tamanho nem de retenção, em qualquer segmento | precisa de validação | sem severidade | Fica como limite (o 67 do README): é infraestrutura de teste, só de `dev`, com dados fictícios. O fato decisivo (cota e conta que hospeda o falso) está fora do repositório |

## Notas de endurecimento

A skill separa do achado o que é endurecimento: ponto sem fronteira de confiança cruzada ou
sem efeito demonstrado. Os caçadores devolveram 22 notas. O destino de cada grupo:

| Nota | Destino |
|---|---|
| Página `GET /` sem política de conteúdo, sem bloqueio de moldura e sem `nosniff` (2 notas; era o limite 27 do README) | Corrigido |
| Leitura do catálogo segue redirecionamento | Corrigido |
| Texto do catálogo mantém caracteres invisíveis e de direção | Corrigido |
| `env.dev` sem `preview_urls: false` | Corrigido |
| Exemplo de `curl` do README com `session_id` fixo; comandos de instalação sem `npm ci` | Corrigido no README |
| `session_id` aceita qualquer texto, inclusive previsível; os cabeçalhos `x-uso-*` mostram o consumo a qualquer cliente; `/chat` não confere `content-type` (3 notas) | Limite: é o contrato do `POST /chat` (X37, item 4) |
| Histórico da sessão sem poda e sem prazo (limite 28 do README) | Limite; ver os quatro pontos, abaixo |
| Itens de cidades e de busca sem validação por item; mensagem de sistema no meio da conversa chega ao modelo como texto de usuário; recusa do modelo principal leva o turno ao reserva; telefone do lead sem a checagem de origem que o nome tem; a trava de confirmação depois de corte por teto não cobre um segundo lote do mesmo turno (5 notas) | Limite: caminho da conversa (X37, item 4) |
| Trava de `dev` contra o webhook real por comparação de host; idempotência do lead por sessão (2 notas) | Limite: caminho do lead (X37, item 4) |
| Modo de atraso do webhook falso | Limite: só `dev` |
| Arquivo de configuração do `curl` sem escape no script de validação; política de ferramentas da CLI do simulador; trava de ambiente do runner confia no `/saude` do alvo (3 notas) | Limite: ferramentas do operador, com entrada do próprio operador |

## Os quatro pontos pedidos pelo Éverton

| Ponto | Quem respondeu | Resposta | Destino |
|---|---|---|---|
| Cabeçalhos de proteção da página (limite 27) | a skill, em duas notas de endurecimento | procede: `GET /` respondia só com `content-type` | corrigido |
| Leitura do catálogo: segue redirecionamento? | a skill, numa nota de endurecimento | seguia (é o padrão do `fetch`) | corrigido |
| Leitura do catálogo: tem teto de tamanho? | leitura direta da coordenação, fora da skill | não tinha: lia a resposta inteira | corrigido (teto de 1 MiB) |
| Nome de ferramenta desconhecido vindo do modelo | leitura direta da coordenação, fora da skill (a skill conferiu a lista fechada de ferramentas, não o tamanho do nome) | ia inteiro para o log do turno e para o histórico da sessão | corrigido |
| Prazo de apagamento dos dados da sessão (limite 28) | a skill: uma nota de endurecimento, e uma unidade pedida pelo crítico, que ficou adiada | procede: nada apaga a sessão | continua limite: apagar por alarme mexe no objeto da sessão, e o prazo é decisão de produto |

## Correções feitas no mesmo dia

Cada correção tem teste que falha sem ela e passa com ela, e passou por verificador
independente (Claude Opus 5.5, esforço alto), que refez a mutação, rodou a suíte e, na página,
abriu um navegador de verdade com o HTML e os cabeçalhos do Worker.

| Commit | O que muda | De onde veio |
|---|---|---|
| `f94a73d` | `GET /` responde com política de conteúdo (script e estilo só pelo hash, calculado do conteúdo real da página), bloqueio de moldura, `nosniff`, `referrer-policy` e `permissions-policy` | nota da skill; limite 27 |
| `413d619` | a política aceita atributo de estilo (`style-src-attr`), para um elemento oculto que a borda insere em `producao` continuar oculto | medição da coordenação antes do deploy |
| `8549259` | a leitura do catálogo não segue redirecionamento (um 3xx vira erro, sem nova tentativa) e para ao passar de 1 MiB | nota da skill (redirecionamento) e leitura direta (teto) |
| `a60c76b` | nome de ferramenta vindo do modelo cortado em 64 caracteres nos dois adaptadores; no log do turno, nome fora da lista fechada sai como `desconhecida` | leitura direta, pedida pelo Éverton |
| `e8c8158` | o corte do nome não deixa meio caractere no fim | achado baixo de um verificador |
| `932cb81` | texto do catálogo sem caracteres invisíveis nem controles de direção | nota da skill |
| `89de70f` | `preview_urls: false` também em `env.dev` | nota da skill |
| `a326b9d`, `f668d6f`, `36e31cb`, `905a42d` | só testes: nova tentativa do catálogo e os cinco 3xx fixados; política sem diretiva repetida | achados dos verificadores |
| `e85de28` | a confirmação do lead recusa entrada que já passou (regra L2, com o relógio da sessão) | achado confirmado da skill |
| `2bbbc63` | só teste: a mesma regra no nível do turno, com o relógio da sessão | regra dada pelo Éverton |

O código das correções foi aprovado. Três verificadores reprovaram por lacuna de teste, e cada
lacuna virou um commit de teste antes do merge:

- cabeçalhos e catálogo (`f94a73d`, `8549259`): reprovado por um achado médio. Nenhum teste
  fixava a nova tentativa do catálogo em JSON inválido e em tempo limite. Fechado em `a326b9d`;
- nome de ferramenta, texto do catálogo e `preview_urls` (`a60c76b`, `932cb81`, `89de70f`):
  aprovado, com um achado baixo corrigido em `e8c8158`;
- política com o que a borda insere (`413d619`): reprovado por um achado alto de teste. Uma
  diretiva repetida passaria no teste, e o navegador usa a primeira ocorrência. A política
  servida estava certa. Fechado em `36e31cb`. Esse verificador montou o HTML como a borda o
  entrega e mediu no Chromium: o link inserido continua oculto e fora do Tab, o script
  inserido não roda, a página funciona;
- os ajustes: reprovado por um achado alto de teste. Os cinco casos de 3xx não falhavam se o
  código voltasse a seguir redirecionamento; só o caso antigo do 302 pegava. Fechado em
  `905a42d`, conferido por mais um verificador e pela mutação refeita pela coordenação;
- correção do lead (`e85de28`, `2bbbc63`): dois verificadores, um para a correção e outro
  para o teste no nível do turno, e os dois aprovaram. Os commits ficaram só no repositório
  local até a correção estar em `producao`, porque o teste descreve como reproduzir o defeito.

Ficaram registrados, sem correção:

- emoji composto por U+200D (família, bandeira) no texto do catálogo passa a aparecer como os
  emojis separados. Nenhum texto do catálogo de hoje usa isso (limite 68 do README);
- o id e os argumentos de uma chamada de ferramenta vinda do modelo não têm teto de tamanho, e
  um nome que seja só meio caractere vira nome vazio, que o loop trata como ferramenta
  inexistente (limite 69 do README);
- com `img-src 'none'`, um navegador que peça `/favicon.ico` sozinho pode registrar um aviso da
  política. A rota já respondia 404;
- o hash da política pressupõe um bloco de script e um de estilo na página. Os testes pegam a
  mudança antes do deploy;
- a mensagem do commit `89de70f` fala de um segundo endereço público em `dev`; pela P25, Worker
  com Durable Object não gera URL de pré-visualização. A linha de configuração está certa, e a
  mensagem não é reescrita (o histórico não é refeito).

### O que foi rodado de novo sobre as correções

- **Suíte e tipos.** Lote principal (cabeça `905a42d`): 57 arquivos, 1598 testes, tipos sem
  erro. Com a correção do lead: 58 arquivos, 1604 testes, tipos sem erro.
- **Catálogo real, por GET direto.** 73 pedidos sem seguir redirecionamento, em todas as rotas
  que o agente usa (cidades, busca com os filtros, as 15 fichas por id): nenhum 3xx, e o maior
  corpo tem 593 bytes, contra o teto de 1.048.576. Dos 777 textos lidos, nenhum tem caractere
  invisível ou de direção.
- **`dev`.** A página aberta num navegador (Chromium sem interface): política presente, nenhuma
  violação no console, mensagem enviada e respondida (a cotação do exemplo, com R$ 2.156,00, e
  a lista de cidades), e outra origem não consegue emoldurar a página. Uma rodada inteira do
  conjunto de desenvolvimento com o código do lote principal: 104 de 104, sem resposta de
  contingência
  ([relatório](../../evals/relatorios/2026-11-14-dev-36e31cb-seguranca.json)). Outra rodada
  inteira com a correção do lead publicada em `dev`: 104 de 104, também sem contingência
  ([relatório](../../evals/relatorios/2026-11-14-dev-2bbbc63-seguranca.json)).
- **`producao`.** Antes do primeiro deploy, uma sonda de base da página (leitura do HTML
  servido e uma cotação do exemplo, sem confirmação), que mostrou o que a borda insere. Lote
  principal publicado às 10h28 (versão `3b2ebbd0`, da `main` `c5817a0`):
  validação de entrega com a mesma contagem de leads de antes (1, o de teste) e validação de
  clientes aprovadas; página no navegador com a política, a cotação do exemplo respondida e a
  moldura recusada. Segunda publicação às 10h37 (versão `9e8b35d1`, da
  `main` `fca6d6d`), com a correção do lead: as mesmas validações aprovadas, com a contagem
  de leads igual, e a página no navegador como antes. Nenhuma validação reprovou e não houve
  volta de versão. O único erro de console em `producao` é o esperado: o script que a borda
  insere, bloqueado pela política.
- **Não rodou de novo:** as três rodadas oficiais, o conjunto reservado, o simulador e a
  rajada. Os números oficiais continuam sendo os da árvore `9d37f9a`. A skill não auditou as
  correções.
- **Não foi medido:** o texto que o modelo escreve ao hóspede quando a confirmação é recusada
  por data passada. O teste do turno usa modelo falso, e em `dev` não há como adiantar o
  relógio. O que o código garante, e o teste prova, é nada enviado, resumo descartado e
  `handoff: false`.

## O que ficou com o Éverton

- **Script da borda na página de `producao`.** Medido antes do deploy, só com leitura do HTML
  servido: em `producao` a borda da Cloudflare insere na página um script de detecção de robôs
  e, em parte dos pedidos, um link oculto. A política mantém o link oculto (`413d619`) e
  bloqueia o script, de propósito: `script-src` continua só com o hash do script da página. O
  efeito é um erro no console do navegador a cada carga, sem efeito na conversa. Tirar o erro
  pede configuração da zona, que é do Éverton, ou política por nonce, que fica para "O que
  faria com mais tempo".
- **Gasto do modelo.** Sem pendência nova: vale o limite 24, com o limite de gasto na conta do
  provedor como controle (X29).
