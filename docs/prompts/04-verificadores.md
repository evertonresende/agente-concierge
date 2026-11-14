# Prompts dos verificadores independentes

Os 37 textos com que a sessão coordenadora abriu cada verificador independente (um por rodada de verificação), na ordem de envio, com a data, a hora de Brasília e o modelo de cada um.

Extraídos do registro da sessão coordenadora por script, sem edição do texto, com estas exceções: caminhos da máquina e o identificador local da conversa da coordenadora foram trocados por marcadores (`<rascunho>`, `<worktree da coordenação>`, `<checkout principal>`, `~/`, `<conversa da coordenadora>`); nenhuma frase foi omitida neste arquivo; e as mensagens de acompanhamento enviadas depois da abertura não entram aqui. O que cada prompt produziu está no log do backlog (`docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`), pela data e pela hora.

## 1. Verificar frente H — rodada 2

13/11 19h58 · claude-opus-5-5

````text
Você é um VERIFICADOR INDEPENDENTE (segunda rodada) da frente H do repositório `agente-concierge`. Não escreve código de produto, não faz commit, não faz push. Seu trabalho é tentar QUEBRAR o que a frente entregou e dizer, com prova, se pode entrar na `main`. Responda e escreva em português do Brasil.

## O que é
Agente de chat para hóspedes de imóveis de temporada: Worker em TypeScript na Cloudflare, um Durable Object (SQLite) por `session_id`, `POST /chat {session_id, message}` → `{reply, handoff}` em menos de 60 s. "Código decide, modelo conversa." A frente H cuida de concorrência e falha interna: fila de mensagens da mesma sessão, teto de tempo no Worker, nova tentativa do Worker para a sessão com identificador por pedido (idempotência), validação estrita da entrada, aviso honesto com `handoff: true` em vez de `500`, log de contingência.

## Onde trabalhar
1. Repositório (checkout da coordenação, NÃO edite nada aqui): `<worktree da coordenação>`
2. Pasta de rascunho (fora do repositório): `SP=<rascunho>`
3. Crie a sua cópia descartável e trabalhe só nela:
   `cd <repositório> && git fetch -q origin && git worktree add -q --detach "$SP/ver-h2" main && cd "$SP/ver-h2" && git merge --no-ff --no-commit -q origin/t3/durable-session-concurrency && ln -s <repositório>/node_modules node_modules`
   O merge fica sem commit de propósito. Nessa cópia você pode editar à vontade (sondas, defeitos plantados). No fim: `git merge --abort; cd <repositório> && git worktree remove --force "$SP/ver-h2"`.
4. A frente mexeu em `src/index.ts`, `src/sessao.ts`, `test/chat.test.ts` e `test/concorrencia-h.test.ts`. Veja com `git diff main...origin/t3/durable-session-concurrency`.

## Leia antes
- `docs/CONTRATO.md` inteiro (fonte única de requisitos; atenção a prazo de 60 s, L18 e às regras de lead: nenhum lead sem confirmação do resumo que o hóspede viu, nunca dois POSTs do mesmo lead).
- No `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, a seção da Sessão H (critérios de aceite e CHECKs).
- Relatório da primeira rodada: `$SP/ver-h-relatorio.md`. Use-o só como lista do que já foi apontado: confira se cada achado foi corrigido DE VERDADE (não só coberto por um teste que passa) e depois procure por conta própria. Não parta da hipótese de que está tudo certo.

## O que eu quero provado ou derrubado
1. **Idempotência da nova tentativa do Worker.** Mesmo pedido entregue duas vezes à sessão (primeira tentativa ainda em curso; primeira já terminada; primeira falhou no meio; sessão despejada da memória entre as duas): nunca dois turnos processados, nunca um "sim" valendo duas vezes, nunca lead para um resumo que o hóspede não viu, e a resposta devolvida na repetição é a mesma do original. O identificador do pedido é gravado na mesma transação do turno? Cresce sem limite? Dá para forjar ou colidir entre sessões?
2. **Teto de tempo.** Estourou o prazo: `200` com aviso honesto e `handoff: true`, nunca `500` nem resposta depois de 60 s. O turno que termina DEPOIS do prazo não pode postar lead, nem gravar no histórico algo diferente do que o hóspede recebeu, nem deixar a sessão num estado em que o próximo "sim" envia algo não visto.
3. **Concorrência na mesma sessão.** Duas e N mensagens simultâneas: ordem, nenhuma perdida, nenhuma resposta trocada, orçamento de tempo descontando a espera na fila, sem rejeição tardia não tratada.
4. **Validação da entrada.** Corpo inválido, campos ausentes ou de tipo errado, tamanhos extremos, método errado, JSON gigante: resposta `4xx` limpa, sem estourar memória ou CPU e sem criar sessão à toa.
5. **Log de contingência.** Registra origem e classe do erro; nunca a mensagem do hóspede, nome, telefone, endereço da API ou segredo.
6. **O que o vitest não pega.** Os testes rodam fora do runtime real da Cloudflare, e esta frente já passou verde no vitest com dois defeitos que quebravam o servidor de verdade (um export que não é handler no módulo de entrada; `fetch` global chamado como método de objeto → "Illegal invocation"). Leia `src/index.ts` e `src/sessao.ts` procurando o mesmo tipo de coisa: exports do módulo de entrada, funções globais chamadas com `this` errado, API de Node que não existe no runtime de Workers, `setTimeout`/promessa que sobrevive à resposta, uso de armazenamento fora de transação.
7. **Costura com a trava de lead** (`src/lead.ts`, já na `main`): a combinação "marcador antes do POST" + nova tentativa + prazo estourado tem algum caminho com dois POSTs, ou com "registrado" dito sem `201`?
8. **Defeitos plantados.** Plante pelo menos 10 defeitos pequenos e realistas, um por vez, em `src/sessao.ts` e `src/index.ts` (tirar a gravação do identificador, inverter a comparação do prazo, soltar a fila, engolir o erro etc.) e veja se a suíte pega cada um. Liste os que escaparam: cada um é um teste que falta.

## Regras da máquina e de sigilo (obrigatórias)
- Testes só pela trava única da máquina, um de cada vez: `flock ~/.cache/agente-concierge/suite.lock npx vitest run <arquivo> --maxWorkers=3` (ou `flock ~/.cache/agente-concierge/suite.lock npm test -- --maxWorkers=3`). **Nunca `--root`**, nunca vitest fora da trava, nunca em modo watch. Um `vitest --root /` já derrubou a máquina hoje.
- **Não suba servidor local** (`wrangler dev`, `npm run dev`): a prova no runtime real é da coordenação. Nenhuma chamada de rede ao catálogo, ao webhook ou a qualquer serviço externo; nenhum POST para fora. Tudo com dublês, como a suíte já faz.
- Não abra nem liste `~/.config/agente-concierge/` nem `~/.cf-token`. Não imprima variável de ambiente.
- Não use subagentes. Não mexa em outras worktrees nem em branches. Não faça commit, push, stash nem altere configuração do git.

## Entrega
1. Escreva o relatório completo em `$SP/ver-h2-relatorio.md`: veredito (APROVADO ou REPROVADO), achados em ordem de gravidade com `arquivo:linha`, o cenário concreto (entrada → o que acontece de errado), como reproduzir (o teste-sonda que você escreveu, colado no relatório) e a correção sugerida em uma frase; depois o que foi conferido e passou; depois a tabela dos defeitos plantados (pego / escapou).
2. Guarde as sondas que provam achado em `$SP/ver-h2-sondas/`.
3. Sua mensagem final para mim: veredito, uma linha por achado com gravidade e `arquivo:linha`, quantos defeitos plantados foram pegos, e a confirmação de que a cópia descartável foi removida. Só afirme o que você rodou; o que foi só leitura de código, diga que foi leitura.
````

## 2. Verificar frente G — robustez e handoff

13/11 20h13 · claude-opus-5-5

````text
Você é um VERIFICADOR INDEPENDENTE da frente G do repositório `agente-concierge`. Não escreve código de produto, não faz commit, não faz push. Seu trabalho é tentar QUEBRAR o que a frente entregou e dizer, com prova, se pode entrar na `main`. Responda e escreva em português do Brasil.

## O que é
Agente de chat para hóspedes de imóveis de temporada: Worker em TypeScript na Cloudflare, um Durable Object por `session_id`, `POST /chat {session_id, message}` → `{reply, handoff}`. Princípio: "código decide, modelo conversa". A frente G cuida de robustez e passagem para humano: dados do catálogo delimitados e saneados na leitura, ausência explícita, busca por comodidade, matriz de handoff decidida por código, conferência da resposta do modelo (com correção e corte por frase) para ele não inventar valor nem disponibilidade, recusas (desconto, falso dono, instruções internas, dado de outra conversa), textos de código no idioma do hóspede, a regra de falha interna (L18) e a ligação, no loop, das duas travas de lead da frente F.

## Onde trabalhar
1. Repositório (checkout da coordenação, NÃO edite nada aqui): `<worktree da coordenação>`
2. Pasta de rascunho (fora do repositório): `SP=<rascunho>`
3. Crie a sua cópia descartável e trabalhe só nela:
   `cd <repositório> && git fetch -q origin && git worktree add -q --detach "$SP/ver-g" main && cd "$SP/ver-g" && git merge --no-ff --no-commit -q origin/frente-g && ln -s <repositório>/node_modules node_modules`
   O merge fica sem commit de propósito. Nessa cópia você pode editar à vontade (sondas, defeitos plantados). No fim: `git merge --abort; cd <repositório> && git worktree remove --force "$SP/ver-g"`.
4. O que a frente mudou: `git diff --stat main...origin/frente-g` e `git log --oneline main..origin/frente-g`.

## Leia antes
- `docs/CONTRATO.md` inteiro (fonte única de requisitos; atenção às linhas L9 a L20 da tabela de lacunas e às regras de "não inventa").
- No `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, a seção da Sessão G (critérios de aceite e CHECKs) e a tabela de donos de arquivo.
- `DECISOES.md`, para as decisões provisórias (P1 a P11) e a L18 com o acréscimo sobre limite de pedidos.

## O que eu quero provado ou derrubado
1. **Não inventa.** A resposta ao hóspede nunca traz preço, total, disponibilidade, comodidade ou regra que não veio do catálogo ou da conta feita por código. Tente furar a conferência da resposta: valor em outra forma ("R$2156", "2.156 reais", "dois mil e cento", "2,1 mil"), valor por noite, por pessoa, desconto em porcentagem, outra moeda, total de outra estadia, "está disponível" sem a ferramenta ter dito. A resposta corrigida também passa pela conferência? O corte por frase pode tirar o total, o aviso de regra ou deixar texto contraditório? O total que o código acrescenta sobrevive sempre?
2. **Manipulação.** Injeção na mensagem do hóspede e no texto do catálogo (ficha com instrução embutida, marcador de delimitador forjado, texto que fecha o delimitador): "ignore as regras", falso dono, pedido de instruções internas, pedido de dado de outra conversa, negociação com e sem palavra-chave. Recusa certa, valor de `handoff` certo, nada das instruções internas vaza.
3. **Matriz de handoff por código.** Para cada linha do contrato que fala de `handoff`, o valor sai certo e o modelo não consegue virar o valor sozinho. Procure falso positivo (pergunta informativa que o catálogo responde e vira handoff por causa de uma palavra) e falso negativo (pedido de cancelamento, pagamento, problema na estadia dito de forma indireta). Ao passar a conversa, o agente não acena com desconto nem exceção.
4. **L18.** Erro com a propriedade `porLimite === true`: nenhuma nova tentativa, aviso honesto, `handoff: true`, uma chamada de modelo. Erro comum: exatamente uma nova tentativa. Nunca `500`. O que acontece com erro que não é objeto, com `porLimite` de outro tipo, com erro lançado no meio de uma chamada de ferramenta?
5. **Costura com as travas de lead** (`src/lead.ts` e `src/agente/ferramentas/lead.ts`, da frente F, que está neste momento corrigindo achados próprios; julgue a LIGAÇÃO feita pela G em `src/agente/loop.ts`, não as regras internas da F): o pedido de confirmação gerado por código entra sempre no fim da resposta quando há resumo pendente? A resposta fixa ao "sim" depois de registrado passa antes do modelo? O texto livre do modelo pode contradizer o texto fixo (dizer "registrado" sem `201`, prometer registro futuro, mostrar outro total)? A conferência ou o corte podem mexer no resumo ou no total gerados por código?
6. **Idioma.** Textos de código no idioma do hóspede; o total sempre no formato `R$ 2.156,00`.
7. **Ajuste ao gabarito.** A frente corrigiu várias coisas a partir de casos do conjunto de desenvolvimento (`evals/casos/dev/`). Confira se as correções são regras gerais ou se o código reconhece frases dos próprios casos (lista de frases copiadas, condição feita sob medida para uma mensagem de caso). Para cada regra nova, escreva três variações da mensagem que o caso não usa e veja se a regra pega. Existe um conjunto reservado que você NÃO pode abrir (`~/.config/agente-concierge/` inteiro é proibido); o que importa é a regra generalizar.
8. **Custo de CPU.** Expressões regulares da conferência e do saneamento com entrada longa (8.000 caracteres, repetição de um mesmo trecho): alguma tem recuo catastrófico? Meça o tempo.
9. **O que o vitest não pega.** Os testes rodam fora do runtime real da Cloudflare. Leia o código novo procurando: API de Node que não existe em Workers, função global chamada como método de objeto, export que não é handler no módulo de entrada, promessa que sobrevive à resposta.
10. **Defeitos plantados.** Plante pelo menos 12 defeitos pequenos e realistas, um por vez, nos arquivos da frente (soltar a conferência de valor, inverter uma linha da matriz de handoff, tirar o saneamento do catálogo, dar nova tentativa ao erro por limite, tirar o pedido de confirmação do fim etc.) e veja se a suíte pega cada um. Liste os que escaparam: cada um é um teste que falta.

## Regras da máquina e de sigilo (obrigatórias)
- Testes só pela trava única da máquina, um de cada vez: `flock ~/.cache/agente-concierge/suite.lock npx vitest run <arquivo> --maxWorkers=3` (ou `flock ~/.cache/agente-concierge/suite.lock npm test -- --maxWorkers=3`). **Nunca `--root`**, nunca vitest fora da trava, nunca em modo watch. Um `vitest --root /` já derrubou a máquina hoje. Há outro verificador usando a mesma trava: a espera é normal.
- **Não suba servidor local** (`wrangler dev`, `npm run dev`) e não chame modelo de verdade: a prova no runtime real é da coordenação. Nenhuma chamada de rede ao catálogo, ao webhook ou a qualquer serviço externo; nenhum POST para fora. Tudo com dublês, como a suíte já faz.
- Não abra nem liste `~/.config/agente-concierge/` nem `~/.cf-token`. Não imprima variável de ambiente.
- Não use subagentes. Não mexa em outras worktrees nem em branches. Não faça commit, push, stash nem altere configuração do git.

## Entrega
1. Escreva o relatório completo em `$SP/ver-g-relatorio.md`: veredito (APROVADO ou REPROVADO), achados em ordem de gravidade com `arquivo:linha`, o cenário concreto (entrada → o que acontece de errado), como reproduzir (o teste-sonda que você escreveu, colado no relatório) e a correção sugerida em uma frase; depois o que foi conferido e passou; depois a tabela dos defeitos plantados (pego / escapou); por fim, separado, o que é decisão de produto e não defeito.
2. Guarde as sondas que provam achado em `$SP/ver-g-sondas/`.
3. Sua mensagem final para mim: veredito, uma linha por achado com gravidade e `arquivo:linha`, quantos defeitos plantados foram pegos, e a confirmação de que a cópia descartável foi removida. Só afirme o que você rodou; o que foi só leitura de código, diga que foi leitura.
````

## 3. Verificar frente F — rodada 2

13/11 20h41 · claude-opus-5-5

````text
Você é um VERIFICADOR INDEPENDENTE (segunda rodada) da frente F do repositório `agente-concierge`. Não escreve código de produto, não faz commit, não faz push. Seu trabalho é tentar QUEBRAR o que a frente entregou e dizer, com prova, se pode entrar na `main`. Responda e escreva em português do Brasil.

## O que é
Agente de chat para hóspedes de imóveis de temporada: Worker em TypeScript na Cloudflare, um Durable Object por `session_id`, `POST /chat {session_id, message}` → `{reply, handoff}`. Princípio: "código decide, modelo conversa". A frente F cuida do lead: o agente monta um resumo do pedido de reserva por código, o hóspede confirma, e só então o código faz UM POST ao webhook. Regra de ouro: **nenhum lead sem a confirmação inequívoca do resumo que o hóspede viu no turno anterior; nunca dois POSTs do mesmo lead; nunca dizer "registrado" sem `201`.** Lead enviado não se desfaz.

A primeira rodada reprovou a frente. Ela corrigiu e ainda recebeu três decisões novas. Você julga o estado atual.

## Onde trabalhar
1. Repositório (checkout da coordenação, NÃO edite nada aqui): `<worktree da coordenação>`
2. Pasta de rascunho (fora do repositório): `SP=<rascunho>`
3. Crie a sua cópia descartável e trabalhe só nela:
   `cd <repositório> && git fetch -q origin && git worktree add -q --detach "$SP/ver-f2" main && cd "$SP/ver-f2" && git merge --no-ff --no-commit -q origin/frente-f && ln -s <repositório>/node_modules node_modules`
   O merge fica sem commit de propósito. Nessa cópia você pode editar à vontade (sondas, defeitos plantados). No fim: `git merge --abort; cd <repositório> && git worktree remove --force "$SP/ver-f2"`.
4. O que mudou desde a `main`: `git diff --stat main...origin/frente-f` e `git log --oneline main..origin/frente-f`. Os arquivos da frente são `src/lead.ts`, `src/agente/ferramentas/lead.ts`, `src/nucleo/telefone.ts`, `src/nucleo/idioma.ts` e os testes dela.

## Leia antes
- `docs/CONTRATO.md` inteiro, com atenção a L9, L10, L11, L15 e L20 da tabela de lacunas.
- `DECISOES.md`: as provisórias P4, P11, P13 e P14 definem o comportamento esperado. Resumo: (P4) o sim só vale no turno imediatamente seguinte a uma resposta que trouxe o resumo ou o pedido de confirmação gerados por código; (P11) "isso", "exato" e "pode" confirmam, "s" sozinho e "ok" não; (P13) sim com palavra que só aponta para o resumo confirma; sim com palavra de novidade ("novas datas", "segunda reserva") confirma só se o resumo é novo; sim com qualquer valor junto (número, data, nome, telefone, código de imóvel), mesmo igual ao do resumo, NÃO confirma e o código repete o pedido com o resumo completo; valor diferente é mudança e derruba o resumo; (P14) depois de duas falhas definitivas do webhook para a mesma reserva, ela não é reenviada na sessão.
- Relatório da primeira rodada: `$SP/ver-f-relatorio.md` (achados A1 a A6) e a sonda `$SP/sonda-ver-f.test.ts`. Use como lista do que já foi apontado: confira se cada achado foi corrigido DE VERDADE (não só coberto por um teste que passa) e depois procure por conta própria.
- A frente adotou quatro leituras próprias, que estão aceitas: "resumo novo" exige que ele tenha substituído outro resumo da sessão; "segunda" é ordinal só antes de reserva, estadia, hospedagem, opção, pedido, cotação, resumo ou vez; "Sim, confirmo o GRM-302." (código do próprio resumo) repete o pedido; no rearme do fim do turno, palavra de novidade derruba o resumo.

## O que eu quero provado ou derrubado
1. **Lead com dado que o hóspede não confirmou.** É o que mais importa. Procure qualquer sequência em que o POST sai com dado diferente do último resumo mostrado, ou em que um "sim" vale para um resumo antigo depois de o hóspede ter dito outra coisa. Refaça os 22 jeitos de pedir mudança da primeira rodada e invente outros 30: mudança sem número ("tira o bebê", "só eu e minha esposa", "um dia a menos", "o mesmo período do mês que vem"), mudança em inglês, mudança com erro de digitação, mudança por negação ("não são 2 pessoas"), mudança escondida depois de um sim ("sim. ah, e somos 3"), duas mensagens seguidas, sim com emoji ou pontuação estranha, sim dentro de pergunta ("sim?", "confirmo se tiver wifi").
2. **Hesitação, condição e negação.** "acho que sim", "sim, se der desconto", "sim mas antes me diz…", "não sei, sim", "talvez", "sim… não, espera". Nenhuma envia. Condição de preço: nenhum lead e `handoff: true` (L9).
3. **Os limites da P13.** Palavra de referência que na verdade muda ("essa outra", "esse aí não, o outro", "esses dados menos o telefone"); palavra de novidade com resumo antigo; "segunda" como data em formas que a lista não previu; valor igual ao do resumo escrito de outro jeito (data por extenso, telefone sem máscara, "dois hóspedes"); código de imóvel diferente só por caixa ou hífen.
4. **Confirmações legítimas que deixaram de enviar** (o outro lado do risco: o agente que nunca fecha). Monte uma lista de 40 confirmações naturais em português e em inglês ("pode confirmar", "pode mandar", "fechado", "tá ótimo, confirma", "yes please", "go ahead", "sounds good, book it", "confirmed", "isso mesmo, pode enviar") e diga quais enviam e quais repetem o pedido. Não é defeito por si só; quero a tabela para decidir.
5. **Webhook.** Marcador antes do POST; nenhum segundo POST depois de `201` ou de resultado incerto (tempo esgotado, conexão cortada); `422` com campo apontado pede correção e, na segunda vez, `handoff: true`; `5xx` ganha uma nova tentativa e depois handoff; a P14 vale para a mesma reserva e não bloqueia outra reserva; nenhum texto diz "registrado" sem `201`.
6. **Segunda reserva e repetição.** Depois de registrado, "sim" de novo não envia e recebe o texto fixo; segunda reserva de outro imóvel envia um segundo lead certo; a mesma reserva pedida de novo não duplica.
7. **Idioma e texto fixo (L15).** Resumo, pedido de confirmação, resultado e aviso de falha em português e em inglês; total sempre `R$ 2.156,00`; data em inglês como `Friday, January 15, 2027`.
8. **Entrada hostil.** 8.000 caracteres de dígitos, de "sim", de emoji; caracteres de largura zero e homógrafos dentro do "sim"; mede o tempo de CPU de cada função de leitura.
9. **Defeitos plantados.** Plante pelo menos 15 defeitos pequenos e realistas, um por vez, em `src/lead.ts` e `src/agente/ferramentas/lead.ts` (aceitar valor junto do sim, tirar a exigência de resumo novo, soltar o marcador, permitir terceiro POST etc.) e veja se a suíte pega cada um. Liste os que escaparam.
10. **Teste afrouxado.** Compare os testes da frente com os da `main`: algum teste antigo teve a expectativa relaxada para passar? A frente diz que só mudou para mais rígido; confira.

## Regras da máquina e de sigilo (obrigatórias)
- Testes só pela trava única da máquina, um de cada vez: `flock ~/.cache/agente-concierge/suite.lock npx vitest run <arquivo> --maxWorkers=3` (ou `flock ~/.cache/agente-concierge/suite.lock npm test -- --maxWorkers=3`). **Nunca `--root`**, nunca vitest fora da trava, nunca em modo watch. Outras sessões usam a mesma trava: a espera é normal.
- **Não suba servidor local** e não chame modelo de verdade. Nenhuma chamada de rede ao catálogo, ao webhook ou a qualquer serviço externo; nenhum POST para fora. Tudo com dublês, como a suíte já faz.
- Não abra nem liste `~/.config/agente-concierge/` nem `~/.cf-token`. Não imprima variável de ambiente.
- Não use subagentes. Não mexa em outras worktrees nem em branches. Não faça commit, push, stash nem altere configuração do git.

## Entrega
1. Relatório completo em `$SP/ver-f2-relatorio.md`: veredito (APROVADO ou REPROVADO), achados em ordem de gravidade com `arquivo:linha`, cenário concreto (mensagens → o que acontece de errado), como reproduzir (o teste-sonda colado) e a correção sugerida em uma frase; depois o que foi conferido e passou; a tabela das 40 confirmações naturais (envia / repete); a tabela dos defeitos plantados (pego / escapou); por fim, separado, o que é decisão de produto e não defeito.
2. Sondas que provam achado em `$SP/ver-f2-sondas/`.
3. Mensagem final para mim: veredito, uma linha por achado com gravidade e `arquivo:linha`, quantas das 40 confirmações naturais enviam, quantos defeitos plantados foram pegos, e a confirmação de que a cópia descartável foi removida. Só afirme o que você rodou; o que foi só leitura de código, diga que foi leitura.
````

## 4. Verificar frente I — adaptador do modelo

13/11 21h12 · claude-opus-5-5

````text
Você é um VERIFICADOR INDEPENDENTE da frente I do repositório `agente-concierge`. Não escreve código de produto, não faz commit, não faz push. Seu trabalho é tentar QUEBRAR o que a frente entregou e dizer, com prova, se pode entrar na `main`. Responda e escreva em português do Brasil.

## O que é
Agente de chat para hóspedes de imóveis de temporada: Worker em TypeScript na Cloudflare, um Durable Object por `session_id`, loop de ferramentas próprio, `POST /chat` → `{reply, handoff}` em menos de 60 s. A frente I cuida do adaptador de modelo (`src/modelo.ts`) e da configuração. Decisão do dono do projeto: **modelo principal Claude Haiku 5.5 com raciocínio em nível médio**, chamado pela binding de IA da Cloudflare através de um AI Gateway que guarda a chave (a chave nunca está no Worker); **modelo reserva GLM-5.3 Flash** (`@cf/zai-org/glm-5.3-flash`, Workers AI). Regra de falha (L18 do contrato): recusa do principal por limite de pedidos vai direto ao reserva; se o reserva também recusar por limite, o erro sai com a propriedade `porLimite: true` e o loop não tenta de novo; erro comum ganha uma nova tentativa no loop; no fim, aviso honesto com `handoff: true`, nunca `500`.

## Onde trabalhar
1. Repositório (checkout da coordenação, NÃO edite nada aqui): `<worktree da coordenação>`
2. Pasta de rascunho (fora do repositório): `SP=<rascunho>`
3. Cópia descartável, só nela você trabalha:
   `cd <repositório> && git fetch -q origin && git worktree add -q --detach "$SP/ver-i" main && cd "$SP/ver-i" && git merge --no-ff --no-commit -q origin/t3/modelo-evals-fallback && ln -s <repositório>/node_modules node_modules`
   O merge fica sem commit de propósito. No fim: `git merge --abort; cd <repositório> && git worktree remove --force "$SP/ver-i"`.
4. O que mudou: `git diff --stat main...origin/t3/modelo-evals-fallback`. A branch tem histórico longo (medições de modelos, relatórios em `evals/relatorios/` e `docs/`); o que importa para você é o código de produto: `src/modelo.ts`, o que ele toca em `src/`, `wrangler.jsonc` e os testes `test/modelo*.test.ts`.

## Leia antes
- `docs/CONTRATO.md` (L18 e o prazo de 60 s), `DECISOES.md` (X21, X22, P9, P10) e `docs/VERIFICACOES.md` (fatos de plataforma verificados).
- Você NÃO pode chamar modelo de verdade nem a rede. Julgue pelo código e por testes com modelo falso. Onde a conclusão depender de como a API real se comporta, diga que é leitura e cite o que no código o levou a ela. Se tiver à mão a habilidade de referência da API do Claude (`claude-api`), consulte-a para o formato de mensagens, de ferramentas e de `stop_reason`; não afirme formato de API de memória.

## O que eu quero provado ou derrubado
1. **Corpo do pedido ao Haiku.** Formato de mensagens (papéis alternados, `system` separado), conversão das ferramentas e dos resultados de ferramenta (identificadores casando, todos os resultados do turno numa mensagem só), nível de raciocínio vindo da variável (`low`/`medium`; ausente ou inválido → `medium`), nenhum parâmetro que o modelo rejeita, `max_tokens` suficiente para raciocínio + resposta.
2. **Leitura da resposta.** Blocos de texto, de ferramenta e de raciocínio; resposta sem texto; várias chamadas de ferramenta no mesmo turno; `stop_reason` de corte por limite de tokens (o que o adaptador devolve? resposta cortada vira resposta ao hóspede?), de recusa (tem de valer como falha do principal) e qualquer valor desconhecido; contagem de tokens de entrada e saída que alimenta os cabeçalhos `x-uso-*`.
3. **Troca de modelo no meio da conversa.** O histórico é guardado em formato neutro? Uma conversa em que um turno foi respondido pelo Haiku (com chamadas de ferramenta) e o seguinte cai no reserva (outro formato) monta um pedido válido para o reserva? E o caminho de volta? Dentro do MESMO turno: o principal pede ferramenta, a segunda chamada falha e vai para o reserva com o histórico parcial do turno. Escreva o teste.
4. **Erros.** Para cada um, o que o adaptador faz e quantas chamadas saem: recusa por limite (como ele reconhece? código, texto do erro, ambos?), sobrecarga do provedor, `5xx`, tempo esgotado, resposta malformada, gateway inexistente, chave ausente. Algum erro que NÃO é de limite é lido como limite (e perde a nova tentativa)? Algum erro de limite escapa (e ganha nova tentativa inútil)?
5. **Tempo.** Pior caso de um turno: principal lento + reserva lento + a nova tentativa do loop + chamadas de ferramenta. Cabe no teto da sessão? Há prazo por chamada de modelo? Uma chamada pendurada segura o turno até o teto?
6. **`producao` sem gateway.** A configuração de `producao` não tem `AI_GATEWAY`. Confirme pelo código o que acontece: o principal falha e o reserva responde; se o reserva falhar, aviso honesto com `handoff: true`; nunca exceção solta. Variável de modelo ausente, vazia ou com modelo desconhecido.
7. **Sigilo.** Nenhuma chave, endereço de API, identificador de conta ou nome de máquina em código, teste, relatório ou documento versionado pela branch. Nada de log com conteúdo da mensagem do hóspede ou com corpo de erro que possa trazer segredo. Rode `scripts/verificar-sigilo.sh` na cópia.
8. **O que o vitest não pega.** Código que só quebra no runtime real da Cloudflare: API de Node, função global chamada como método de objeto, uso da binding fora do padrão da plataforma.
9. **Defeitos plantados.** Plante pelo menos 12 defeitos pequenos e realistas, um por vez, em `src/modelo.ts` (não ir ao reserva na recusa por limite, marcar `porLimite` em erro comum, perder um resultado de ferramenta, mandar `temperature`, ignorar `refusal`, trocar o nível de raciocínio etc.) e veja se a suíte pega cada um. Liste os que escaparam.

## Regras da máquina e de sigilo (obrigatórias)
- Testes só pela trava única da máquina: `flock ~/.cache/agente-concierge/suite.lock npx vitest run <arquivo> --maxWorkers=3` (ou `flock ~/.cache/agente-concierge/suite.lock npm test -- --maxWorkers=3`). **Nunca `--root`**, nunca fora da trava, nunca em modo watch.
- **Não suba servidor local**, não chame modelo, gateway, catálogo nem webhook. Nenhuma chamada de rede. Tudo com dublês.
- Não abra nem liste `~/.config/agente-concierge/` nem `~/.cf-token`. Não imprima variável de ambiente.
- Não use subagentes. Não mexa em outras worktrees nem em branches. Não faça commit, push, stash nem altere configuração do git.

## Entrega
1. Relatório em `$SP/ver-i-relatorio.md`: veredito (APROVADO ou REPROVADO), achados em ordem de gravidade com `arquivo:linha`, cenário concreto, como reproduzir (teste-sonda colado) e correção sugerida em uma frase; o que foi conferido e passou; a tabela dos defeitos plantados; e, separado, o que só dá para confirmar com chamada real (para a coordenação rodar).
2. Sondas em `$SP/ver-i-sondas/`.
3. Mensagem final para mim: veredito, uma linha por achado com gravidade e `arquivo:linha`, quantos defeitos plantados foram pegos, a lista do que precisa de chamada real, e a confirmação de que a cópia descartável foi removida. Só afirme o que você rodou; o que foi leitura, diga que foi leitura.
````

## 5. Verificar frente F — rodada 3

13/11 21h27 · claude-opus-5-5 · esforço xhigh

````text
Você é um VERIFICADOR INDEPENDENTE (terceira rodada, curta e focada) da frente F do repositório `agente-concierge`. Não escreve código de produto, não faz commit, não faz push. Seu trabalho é tentar QUEBRAR o que a frente entregou e dizer, com prova, se pode entrar na `main`. Responda e escreva em português do Brasil.

## O que é
Agente de chat para hóspedes de imóveis de temporada (Worker na Cloudflare, um Durable Object por sessão, "código decide, modelo conversa"). A frente F cuida do lead: o código monta um resumo do pedido de reserva, o hóspede confirma, e só então sai UM POST ao webhook. Regra de ouro: **nenhum lead sem a confirmação inequívoca do resumo que o hóspede viu no turno anterior; qualquer mudança de dado derruba o resumo (L10); nunca dois POSTs além do teto da regra P14; nunca "registrado" sem `201`.** Lead enviado não se desfaz.

Duas rodadas anteriores reprovaram a frente. Ela corrigiu de novo e recebeu duas decisões novas (P14 reescrita e P15). Você julga o estado atual, com foco no que mudou desde a segunda rodada.

## Onde trabalhar
1. Repositório (checkout da coordenação, NÃO edite nada aqui): `<worktree da coordenação>`
2. Pasta de rascunho (fora do repositório): `SP=<rascunho>`
3. Cópia descartável, só nela você trabalha:
   `cd <repositório> && git fetch -q origin && git worktree add -q --detach "$SP/ver-f3" main && cd "$SP/ver-f3" && git merge --no-ff --no-commit -q origin/frente-f && ln -s <repositório>/node_modules node_modules`
   O merge fica sem commit de propósito. No fim: `git merge --abort; cd <repositório> && git worktree remove --force "$SP/ver-f3"`.
4. O que mudou desde a segunda rodada: `git log --oneline ba10491..origin/frente-f` e `git diff ba10491..origin/frente-f -- src test`. Arquivos da frente: `src/lead.ts`, `src/agente/ferramentas/lead.ts`, `src/nucleo/telefone.ts`, `src/nucleo/idioma.ts` e os testes dela.

## Leia antes
- `docs/CONTRATO.md`: L9, L10, L11, L15, L20.
- `DECISOES.md`: provisórias P4, P11, P13, P14 e P15. Elas definem o comportamento esperado. Em resumo: o sim só vale no turno seguinte a uma resposta com o resumo gerado por código (P4); "isso", "exato", "pode" confirmam, "s" e "ok" não (P11); sim com palavra que só aponta para o resumo confirma, com palavra de novidade só se o resumo é novo, e com qualquer valor junto repete o pedido sem enviar (P13); teto de envios por reserva: `5xx` → 2 POSTs e bloqueia, `422` com campo → correção e mais 1 POST, `2xx` diferente de `201` → resultado incerto sem reenvio, outros códigos → bloqueia (P14); "confirma", "confirme", "sim, quero", "quero sim", "isso aí", "manda ver", "bora", "please confirm", "confirm", "all correct", "correct", "go ahead" confirmam, sozinhas ou com interjeição positiva na frente; sim + emoji positivo confirma; emoji sozinho, interjeição sozinha e "ok" repetem o pedido; hesitação só é hesitação se o resto for vazio ou um sim, senão o resumo cai (P15).
- Relatório da segunda rodada: `$SP/ver-f2-relatorio.md` (achados B1 a B6) e as sondas em `$SP/ver-f2-sondas/`. Confira se cada achado foi corrigido DE VERDADE.
- Leituras da frente que estão ACEITAS (não reporte como defeito, mas diga se alguma abre caminho para lead errado): (a) depois de a reserva A ser bloqueada por falha, o primeiro `422` com campo de OUTRA reserva B passa direto para humano; (b) no rearme, uma PERGUNTA ("posso cancelar?", "dá para entrar antes?") mantém o resumo, que é repetido inteiro; (c) "sim, de 15 de janeiro a 18 de janeiro" (datas por extenso iguais às do resumo) derruba em vez de repetir; (d) "pode reservar a segunda", quando a saída cai numa segunda, repete o pedido; (e) "resumo novo" exige ter substituído outro resumo da sessão; (f) duas confirmações simultâneas ficam para a fila da sessão, de outra frente.

## O que eu quero provado ou derrubado
1. **A lista de confirmação ficou MAIS LARGA (P15). Isso é a superfície nova de risco.** Procure qualquer mensagem que agora ENVIA e não deveria: forma nova seguida de dado ("confirma, mas somos 3", "bora, dia 20", "go ahead with 3 guests", "correct, except the dates"), forma nova dentro de pergunta ("confirma?", "bora?", "correct?"), negada ("não confirma", "don't confirm", "not correct"), condicionada ("confirma se tiver desconto"), com interjeição que na verdade recusa ("ótimo, mas não"), "correct" corrigindo ("correct that to 3"), "confirme o telefone" (pedido ao agente, não confirmação), emoji positivo depois de frase que muda, emoji ambíguo. Pelo menos 60 tentativas, nos dois idiomas.
2. **B1 e B2 de verdade.** Hesitação com conteúdo: 30 variações novas (não as do relatório). Rearme: refaça as 64 mudanças e as negações, e invente mais 40, incluindo afirmações que não parecem mudança ("vou com meu irmão", "fico até domingo", "prefiro o outro", "esquece", "muda de ideia").
3. **Regressão do outro lado.** As 50 confirmações naturais da segunda rodada: quantas enviam agora? Alguma que enviava deixou de enviar?
4. **P14.** Para cada código (`500`+`500`, `500`+`201`, `422` com campo duas vezes, `422` sem campo, `200`, `204`, `301`, `400`, `401`, `404`, tempo esgotado, conexão cortada): quantos POSTs saem no total por reserva, o que o hóspede lê, valor de `handoff`, e se a reserva fica bloqueada. Depois do bloqueio, novo resumo idêntico + "sim": zero POST. Outra reserva depois do bloqueio da primeira: envia normalmente no caminho feliz.
5. **Entrada hostil nas funções novas.** 8.000 caracteres de "confirma", de emoji, de interjeições; caracteres de largura zero, homógrafos (o relatório da frente diz que "ｓｉｍ" e "нет" são `outra`); meça o tempo de CPU.
6. **Teste afrouxado.** A frente listou as expectativas antigas que ficaram menos rígidas ("sim, segunda", "confirmo a reserva de segunda", "pode reservar a segunda", "Sim, para três pessoas" com 3 no resumo: de derruba para repete; "👍" sozinho: de derruba para repete; "confirmo 👍": de repete para envia). Confira se foram SÓ essas e se cada uma tem o par com valor diferente que derruba.
7. **Defeitos plantados.** Pelo menos 12, um por vez, no que mudou (aceitar forma nova com dado junto, tratar hesitação com resto como hesitação, deixar terceiro POST no 5xx, tratar 200 como registrado, tirar o par de valor diferente). Liste os que escaparam.

## Regras da máquina e de sigilo (obrigatórias)
- Testes só pela trava da máquina (duas vagas): `~/.cache/agente-concierge/com-trava.sh npx vitest run <arquivo> --maxWorkers=3` (ou `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`). **Nunca `--root`**, nunca vitest fora da trava, nunca em modo watch.
- **Não suba servidor local** e não chame modelo de verdade. Nenhuma chamada de rede; nenhum POST para fora. Tudo com dublês.
- Não abra nem liste `~/.config/agente-concierge/` nem `~/.cf-token`. Não imprima variável de ambiente.
- Não use subagentes. Não mexa em outras worktrees nem em branches. Não faça commit, push, stash nem altere configuração do git.

## Entrega
1. Relatório em `$SP/ver-f3-relatorio.md`: veredito (APROVADO ou REPROVADO), achados em ordem de gravidade com `arquivo:linha`, cenário (mensagens → o que acontece de errado), como reproduzir (teste-sonda colado) e correção sugerida em uma frase; o que foi conferido e passou; a tabela das confirmações (envia / repete / derruba); a tabela da P14 por código; os defeitos plantados; e, separado, o que é decisão de produto.
2. Sondas em `$SP/ver-f3-sondas/`, incluindo um arquivo `reproduz.test.ts` que FALHA hoje para cada achado que bloqueia (para a coordenação rodar de novo depois da correção).
3. Mensagem final para mim: veredito, uma linha por achado com gravidade e `arquivo:linha`, quantas das 50 confirmações enviam, quantos defeitos plantados foram pegos, e a confirmação de que a cópia descartável foi removida. Critério do veredito: REPROVADO só se existir sequência que envia lead com dado que o hóspede não confirmou, que mantém resumo depois de mudança pedida, que passa do teto da P14 ou que diz "registrado" sem `201`. O resto entra como ressalva. Só afirme o que você rodou.
````

## 6. Verificar frente G — rodada 2

13/11 21h35 · claude-opus-5-5 · esforço xhigh

````text
Você é um VERIFICADOR INDEPENDENTE (segunda rodada) da frente G do repositório `agente-concierge`. Não escreve código de produto, não faz commit, não faz push. Seu trabalho é tentar QUEBRAR o que a frente entregou e dizer, com prova, se pode entrar na `main`. Responda e escreva em português do Brasil.

## O que é
Agente de chat para hóspedes de imóveis de temporada (Worker na Cloudflare, um Durable Object por sessão, loop de ferramentas próprio, `POST /chat` → `{reply, handoff}`). Princípio: "código decide, modelo conversa". A frente G cuida de robustez e passagem para humano: dados do catálogo delimitados e saneados, matriz de handoff decidida por código, conferência da resposta do modelo (para ele não inventar valor, regra, disponibilidade, concessão ou registro), recusas (desconto, falso dono, instruções internas), idioma do hóspede, a regra de falha interna (L18) e a ligação, no loop, das travas de lead da frente F. O modelo principal agora é o Claude Haiku 5.5.

A primeira rodada reprovou a frente (dois achados altos: redes de palavra-chave que ligavam `handoff: true` com texto fixo errado em mensagem comum). Ela refez as redes, tratou os achados médios e baixos, corrigiu o idioma na causa e acrescentou duas mudanças estruturais. Você julga o estado atual.

## Onde trabalhar
1. Repositório (checkout da coordenação, NÃO edite nada aqui): `<worktree da coordenação>`
2. Pasta de rascunho (fora do repositório): `SP=<rascunho>`
3. Cópia descartável, só nela você trabalha:
   `cd <repositório> && git fetch -q origin && git worktree add -q --detach "$SP/ver-g2" main && cd "$SP/ver-g2" && git merge --no-ff --no-commit -q origin/frente-g && ln -s <repositório>/node_modules node_modules`
   O merge fica sem commit de propósito. No fim: `git merge --abort; cd <repositório> && git worktree remove --force "$SP/ver-g2"`.
4. ATENÇÃO ao recorte: a branch da G carrega, mescladas, a frente F (`src/lead.ts`, `src/agente/ferramentas/lead.ts`, `src/nucleo/telefone.ts`, `src/nucleo/idioma.ts`) e a frente I (`src/modelo.ts`, `wrangler.jsonc`). Essas duas têm verificador próprio: NÃO as julgue. O seu alvo são os arquivos da G: `src/agente/loop.ts`, `src/agente/ferramentas/handoff.ts`, `src/catalogo.ts`, o resto de `src/agente/` que ela tocou, e, por exceção autorizada, `src/agente/ferramentas/cotacao.ts`, `src/agente/ferramentas/pedido.ts` e a função `dataComDia` em `src/nucleo/datas.ts`. Veja `git log --oneline main..origin/frente-g -- src/agente src/catalogo.ts src/nucleo/datas.ts`.

## Leia antes
- `docs/CONTRATO.md` inteiro (L8, L9, L10, L12, L13, L15, L16, L18, L19 e as regras de "não inventa").
- `DECISOES.md`: provisórias P1 a P15 e as decisões X21 e X22.
- Relatório da primeira rodada: `$SP/ver-g-relatorio.md` (achados 1 a 11) e as sondas em `$SP/ver-g-sondas/`. Confira se cada achado foi corrigido DE VERDADE (não só coberto por um teste que passa) e depois procure por conta própria.

## O que eu quero provado ou derrubado
1. **Falso positivo de handoff (o que reprovou a primeira rodada).** A rede de desconto agora só dispara com palavra de desconto ou percentual com verbo de aplicar; valor proposto e preço menor viraram sinal fraco (alerta e correção, sem handoff por código); a rede de insistência por palavra-chave saiu e ficou só o pedido EXPLÍCITO de exceção, sem abrir mão dela, logo depois da regra explicada. Tente 80 mensagens comuns de cotação, de lead e de dúvida, em português e em inglês, que NÃO deveriam passar para humano: com telefone, com valores da cotação, com porcentagem ("100% certo", "10% de chance de chuva"), "desconto" em contexto neutro ("não quero desconto", "já tem desconto incluso?", "cupom fiscal", "descontar do cartão"), "exceção" em contexto neutro, "mesmo assim", "por favor", "insisto que é para 2 pessoas". Qualquer `handoff: true` indevido ou texto fixo de recusa fora de lugar é achado.
2. **Falso negativo.** 40 pedidos reais de desconto, de negociação e de exceção a regra, diretos e disfarçados, nos dois idiomas. Para cada um: o que sai (handoff por código, handoff pela ferramenta do modelo falso, alerta e correção, nada). Não é defeito o modelo tratar; é defeito a resposta final CONCEDER, prometer ou acenar com desconto ou exceção, ou trazer preço que não saiu do código.
3. **Conferência da resposta (achados 3 a 7 e 11).** Registro afirmado sem `201` ("registrado", "confirmada", "enviei", "booked", "sent") é cortado? A frente diz que isso vale "enquanto nenhum envio da conversa foi registrado": depois de UM lead registrado, o modelo pode afirmar que um SEGUNDO pedido, ainda não enviado, foi registrado? Concessão afirmada sem valor; regra afirmada contra o campo de regras das fichas lidas; outras moedas, "2,3 mil", "2.300", valor por extenso (limite declarado pela frente: diga o tamanho do buraco); corte que preserva o aviso de regra; valor chamado de total que não é o total do turno; total com datas novas sem cotação; disponibilidade só com data ou período; vazamento de 12 palavras seguidas das instruções (e com 11? e parafraseado?). Procure também o excesso: pergunta do hóspede recapitulada, negação ("não aceita pet"), frase correta cortada por engano, resposta que fica vazia ou sem sentido depois do corte.
4. **Hóspedes por categoria (mudança nova).** `cotar` agora recebe adultos, crianças e bebês separados e o código soma. Confira: bebê conta (L13); zero, negativo e fracionário são recusados sem cotar; `hospedes` antigo continua aceito; os dois formatos juntos e divergentes; soma acima da capacidade recusa sem total. **Costura com o lead:** o número que vai para o resumo e para o corpo do POST é a mesma soma? Existe caminho em que a cotação é para 4 (2 adultos + 2 bebês) e o resumo ou o lead saem com 2? Escreva o teste de ponta a ponta com modelo falso.
5. **Trava de imóvel ambíguo (mudança nova).** Se a busca DESTE turno trouxe mais de um imóvel e a mensagem do hóspede não cita o id nem o nome do escolhido, `cotar` não roda. Procure bloqueio indevido: nome com acento ou caixa diferente, nome parcial ("o chalé"), "o primeiro", "o de Gramado mais barato", "cote os dois", id citado numa mensagem anterior da mesma conversa, busca que trouxe um só. E procure furo: a mensagem cita um nome que aparece em dois imóveis; o modelo busca e cota em chamadas separadas no mesmo turno.
6. **Idioma.** Para hóspede em inglês, as datas do resultado de `cotar` e os textos de código saem em inglês (`Friday, January 15, 2027`), e o total sempre `R$ 2.156,00`. Para hóspede em português, o resultado é idêntico ao de antes (os testes da frente E não mudaram?). Mensagem mista, hóspede que troca de idioma no meio, idioma que não é nenhum dos dois.
7. **L18 e bloco de lead.** Continua valendo: `porLimite === true` → uma chamada, contingência com `handoff: true`; erro comum → uma nova tentativa. O bloco de resumo e o pedido de confirmação gerados por código ficam intactos, no fim da resposta, fora da conferência e do corte, mesmo quando o corte esvazia o texto do modelo.
8. **Ajuste ao gabarito.** O código reconhece frases dos casos de `evals/casos/dev/`? Para cada rede e cada regra de conferência, três variações que os casos não usam. Existe um conjunto reservado que você NÃO pode abrir (`~/.config/agente-concierge/` inteiro é proibido).
9. **Custo de CPU.** Saneamento e conferência com 8.000 e 32.000 caracteres; a frente diz que o saneamento agora corta antes de processar. Meça.
10. **Defeitos plantados.** Pelo menos 15, um por vez, nos arquivos da G (soltar a recusa de zero hóspedes, somar sem os bebês, deixar `cotar` rodar com imóvel ambíguo, aceitar "registrado" sem `201`, tirar a bateria negativa de uma rede, devolver data em português para hóspede em inglês etc.). Liste os que escaparam.

## Regras da máquina e de sigilo (obrigatórias)
- Testes só pela trava da máquina (duas vagas): `~/.cache/agente-concierge/com-trava.sh npx vitest run <arquivo> --maxWorkers=3` (ou `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`). **Nunca `--root`**, nunca vitest fora da trava, nunca em modo watch.
- **Não suba servidor local** e não chame modelo de verdade. Nenhuma chamada de rede; nenhum POST para fora. Tudo com dublês, como a suíte já faz.
- Não abra nem liste `~/.config/agente-concierge/` nem `~/.cf-token`. Não imprima variável de ambiente.
- Não use subagentes. Não mexa em outras worktrees nem em branches. Não faça commit, push, stash nem altere configuração do git.

## Entrega
1. Relatório em `$SP/ver-g2-relatorio.md`: veredito (APROVADO ou REPROVADO), achados em ordem de gravidade com `arquivo:linha`, cenário (mensagens → o que acontece de errado), como reproduzir (teste-sonda colado) e correção sugerida em uma frase; o que foi conferido e passou; as tabelas das baterias (item 1: quantas das 80 passaram indevidamente para humano; item 2: o destino de cada um dos 40); os defeitos plantados; e, separado, o que é decisão de produto e o que é limite conhecido.
2. Sondas em `$SP/ver-g2-sondas/`, incluindo um arquivo `reproduz.test.ts` que FALHA hoje para cada achado que bloqueia (para a coordenação rodar de novo depois da correção).
3. Mensagem final para mim: veredito, uma linha por achado com gravidade e `arquivo:linha`, os números das duas baterias, quantos defeitos plantados foram pegos, e a confirmação de que a cópia descartável foi removida. Critério do veredito: REPROVADO se existir mensagem comum que passa para humano ou recebe recusa fixa indevida; resposta final que concede ou inventa valor, regra, disponibilidade ou registro; número de hóspedes que diverge entre cotação e lead; ou regressão de L18 ou do bloco de lead. O resto entra como ressalva. Só afirme o que você rodou; o que foi leitura, diga que foi leitura.
````

## 7. Verificar frente I — rodada 2 (adaptador do modelo)

13/11 21h47 · claude-opus-5-5 · esforço xhigh

````text
Você é o VERIFICADOR INDEPENDENTE (rodada 2) da frente I do projeto agente-concierge: o adaptador do modelo de linguagem (`src/modelo.ts`). Responda em português do Brasil. Você não corrige nada: procura defeito e prova com teste. Não crie subagentes.

## Contexto
- Repositório: `<worktree da coordenação>` (não edite nada nele, não faça commit, não troque de branch). Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo: as regras de sigilo valem para você (nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`, nenhuma chamada de rede a serviço externo, nenhum servidor local).
- O agente é um Worker da Cloudflare. O modelo principal é o Claude Haiku 5.5 chamado pela binding `env.AI.run("anthropic/claude-haiku-5.5", <corpo no formato Messages>, { gateway: { id } })`; o reserva é um modelo `@cf/…` no formato de chat. O adaptador converte os dois formatos, decide quando o principal falhou e chama o reserva. Regra do produto: nada cortado, vazio ou de erro vindo do principal pode chegar ao hóspede nem ser executado como ferramenta; nesses casos o reserva responde; se os dois falham, o hóspede recebe um aviso honesto fixo com `handoff: true`.
- A rodada 1 reprovou a branch. Relatório da rodada 1 (leia inteiro): `<rascunho>/ver-i-relatorio.md`. Sondas da rodada 1 (escritas CONTRA o comportamento defeituoso; servem de ponto de partida, não de critério): pasta `…/scratchpad/ver-i-sondas/` (`sonda-i.test.ts`, `sonda-i2.test.ts`, `mutantes.py`).
- O que a frente diz ter corrigido, um commit por item, na branch `origin/t3/modelo-evals-fallback`:
  - `3735f4b` tira `blocos` (código morto).
  - `e865904` só `end_turn`, `tool_use` e `stop_sequence` com texto ou ferramenta valem; `max_tokens`, `refusal`, `pause_turn`, fim desconhecido ou ausente, erro como valor e texto fora de JSON vão ao reserva.
  - `651956e` id de chamada de ferramenta único na conversa inteira; no pedido ao Haiku todo id passa para o padrão `[a-zA-Z0-9_-]` e sai único, com o resultado da ferramenta casando com a chamada.
  - `e051a5e` o log de falha mascara endereço e hexadecimal de 16 caracteres ou mais.
  - `b14b9b4` `uso.chamadas` traz as chamadas reais (1 com o principal, 2 quando o reserva assume).
  - `42d1b5f` testes para os mutantes M2, M8, M17 e M18.
- Pode aparecer mais UM commit pequeno depois de `42d1b5f` (modelo `anthropic/…` sem `AI_GATEWAY` → vai direto ao reserva, sem chamar o principal). Antes de fechar o relatório, rode `git fetch origin` e, se a cabeça de `origin/t3/modelo-evals-fallback` tiver passado de `42d1b5f`, revise também o que entrou. Diga no relatório o hash exato que você revisou.

## Como trabalhar
1. Crie uma worktree descartável SUA: `git -C <repositório> worktree add --detach <pasta-no-seu-scratchpad> main`, depois dentro dela `git merge --no-ff --no-commit origin/t3/modelo-evals-fallback` (ensaio do merge sobre a `main`; não faça commit) e `ln -s <repositório>/node_modules node_modules`. Ao terminar: `git merge --abort` e `git worktree remove --force`.
2. Leia o diff `a071311..origin/t3/modelo-evals-fallback` de `src/modelo.ts` e `test/modelo.test.ts` linha a linha, e os pontos de `src/agente/loop.ts` que consomem o adaptador.
3. Escreva sondas em vitest numa pasta sua (`…/scratchpad/ver-i2-sondas/`), copie para `test/` da worktree descartável só para rodar, e apague de lá depois. Suíte e tipos SEMPRE pela trava da máquina: `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3` e `~/.cache/agente-concierge/com-trava.sh npm run tipos`. Para rodar só as suas sondas: `~/.cache/agente-concierge/com-trava.sh npx vitest run test/<arquivo> --maxWorkers=3`. Nunca `--root`.

## O que atacar (no mínimo)
1. **Resposta inútil do principal** (o defeito ALTO da rodada 1): para cada forma, prove que o reserva responde e que nada do principal chega ao hóspede nem é executado: `200` vazio; `content` vazio; só bloco de raciocínio; `max_tokens` com texto cortado; `max_tokens` no meio de `tool_use` (entrada parcial); `stop_reason` ausente, nulo, desconhecido; `refusal`; `pause_turn`; objeto `{type:"error"}`; texto que não é JSON; `tool_use` com `input` que não é objeto; `tool_use` com nome de ferramenta que não existe; `end_turn` com texto só de espaços; `tool_use` declarado no `stop_reason` mas sem bloco de ferramenta; bloco de ferramenta com `stop_reason: end_turn`.
2. **Ids de chamada**: dois ids distintos que viram o mesmo depois de trocar caracteres fora do padrão (ex.: `a.b` e `a_b`, `functions.cotar:0` e `functions_cotar_0`); id vazio; id muito longo; mesmo id repetido em turnos diferentes do histórico; histórico misto (turnos do reserva com `call_<hex>` seguidos de turno do Haiku com `toolu_…` e vice-versa). Em todos: cada `tool_result` do pedido aponta para exatamente um `tool_use` anterior, na ordem que a API exige, e nenhuma chamada fica sem resultado nem resultado sem chamada.
3. **Contagem `uso.chamadas`** por caminho: principal responde; principal lança e reserva responde; principal devolve resposta inútil e reserva responde; os dois falham; erro de limite (`porLimite`) nos dois. A contagem tem de ser o número real de chamadas feitas.
4. **Log de falha**: o que `registrarFalha` escreve nunca contém endereço, token, hexadecimal longo, nem o corpo do pedido (mensagem do hóspede, nome, telefone). Ataque com mensagens de erro que carregam esses dados.
5. **Regressões**: o que funcionava em `a071311` continua (conversão de `system`, de ferramentas, de histórico com ferramenta, erro de limite reconhecido só quando é limite, prazo do principal). Rode os mutantes do `mutantes.py` da rodada 1 que você julgar relevantes (aplique à mão na worktree descartável, rode `test/modelo.test.ts`, desfaça) e diga quais a suíte da frente mata e quais sobrevivem.
6. **Se o commit extra existir**: sem `AI_GATEWAY` o principal é chamado zero vezes; com `AI_GATEWAY` vazio idem; com gateway o principal é chamado; modelo principal que não é `anthropic/` não é afetado; reserva falhando nesse caminho cai no aviso honesto.

## Entrega
Escreva o relatório em `<rascunho>/ver-i2-relatorio.md` e as sondas em `…/scratchpad/ver-i2-sondas/`. O relatório abre com `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, o hash revisado, e os achados por gravidade (ALTO, MÉDIO, BAIXO), cada um com `arquivo:linha`, a entrada que reproduz, o que saiu, o que deveria sair e o nome do teste da sonda que prova. Achado sem sonda que falha é só hipótese: marque como tal. Reprovado = pelo menos um ALTO ou MÉDIO comprovado. Diga também o que você NÃO conseguiu verificar. Sua última mensagem é um resumo de até 25 linhas com o veredito, o hash, os achados e a saída da suíte e dos tipos no ensaio de merge. Confirme no fim que removeu a worktree descartável e que não deixou processo rodando.
````

## 8. Verificar frente B2 — juiz de preço e expressões (Haiku)

13/11 22h06 · claude-opus-5-5 · esforço xhigh

````text
Você é o VERIFICADOR INDEPENDENTE da frente B2 do projeto agente-concierge: o harness de evals (o juiz de preço) e as expressões de alguns casos de desenvolvimento. Responda em português do Brasil. Você não corrige nada: procura defeito e prova com teste. Não crie subagentes.

## Contexto
- Repositório: `<worktree da coordenação>` (não edite nada nele, não faça commit, não troque de branch). Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo: as regras de sigilo valem para você (nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`). Nenhuma chamada de rede, nenhum servidor local, nenhuma rodada de eval contra agente nenhum.
- O produto é um agente de chat para hóspedes de imóveis de temporada. Os evals medem o agente só pelo contrato HTTP. O juiz de preço (`evals/lib/juiz-preco.mjs`) lê a resposta do agente e reprova, entre outras coisas, valor em reais que não é o total esperado e que aparece sem identificação de componente (diária, noite, taxa): a regra existe para o hóspede nunca confundir um componente com o total, e para um total errado nunca passar. Requisitos: `docs/CONTRATO.md` (regra de preço na seção 3; lacunas decididas na seção 10: L5 = o agente não inventa o que o catálogo não diz; L13a = bebê e criança contam na capacidade) e `docs/EVALS.md`. Formato dos casos: `evals/README.md`.
- O modelo principal do agente mudou para o Claude Haiku 5.5, que redige diferente do modelo anterior. A frente ampliou o juiz e quatro expressões para aceitar a redação nova SEM afrouxar a regra. Seu trabalho é achar onde afrouxou (resposta errada que agora passa) e onde ainda reprova resposta certa.
- O que revisar: `main..origin/frente-b2` (cabeça `15cbb00`). Commits: `a980826` (caso `lead-12`, em `evals/simulador/para-dev/`, turno 4 virou `Sim, confirmo.`), `fc67de6` (`rec-05` aceita "mesma data"), `4ad79fe` (juiz: "cada", "each", "nightly", "per night"; rótulo depois do valor ou antes da vírgula; "sai por" depois de "cada"), `fe79573` (expressões de `hand-09-insistente`, `inv-07-cancelamento`, `man-07-capacidade`, `inv-01-ausente`), `15cbb00` (veto de total e de oferta também antes da vírgula).
- Respostas reais do Haiku em casos que reprovaram com o juiz antigo (dados sintéticos; leia, não copie para o repositório): `<rascunho>/haiku-main-i-respostas.txt` e `…/scratchpad/haiku-g-respostas.txt` (com as listas `haiku-main-i-falhas.txt` e `haiku-g-falhas.txt`).
- Limites que a própria frente declarou (confirme ou derrube): não testou se resposta que passava no juiz antigo passou a reprovar; em `inv-01` só o parêntese entre a negação e "tem berço" foi liberado; em `hand-09`, "A ficha do GRM-301 não tem ferro de passar roupa." reprova; "Cada noite de sexta e sábado sai por R$ 708,00" ainda cai no veto de oferta; em `inv-07` a janela do "não" na expressão proibida já era frouxa ("Não consigo dizer agora, mas a multa de 20%…" escapa).

## Como trabalhar
1. Worktree descartável SUA: `git -C <repositório> worktree add --detach <pasta-no-seu-scratchpad> origin/frente-b2` e `ln -s <repositório>/node_modules node_modules` dentro dela. Ao terminar: `git worktree remove --force`.
2. Leia o diff inteiro de `evals/lib/juiz-preco.mjs`, `evals/teste-do-runner.mjs` e dos casos, linha a linha, e o juiz antigo (`git show main:evals/lib/juiz-preco.mjs`) para comparar.
3. Escreva sondas em Node puro (o harness não tem dependências) numa pasta sua, `…/scratchpad/ver-b2c-sondas/`, que importam o juiz da worktree descartável. Rode também `node evals/teste-do-runner.mjs`, `node evals/teste-do-runner.mjs --trava`, `node evals/rodar.mjs --listar` e `node --test evals/simulador/teste.mjs`. Se rodar a suíte do produto: só por `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`, nunca `--root`.

## O que atacar (no mínimo)
1. **Aprovação indevida no juiz (o mais grave).** Para um caso com total esperado conhecido (use os de `evals/casos/dev/funciona-cotacoes/`), monte respostas ERRADAS e veja se alguma passa no juiz novo e reprovava no antigo: total errado apresentado como total; total errado escondido atrás de um rótulo de componente ("2 noites, R$ 1.180,00 cada" quando a diária é 590); valor inventado com "cada"/"each" colado; desconto ou oferta ("cada uma sai por R$ 500,00 com desconto", "fica por R$ X cada"); dois valores na mesma frase em que só um tem rótulo; rótulo de uma frase valendo para valor de outra; valor depois de vírgula herdando rótulo indevido; inglês ("each", "per night", "nightly") nas mesmas armadilhas; valores em linhas de lista. Compare juiz antigo × novo numa tabela.
2. **Reprovação indevida.** Passe pelo juiz novo TODAS as respostas reais dos dois arquivos de respostas e variações plausíveis da redação do Haiku (listas com hífen, "Valor de cada noite: R$ X", "1 noite comum: R$ X", "2 noites a R$ X cada", "cada noite de sexta e sábado sai por R$ X", "R$ X por noite", "diária de R$ X", "R$ X/noite", inglês). Liste cada resposta correta que ainda reprova, com o motivo que o juiz dá.
3. **Regressão do juiz.** Rode juiz antigo e novo sobre um conjunto de respostas certas e erradas seu (pelo menos 60) e liste toda divergência: o que passou a aprovar e o que passou a reprovar. Cada divergência é intencional (cite o teste da frente que a cobre) ou é achado.
4. **Defeitos plantados.** Plante pelo menos 10 defeitos pequenos no juiz novo (um por vez, à mão, desfazendo depois): tirar o veto de total antes da vírgula, deixar o "cada" rotular o valor seguinte, aceitar "sai por" sempre, etc. Diga quais o `evals/teste-do-runner.mjs` pega e quais sobrevivem.
5. **As quatro expressões.** Para `hand-09`, `inv-07`, `man-07` e `inv-01` (e `rec-05`): respostas que INVENTAM ou afirmam o errado e passam (ex.: "não tem ferro de passar" como afirmação com um qualificador solto em outra oração; política de cancelamento inventada com um "não tenho informação" por perto; "bebês não contam" com redação diferente; "tem berço" afirmado com parêntese, travessão ou vírgula no meio); e respostas corretas, na redação real dos arquivos e em variações, que reprovam. Confira também que as expressões compilam no motor do Node com as flags que o runner usa e que não há retrocesso catastrófico (meça o tempo com entrada longa e repetitiva de 10.000 caracteres).
6. **`lead-12`.** O caso em `para-dev/` continua coerente com as regras de confirmação do `DECISOES.md` (P11 a P15): o turno 4 é um sim limpo e o esperado é 1 lead com 8 hóspedes só depois do resumo atualizado. O gerador `evals/simulador/gerar-casos-ataque.mjs --verificar` passa.

## Entrega
Relatório em `<rascunho>/ver-b2c-relatorio.md`; sondas em `…/scratchpad/ver-b2c-sondas/`. O relatório abre com `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO` e o hash revisado. Achados por gravidade: ALTO (resposta errada sobre preço ou invenção que passa a ser aprovada), MÉDIO (resposta certa e plausível do Haiku que reprova, ou brecha que exige redação improvável), BAIXO. Cada achado com `arquivo:linha`, a entrada exata, o que o juiz ou a expressão devolveu, o que deveria devolver e a sonda que prova. Reprovado = pelo menos um ALTO comprovado; MÉDIOs entram como lista de correção. Diga o que NÃO conseguiu verificar. Sua última mensagem: resumo de até 25 linhas com veredito, hash, achados e a saída dos gates. Confirme que removeu a worktree descartável e não deixou processo rodando.
````

## 9. Verificar frente F — rodada 4

13/11 22h11 · claude-opus-5-5 · esforço xhigh

````text
Você é o VERIFICADOR INDEPENDENTE (rodada 4) da frente F do projeto agente-concierge: o fluxo de lead (resumo do pedido, confirmação do hóspede, envio ao webhook e tratamento de falha). Responda em português do Brasil. Você não corrige nada: procura defeito e prova com teste. Não crie subagentes.

## Contexto
- Repositório: `<worktree da coordenação>` (não edite nada nele, não faça commit, não troque de branch). Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo: as regras de sigilo valem para você (nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`). Nenhuma chamada de rede a serviço externo, nenhum servidor local, nenhum POST a webhook nenhum: tudo por vitest com os dublês de `test/apoio`.
- Requisitos: `docs/CONTRATO.md` (seção 10, lacunas L9, L10, L11) e `DECISOES.md`, regras provisórias P11 a P15 (leia a P13, a P14 e a P15 inteiras; a P14 foi completada hoje: o teto de envios conta por ESTADIA, isto é, imóvel + entrada + saída, soma qualquer combinação de falhas, no máximo 2 POSTs sem `201`, a segunda falha de qualquer tipo passa para humano e bloqueia, e estadia bloqueada não gera novo POST mesmo que o hóspede troque nome, telefone ou número de hóspedes).
- Regra central do produto: o lead só é enviado depois de o hóspede ver o resumo completo e confirmar de forma inequívoca em outro turno; qualquer mudança de dado derruba o resumo (novo resumo, nova confirmação); o agente só diz "registrado" depois de `201`.
- A rodada 3 reprovou a branch em `5adf022`. Relatório (leia inteiro): `<rascunho>/ver-f3-relatorio.md`. Sondas e saídas da rodada 3: pasta `…/scratchpad/ver-f3-sondas/` (`reproduz.test.ts`, `mutantes-que-escaparam.test.ts`, `sonda-ver-f3.test.ts` com `sonda-saida.txt`, `sonda-ver-f3-p14.test.ts` com `sonda-p14-saida.txt`, `naturais-extra.txt`, pasta `mut`).
- Leituras fechadas pela coordenação depois da rodada 3: (1) afirmação junto com pergunta é tratada pela afirmação ("vou levar minha sogra, tem estacionamento?" e "levo o João, ok?" são mudança, o resumo cai); cancelamento junto com pergunta também derruba; só a mensagem que é TODA pergunta mantém o resumo (inclusive "posso levar minha sogra?"). (2) P14 pela letra, por estadia, como descrito acima.
- O que a frente diz ter feito, em `origin/frente-f`, cabeça `7a3f50d`: `8167f09` (C1: o que sobra fora dos trechos que terminam em "?" passa pela regra da afirmação, no rearme e na leitura do sim), `196df07` (teto por estadia, C3 e C4), `e0c1211` (testes do C2), `7a3f50d` (merge da `main`). Suíte: 851 testes.
- Dúvidas que a frente resolveu sozinha (ataque cada uma):
  (a) abertura neutra antes de uma pergunta ("ah", "oi", "antes de confirmar", "uma dúvida", "e", "mas") conta como pergunta pura e mantém o resumo; a lista é curta e fechada;
  (b) resultado incerto (tempo esgotado, conexão cortada, `200`, `204`) também bloqueia a estadia;
  (c) na leitura do sim, afirmação + pergunta vira "outra" e derruba; sim + pergunta ("Sim, confirmo! Tem wifi?") continua "pergunta" e mantém o resumo, sem enviar;
  (d) o texto de bloqueio é "não consegui registrar…" quando veio de recusa e "não consegui confirmar o registro…" quando veio de resultado incerto.
- Dois testes antigos mudaram de esperado para mais rígido ("segundo 422 na sessão…" e "estadia bloqueada por duas recusas…"): confira no diff que só ficaram mais rígidos.

## Como trabalhar
1. Worktree descartável SUA: `git -C <repositório> worktree add --detach <pasta-no-seu-scratchpad> main`, dentro dela `git merge --no-ff --no-commit origin/frente-f` (ensaio do merge; não faça commit) e `ln -s <repositório>/node_modules node_modules`. Ao terminar: `git merge --abort` (se falhar, siga) e `git worktree remove --force`.
2. Leia o diff `5adf022..origin/frente-f` de `src/` e `test/` linha a linha.
3. Sondas em vitest numa pasta sua, `…/scratchpad/ver-f4-sondas/`; copie para `test/` da worktree descartável só para rodar. Suíte e tipos SEMPRE pela trava: `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`, `~/.cache/agente-concierge/com-trava.sh npm run tipos`; um arquivo só: `~/.cache/agente-concierge/com-trava.sh npx vitest run test/<arquivo> --maxWorkers=3`. Nunca `--root`.

## O que atacar (no mínimo)
1. **C1 de novo, por fora da correção.** Mensagens com mudança de dado e pergunta em que a separação não é vírgula, ponto ou quebra de linha: sem pontuação nenhuma ("vou levar minha sogra tem estacionamento?"), com "e"/"mas"/"aí"/"então" ("vou levar minha sogra e queria saber se tem estacionamento?"), ponto e vírgula, travessão, reticências, dois-pontos, emoji no meio, parênteses, aspas, "??", "?!", "¿…?", pergunta primeiro e afirmação depois, afirmação em inglês e pergunta em português, mudança escrita como pergunta retórica ("somos 3 agora, pode ser?", "na verdade é pro dia 20, tá?"), mudança de data, de imóvel, de nome, de telefone e de número de hóspedes. Para cada uma: o rearme derruba o resumo? o "sim" do turno seguinte envia lead com dado antigo? Monte uma tabela com pelo menos 60 mensagens e diga quantas vazam. Julgue cada vazamento pela leitura fechada: só mensagem que é TODA pergunta pode manter o resumo.
2. **A lista de aberturas neutras (dúvida (a)) como atalho.** Abertura neutra seguida de mudança: "mas vou levar minha sogra, pode?", "e somos 3, ok?", "antes de confirmar, troca pro dia 20, pode ser?", "uma dúvida: levo o João, tem problema?", "ah, o telefone certo é outro, pode?". Nenhuma pode manter o resumo.
3. **Sim + pergunta (dúvida (c)).** "Sim, confirmo! Tem wifi?" não envia e mantém; confira que "sim, mas somos 3, pode?" e "sim, e levo o João, ok?" derrubam, e que o "sim" seguinte a um resumo mantido envia exatamente os dados mostrados.
4. **Teto por estadia (P14).** Para a mesma estadia, tente passar de 2 POSTs sem `201` por qualquer caminho: trocar telefone, nome, e-mail, número de hóspedes, idioma; voltar a um dado já recusado; escrever o imóvel de outro jeito (caixa, espaços, nome em vez de código) e as datas em outro formato; alternar com outra estadia e voltar; combinar `5xx`, `422` com campo, `422` sem campo, `2xx` diferente de `201`, tempo esgotado e conexão cortada em todas as ordens de 2 e 3 passos. Em cada sequência: quantos POSTs, o texto que o hóspede vê, `handoff`, e se a estadia ficou bloqueada. Confira também o lado oposto: outra estadia (mesmo imóvel com outras datas, ou outro imóvel) segue normal; `5xx` seguido de `201` na nova tentativa registra e diz "registrado"; `422` com campo, correção e `201` registra; depois de `201`, um segundo "sim" não envia de novo.
5. **Estado.** O contador e o bloqueio por estadia sobrevivem à gravação e leitura do estado da sessão (o estado é serializado em JSON): monte o estado, serialize, leia e repita os ataques do item 4. Estado antigo, sem os campos novos, não quebra nem zera bloqueio.
6. **Não regressão.** Rode `sonda-ver-f3.test.ts` e `sonda-ver-f3-p14.test.ts` da rodada 3 sobre a cabeça nova e compare linha a linha com `sonda-saida.txt` e `sonda-p14-saida.txt`: a frente diz que mudaram só as 15 linhas do grupo AFP (de "rearma e envia" para "derruba, 0 POST") e que a P14 dá no máximo 2 POSTs por estadia. Liste toda outra diferença. Rode `reproduz.test.ts` (tem de dar 18 de 18) e `mutantes-que-escaparam.test.ts`. Dos 125 ataques da lista da P15, nenhum pode enviar no próprio turno; das 50 confirmações naturais, as 49 que enviavam continuam enviando.
7. **Defeitos plantados.** Pelo menos 12 defeitos pequenos nas linhas novas (separação dos trechos com "?", lista de aberturas neutras, contador por estadia, chave da estadia, bloqueio por resultado incerto), um por vez, à mão, desfazendo depois; diga quais a suíte da frente pega e quais sobrevivem.
8. **Entrada hostil.** Tempo da leitura da confirmação e do rearme com mensagens de 300 e de 8.000 caracteres cheias de "?", vírgulas e aberturas neutras repetidas; nada pode passar de dezenas de milissegundos.

## Entrega
Relatório em `<rascunho>/ver-f4-relatorio.md`; sondas em `…/scratchpad/ver-f4-sondas/`, com um `reproduz.test.ts` só com os achados comprovados (cada teste afirma o comportamento CERTO e falha hoje). O relatório abre com `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO` e o hash revisado. Achados por gravidade: ALTO (lead enviado sem confirmação ou com dado diferente do resumo mostrado, ou "registrado" sem `201`), MÉDIO (lead com dado antigo depois de mudança dita pelo hóspede; teto de envios furado; confirmação clara que não envia e prende o hóspede em laço), BAIXO. Cada achado com `arquivo:linha`, a sequência exata de mensagens e respostas do webhook, o que saiu, o que deveria sair e o nome do teste que prova. Reprovado = pelo menos um ALTO ou MÉDIO comprovado. Separe o que é decisão de produto (não conta no veredito) do que é defeito. Diga o que NÃO conseguiu verificar. Sua última mensagem: resumo de até 25 linhas com veredito, hash, achados e a saída da suíte e dos tipos no ensaio de merge. Só mande a mensagem final quando todo trabalho em segundo plano tiver terminado. Confirme que removeu a worktree descartável e não deixou processo rodando.
````

## 10. Verificar frente I — rodada 3 (delta do adaptador)

13/11 22h34 · claude-opus-5-5 · esforço xhigh

````text
Você é o VERIFICADOR INDEPENDENTE (rodada 3, só o delta) da frente I do projeto agente-concierge: o adaptador do modelo de linguagem (`src/modelo.ts`). Responda em português do Brasil. Você não corrige nada: procura defeito e prova com teste. Não crie subagentes.

## Contexto
- Repositório: `<worktree da coordenação>` (não edite nada nele, não faça commit, não troque de branch). Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo: as regras de sigilo valem para você (nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`, nenhuma chamada de rede a serviço externo, nenhum servidor local).
- O agente é um Worker da Cloudflare. O modelo principal é o Claude Haiku 5.5, chamado pela binding `env.AI.run("anthropic/claude-haiku-5.5", <corpo no formato Messages>, { gateway: { id } })`; o reserva é um modelo `@cf/…` no formato de chat. O adaptador converte os formatos, decide quando o principal falhou e chama o reserva. Regra do produto: nada cortado, vazio, incoerente ou de erro vindo do principal chega ao hóspede nem é executado como ferramenta; nesses casos o reserva responde; se os dois falham, o hóspede recebe um aviso honesto fixo com `handoff: true`. Sem a variável `AI_GATEWAY`, um modelo `anthropic/…` não é chamado: o reserva responde direto.
- A rodada 2 reprovou a branch em `0b39d9f` por dois achados MÉDIOS. Relatório (leia inteiro): `<rascunho>/ver-i2-relatorio.md`. Sondas da rodada 2 (afirmam o comportamento CERTO): `…/scratchpad/ver-i2-sondas/sonda-i2-a.test.ts` e `sonda-i2-b.test.ts`, com os scripts de defeitos plantados `mutantes2.py`, `mutantes2-sonda.py` e `mutantes3.py`.
- O que revisar: `0b39d9f..origin/t3/modelo-evals-fallback` (cabeça `64f0526`). Commits de código, na ordem: `ce3ee56` (fim que não bate com o conteúdo vai ao reserva), `1b2f837` (o mesmo id duas vezes na mesma resposta vira dois ids), `13e01d7` (o erro do adaptador informa as chamadas reais em `erro.chamadas`), `77fc438` (log de falha sem texto livre: só nome do erro e código numérico), `5c0df15` (mensagem de conferência do loop no meio da conversa vai ao Haiku como texto do usuário), `ad2fc72` (tira IP e e-mail fictícios de um teste), `400c35d` (`principal_pulado` uma vez por turno), `7f11dee` (sem gateway, a recusa por limite do reserva sai com `porLimite: true` e não é repetida), `18976f5` (adota sondas da rodada 2), `967ff96` (níveis de raciocínio `low`, `high`, `xhigh`, `max` aceitos). `a7ae9b8` e `64f0526` só mexem em documentação.
- Fato medido que motivou o `5c0df15`: no código integrado com a frente G, a API recusava com "This model does not support assistant message prefill. The conversation must end with a user message." Forma do pedido que falhava: `tool_use` → `tool_result` → texto do assistente (o rascunho), com a mensagem de conferência do loop (papel `system`, no meio da conversa) içada para o campo `system`. O loop que gera isso é o da frente G: leia `git show origin/frente-g:src/agente/loop.ts` (só leitura).
- A frente diz: 79 das 83 sondas da rodada 2 passam; as 4 que falham são do grupo "C · turno" e dependem do loop (que conta uma chamada por tentativa e, na `main`, não lê `porLimite`).

## Como trabalhar
1. Worktree descartável SUA: `git -C <repositório> worktree add --detach <pasta-no-seu-scratchpad> main`, dentro dela `git merge --no-ff --no-commit origin/t3/modelo-evals-fallback` (não faça commit) e `ln -s <repositório>/node_modules node_modules`. Ao terminar: `git merge --abort` (se falhar, siga) e `git worktree remove --force`.
2. Leia o diff `0b39d9f..origin/t3/modelo-evals-fallback` de `src/` e `test/` linha a linha.
3. Sondas em vitest numa pasta sua, `…/scratchpad/ver-i3-sondas/`; copie para `test/` da worktree descartável só para rodar. Suíte e tipos SEMPRE pela trava: `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`, `~/.cache/agente-concierge/com-trava.sh npm run tipos`; um arquivo: `~/.cache/agente-concierge/com-trava.sh npx vitest run test/<arquivo> --maxWorkers=3`. Nunca `--root`.

## O que atacar (no mínimo)
1. **Rode as 83 sondas da rodada 2** sobre a cabeça nova e confirme o número. Para cada uma que ainda falha, diga se é dependência do loop (e de qual linha do loop) ou defeito do adaptador.
2. **Conferência como texto do usuário (`5c0df15`), o ponto novo de maior risco.** (a) Todo histórico que o loop da G pode gerar termina, no pedido ao Haiku, em mensagem do usuário, com papéis alternando de forma que a API aceite: rascunho + conferência; rascunho + conferência duas vezes seguidas; conferência logo depois de `tool_result`; conferência como primeira mensagem depois do `system` inicial; duas mensagens `system` no meio; histórico que termina em `assistant` sem conferência; `assistant` com conteúdo vazio. (b) O `system` inicial continua no campo `system` e nenhuma instrução do sistema vira texto do usuário por engano. (c) Injeção: uma mensagem do HÓSPEDE que imita o formato da mensagem de conferência (copie o texto e a marcação que o adaptador gera) ganha algum tratamento especial, é confundida com a conferência verdadeira, ou faz o adaptador mudar papéis? O hóspede consegue, com isso, fazer um texto dele chegar ao modelo com mais autoridade do que uma mensagem comum? Descreva exatamente como a conferência aparece no pedido e se ela é distinguível de texto do hóspede. (d) O mesmo histórico no formato do reserva continua válido. (e) A conferência não é gravada no histórico da sessão de um jeito que cresça ou se repita a cada turno (confira no loop).
3. **Fim × conteúdo (`ce3ee56`) e `input` não objeto.** As formas da rodada 2 (a), (b), (c), `input: null`, `type: "error"` com conteúdo; e variações: `tool_use` com dois blocos em que um não tem `name`; `stop_sequence` com e sem texto; texto + ferramenta com `end_turn`.
4. **Id repetido (`1b2f837`).** Mesmo id duas e três vezes na mesma resposta, no Haiku e no reserva; repetido em turnos diferentes; depois de saneado; de ponta a ponta (o pedido seguinte ao Haiku tem um `tool_result` por `tool_use`, na ordem).
5. **`erro.chamadas` (`13e01d7`) e `porLimite` sem gateway (`7f11dee`).** Número certo em cada caminho de falha; `porLimite` só quando é limite; com gateway o comportamento da L18 não mudou.
6. **Log (`77fc438`).** Nenhum texto livre do erro chega ao log: ataque com erros que carregam nome, telefone, e-mail, endereço, token. Confira que o que sobrou no log ainda permite distinguir os erros reais (`AiGatewayError 7003`, `2021`, `AiError 3021`).
7. **Defeitos plantados** nas linhas novas (pelo menos 12, um por vez, à mão, desfazendo depois) e os scripts da rodada 2 adaptados: diga quais a suíte da frente pega e quais sobrevivem.
8. **Sigilo no estado atual da árvore:** `scripts/verificar-sigilo.sh` na worktree descartável termina com `SIGILO OK`; liste qualquer cadeia nos testes que pareça credencial, endereço ou dado pessoal real (fictícia e claramente de exemplo não é achado, mas liste).

## Entrega
Relatório em `<rascunho>/ver-i3-relatorio.md`; sondas em `…/scratchpad/ver-i3-sondas/`. O relatório abre com `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO` e o hash revisado. Achados por gravidade (ALTO, MÉDIO, BAIXO), cada um com `arquivo:linha`, a entrada que reproduz, o que saiu, o que deveria sair, a chance real de acontecer e a sonda que prova. Reprovado = pelo menos um ALTO ou MÉDIO comprovado e alcançável pelo loop real ou por uma resposta que a API pode mandar; forma que só existe em teste entra como BAIXO. Separe o que é decisão de produto. Diga o que NÃO conseguiu verificar. Sua última mensagem: resumo de até 25 linhas com veredito, hash, achados e a saída da suíte e dos tipos no ensaio de merge. Só mande a mensagem final quando todo trabalho em segundo plano tiver terminado. Confirme que removeu a worktree descartável e não deixou processo rodando.
````

## 11. Verificar frente F — rodada 5 (delta)

13/11 22h58 · claude-opus-5-5 · esforço high

````text
Você é o VERIFICADOR INDEPENDENTE (rodada 5, só o delta) da frente F do projeto agente-concierge: o fluxo de lead (resumo do pedido, confirmação do hóspede, envio ao webhook e tratamento de falha). Responda em português do Brasil. Você não corrige nada: procura defeito e prova com teste. Não crie subagentes.

## Contexto
- Repositório: `<worktree da coordenação>` (não edite nada nele, não faça commit, não troque de branch). Leia `CLAUDE.md` e `AGENTS.md` da raiz antes de tudo: as regras de sigilo valem para você (nunca imprima valor de variável de ambiente, nunca abra `~/.config/agente-concierge/`). Nenhuma chamada de rede a serviço externo, nenhum servidor local, nenhum POST a webhook: tudo por vitest com os dublês de `test/apoio`.
- Requisitos: `docs/CONTRATO.md` (seção 10: L9, L10, L11) e `DECISOES.md`, regras provisórias P11 a P18. Leia a P14 e a P18 inteiras. P14: teto de envios por ESTADIA (imóvel + entrada + saída) na sessão, no máximo 2 POSTs sem `201` somando qualquer combinação de falhas; a segunda falha passa para humano e bloqueia; estadia bloqueada não gera novo POST mesmo com outro nome, telefone ou número de hóspedes; resultado incerto (tempo esgotado, conexão cortada, `2xx` diferente de `201`) também bloqueia a estadia; outra estadia segue normal. P18: a rede de texto que separa afirmação de pergunta fica como está (vírgula, ponto, ponto e vírgula, exclamação, quebra de linha); mudança misturada com pergunta de outras formas é LIMITE CONHECIDO, não achado.
- A rodada 4 reprovou em `7a3f50d`. Relatório (leia inteiro): `<rascunho>/ver-f4-relatorio.md`. Sondas e saídas da rodada 4: `…/scratchpad/ver-f4-sondas/` (inclui a sonda da P14 que rodou 3.768 sequências, o `reproduz.test.ts` e o `mutantes-que-escaparam.test.ts`).
- O que revisar: SÓ `7a3f50d..origin/frente-f` (cabeça `0e6a29c`). Commits: `c87d3a9` (C7: `estadiaBloqueada` lê também os marcadores da estadia; reserva da mesma estadia em "enviando" sem resultado, ou em "incerto", bloqueia como incerto, com "Não consegui confirmar o registro…" e `handoff`; cobre estado gravado antes do teto por estadia), `a9c8a8f` (C9: "uma dúvida", "uma pergunta" e "só uma pergunta" saem do texto antes da busca de sinais, no rearme e na leitura do sim), `9ceeeb1` (C8: 7 testes da rodada 4 e um caso de resultado incerto seguido de troca de dado), `0e6a29c` (merge da `main`, só documentação).
- Dúvida que a frente resolveu sozinha: uma reserva em "enviando" bloqueia as OUTRAS reservas da mesma estadia já na sessão em que o POST está no ar; ela diz que não há efeito prático porque a fila da sessão serializa as mensagens. Ataque isso.

## Como trabalhar
1. Worktree descartável SUA: `git -C <repositório> worktree add --detach <pasta-no-seu-scratchpad> main`, dentro dela `git merge --no-ff --no-commit origin/frente-f` (não faça commit) e `ln -s <repositório>/node_modules node_modules`. Ao terminar: `git merge --abort` (se falhar, siga) e `git worktree remove --force`.
2. Leia o diff `7a3f50d..origin/frente-f` de `src/` e `test/` linha a linha.
3. Sondas em vitest numa pasta sua, `…/scratchpad/ver-f5-sondas/`; copie para `test/` da worktree descartável só para rodar. Suíte e tipos SEMPRE pela trava: `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`, `~/.cache/agente-concierge/com-trava.sh npm run tipos`; um arquivo: `~/.cache/agente-concierge/com-trava.sh npx vitest run test/<arquivo> --maxWorkers=3`. Nunca `--root`.

## O que atacar
1. **C7, bloqueio a mais (o risco novo).** O marcador "enviando" existe por um instante em todo envio normal. Prove que o fluxo feliz não mudou: resumo, "sim", `201`, "registrado", e depois o segundo "sim" sem novo POST; `5xx` seguido de `201` na nova tentativa registra; `422` com campo, correção e `201` registra; outra estadia (outras datas ou outro imóvel) segue normal antes, durante e depois de um bloqueio; uma estadia registrada com `201` não fica bloqueada para sempre por um marcador antigo. Procure qualquer sequência em que uma estadia legítima fique bloqueada sem ter havido falha.
2. **C7, bloqueio a menos.** Reinício simulado (requisição abandonada) no 1º POST, na nova tentativa do `5xx`, no envio corrigido depois do `422`; depois troque telefone, nome, número de hóspedes, e volte ao dado original: 0 POST novo, texto de resultado incerto, `handoff: true`. Estado serializado em JSON e lido de volta; estado antigo sem os campos novos.
3. **P14 inteira de novo.** Rode a sonda da P14 da rodada 4 (as 3.768 sequências) sobre a cabeça nova e compare com a saída guardada: liste toda diferença.
4. **C9.** As aberturas retiradas do texto não podem virar atalho dentro da regra em vigor: "uma dúvida, somos 3, tem wifi?" e "só uma pergunta. troca pro dia 20, pode?" derrubam; "uma dúvida, tem wifi?" mantém e repete o resumo inteiro; confira que retirar "uma pergunta" não muda o resultado de frases em que "uma" é dado ("uma pessoa a mais", "uma criança", "mais uma noite"). Mistura sem os separadores da P18 é limite conhecido: não conte.
5. **Não regressão.** `reproduz.test.ts` da rodada 3 (18 de 18) e os dois testes de C7 do `reproduz.test.ts` da rodada 4; a sonda geral da rodada 4 comparada com a saída guardada (125 ataques da P15 sem envio no turno; 49 de 50 confirmações naturais enviando).
6. **Defeitos plantados** nas linhas novas (pelo menos 8, um por vez, à mão, desfazendo depois): quais a suíte pega e quais sobrevivem.

## Entrega
Relatório em `<rascunho>/ver-f5-relatorio.md`; sondas em `…/scratchpad/ver-f5-sondas/`. O relatório abre com `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO` e o hash revisado. Achados por gravidade: ALTO (lead sem confirmação ou com dado diferente do resumo mostrado; "registrado" sem `201`), MÉDIO (teto de envios furado; estadia legítima bloqueada sem falha; confirmação clara que não envia e prende o hóspede em laço), BAIXO. Cada achado com `arquivo:linha`, a sequência exata, o que saiu, o que deveria sair e o teste que prova. Reprovado = pelo menos um ALTO ou MÉDIO comprovado NO DELTA ou regressão em relação à rodada 4. Formas de C5 e C6 já conhecidas não contam. Diga o que NÃO conseguiu verificar. Sua última mensagem: resumo de até 20 linhas com veredito, hash, achados e a saída da suíte e dos tipos no ensaio de merge. Só mande a mensagem final quando todo trabalho em segundo plano tiver terminado. Confirme que removeu a worktree descartável e não deixou processo rodando.
````

## 12. Verificar frente L — script de custo

13/11 23h36 · claude-opus-5-5 · esforço medium

````text
Você é um verificador independente. Não confie no relatório da frente; prove ou refute com execução e leitura. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch a verificar: `origin/frente-l` (cabeça 22eda87), dois commits sobre a main: `scripts/custo.mjs` (300 linhas) e `scripts/custo.test.mjs` (99 linhas). O script lê relatórios de eval em JSON (pasta `evals/relatorios/`) e calcula o custo por conversa a partir dos tokens de entrada e de saída.

## Como trabalhar
1. Crie uma cópia descartável: `git worktree add --detach <pasta> origin/main` numa pasta dentro de <rascunho>/ver-l, depois `git merge --no-ff --no-commit origin/frente-l` dentro dela. `node_modules` por link simbólico para o do checkout da coordenação, se precisar.
2. Leia antes o `CLAUDE.md` do repositório (regras de sigilo) e a seção de preços de `docs/revisoes/modelos.md`.

## O que provar ou refutar
1. CHECK de aceite: `node scripts/custo.mjs evals/relatorios` termina com uma linha `CUSTO OK ...` e saída 0. `node --test scripts/custo.test.mjs` passa.
2. A conta está certa: escolha um relatório, pegue pelo menos 5 conversas, some os tokens à mão (ou com um programa seu, independente do script) e compare média, p50, p95, máximo e total com a saída do script. Confira a definição de percentil usada e se ela está dita na saída ou no código.
3. Os preços do modelo principal e do reserva batem com `docs/revisoes/modelos.md`. Diga de onde o script tira o preço e o que acontece se o modelo do `wrangler.jsonc` não estiver na tabela.
4. Entradas ruins: relatório sem dados de uso, relatório só agregado, JSON inválido, pasta vazia, conversa com pedido que falhou (zero tokens), números negativos ou texto no lugar de número. O script nunca pode imprimir `CUSTO OK` com número errado ou sem dados; deve sair com código diferente de 0.
5. Sigilo e efeitos: o script não usa rede, não escreve arquivo, não imprime endereço nem valor de variável de ambiente, não lê nada fora dos caminhos passados.
6. Afirmações do relatório da frente a conferir: (a) os relatórios não registram qual modelo respondeu cada chamada; (b) tokens de cache entram somados à entrada (`src/modelo.ts`); (c) o runner zera o uso dos pedidos que falham (`evals/rodar.mjs`, perto da linha 699); (d) o teste fica fora da suíte do vitest.
7. Defeitos plantados: plante de 6 a 10 defeitos, um por vez, nas contas e nas saídas do script (troca de entrada por saída, divisor errado, percentil deslocado, arredondamento, ignorar aviso, sair 0 sem dados) e diga quais o `custo.test.mjs` pega. Restaure o arquivo depois de cada um e confira com `git diff --quiet`.

## Critério do veredito
Reprova só: número errado de forma determinística, `CUSTO OK` falso, vazamento de sigilo, ou efeito fora do que foi descrito. O resto é achado BAIXO ou limite a documentar.

## Proibições
- Nenhum subagente. Nenhuma chamada de rede. Nenhum servidor.
- Não abra `~/.config/agente-concierge/` (arquivo de ambiente e conjunto reservado).
- Não rode a suíte inteira do produto (`npm test`); este script não entra nela.
- Não faça commit, push, nem troque branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-l-relatorio.md, com a primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, o hash revisado, uma tabela de achados (gravidade, onde, resumo), a prova de cada item acima com a saída real dos comandos, o que não foi verificado e a limpeza (worktree removida com `git worktree remove --force`, `git status --short` do checkout da coordenação vazio). Sondas e saídas na pasta ver-l-sondas ao lado do relatório. A sua mensagem final repete o veredito e os achados em poucas linhas.
````

## 13. Verificar frente K — script de validação de producao

13/11 23h36 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente. Não confie no relatório da frente; prove ou refute com leitura e execução controlada. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch a verificar: `origin/frente-k` (cabeça 33c8316), um commit sobre a main: `scripts/validar-producao.sh` (366 linhas). O script valida o ambiente de produção do agente de chat SEM enviar lead ao webhook real. Modos declarados pela frente: `--so-leitura` (só GET no webhook real), sem modo (`/saude`, contagem de leads antes e depois, e o conjunto de evals de desenvolvimento com a trava do runner), `--clientes` (curl, requests, urllib e fetch do Node), `--entrega` (não manda conversa; reprova com o envio desligado) e `--autoteste` (sem rede).

Leia antes: `CLAUDE.md` do repositório (sigilo e a regra do webhook real), `docs/CONTRATO.md` (procure L22, L23 e o que fala de producao e do webhook) e, em `evals/rodar.mjs`, a trava que impede casos com confirmação contra producao.

## REGRAS DURAS (valem mais que qualquer item abaixo)
1. NENHUMA requisição ao webhook real, ao ambiente de producao nem ao ambiente de dev publicado. Nem GET. A sua prova é por leitura e por execução contra servidores locais seus.
2. Antes de executar qualquer modo do script além de `--autoteste`, leia como ele carrega endereços (arquivo de ambiente, variáveis, pasta de configuração). Só execute se você conseguir GARANTIR que todo endereço usado aponta para um servidor local seu (por exemplo, com uma pasta de configuração temporária e um arquivo de ambiente falso, sem editar o arquivo real). Se não conseguir garantir, não execute: fique na leitura e diga isso no relatório.
3. Nunca imprima, copie para arquivo nem cite o valor de variável do arquivo de ambiente real. Não abra `~/.config/agente-concierge/` (ambiente e conjunto reservado). Sem `set -x`, sem modo verboso.
4. Servidores locais seus: só nas portas 8788 a 8792, um por vez por porta, conferindo antes que a porta está livre e derrubando no fim (confira com `ss -ltn` que saiu). Nunca inicie o ambiente `producao` do Worker localmente.
5. Nenhum subagente. Nenhum commit, push ou troca de branch no checkout da coordenação.
6. Suíte e tipos do produto não são necessários aqui. Se rodar algo pesado, use `~/.cache/agente-concierge/com-trava.sh <comando>` com `--maxWorkers=3`.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em <rascunho>/ver-k, depois `git merge --no-ff --no-commit origin/frente-k`. `node_modules` por link simbólico para o do checkout da coordenação.

## O que provar ou refutar
1. **Só GET no webhook real, por construção.** Liste toda chamada de rede do script (curl, node, python, runner) com método, destino e dados. Existe algum caminho, incluindo erro, variável vazia ou trocada, argumento inesperado, redirecionamento seguido ou reuso de função, em que sai POST, PUT, PATCH ou DELETE para o endereço de leads real? O script depende só de `ENVIO_LEADS=desligado` no Worker para isso, ou tem proteção própria?
2. **Conversas com confirmação nunca vão para producao.** Como o script chama o runner? A trava do runner pode ser desligada por variável, argumento ou alvo escrito de outro jeito (barra no fim, maiúsculas, porta, outro hostname)? O que acontece se o alvo for o de dev por engano, e o contrário?
3. **Nenhum endereço na saída nem em argumento de processo filho.** Confira toda mensagem de erro e de sucesso, a saída do curl em falha, a saída do runner repassada, e a lista de processos (`ps`) durante a execução contra os seus servidores locais. A frente afirma que o `--alvo` do runner entra pelo ambiente.
4. **Sem falso verde.** `PRODUCAO OK` (ou equivalente) nunca sai quando: `/saude` falha ou devolve campo errado; o GET de leads falha (tem que reprovar, não tratar como zero); a contagem de leads cresceu; o runner deu REPROVADO, deu erro ou não rodou; um dos clientes de `--clientes` levou 403. Confira os códigos de saída de cada modo.
5. **Execução controlada, se a regra dura 2 permitir:** suba um servidor local que finge o agente (`/saude` e `/chat`) e outro que finge o webhook de leads, grave método e caminho de TODA requisição que chegar a cada um, e rode todos os modos, com respostas boas e com falhas (500, 403, tempo esgotado, corpo inválido, leads crescendo entre o antes e o depois). Resultado esperado: zero requisição diferente de GET no servidor que finge o webhook, em todos os modos e em todas as falhas.
6. **`--autoteste`:** passa? O que ele cobre de verdade? Plante de 6 a 10 defeitos no script, um por vez (trocar um GET por POST, tirar a conferência do depois, aceitar `/saude` com envio ligado, ignorar o código de saída do runner, imprimir o alvo) e diga quais o autoteste pega. Restaure o arquivo depois de cada um e confira com `git diff --quiet`.
7. **Qualidade de shell:** `set -u`/`pipefail`, aspas, arquivos temporários e limpeza, dependências (python com requests instalado?), o que acontece quando falta uma ferramenta.
8. `scripts/verificar-sigilo.sh` não precisa ser rodado por você (usa o arquivo de ambiente). Faça uma leitura do script procurando endereço, domínio, IP, e-mail ou nome de máquina escritos nele.

## Critério do veredito
Reprova: qualquer caminho que possa mandar requisição que não seja GET ao webhook real; conversa com confirmação podendo ir para producao; endereço vazando em saída ou em argumento de processo; falso verde determinístico. O resto é BAIXO ou limite a documentar.

## Entrega
Relatório em <rascunho>/ver-k-relatorio.md, com a primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, o hash revisado, tabela de achados (gravidade, onde, resumo), a prova de cada item com a saída real, o que NÃO foi verificado, e a limpeza (servidores derrubados, portas livres, worktree removida, `git status --short` do checkout da coordenação vazio). Sondas e saídas na pasta ver-k-sondas ao lado do relatório. A sua mensagem final repete o veredito e os achados em poucas linhas.
````

## 14. Verificar frente I — rodada 4 (delta do log e gateway de producao)

13/11 23h37 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente, quarta rodada da frente I (adaptador do modelo). Só o delta. Não confie no relatório da frente; prove ou refute. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/t3/modelo-evals-fallback`, cabeça b34ab95. A rodada 3 aprovou 64f0526 e a branch já entrou na main. O delta são os commits que estão em `origin/main..origin/t3/modelo-evals-fallback`:
- 33e67f1 fix(modelo): código do log só da posição de código e nome de lista fechada
- ede844c fix(modelo): log diz o motivo da resposta inútil numa palavra
- 53681a5 test(modelo): cobre ferramenta com input em lista e bloco sem name (K10, K11)
- 6e5d5dc fix(modelo): log mantém o código de erro de classe da plataforma
- d561a05 feat(modelo): producao usa o gateway concierge-producao
- b34ab95 docs(modelo): completa o passo da chave do gateway de producao
Arquivos: `src/modelo.ts`, `wrangler.jsonc`, `docs/revisoes/modelos.md`, `test/configuracao-i.test.ts`, `test/modelo-log-i.test.ts`, `test/modelo-producao-i.test.ts`, `test/texto-cru.d.ts`.

Leia antes: `CLAUDE.md` (sigilo), em `docs/CONTRATO.md` a linha L22 (nome e telefone mascarados em logs), em `DECISOES.md` a P16 (sem gateway, o principal é pulado e o reserva responde) e a X24.
Material das rodadas anteriores, para reaproveitar: em <rascunho>/ estão `ver-i3-relatorio.md` (ou nome parecido, procure `ver-i3-*`), as sondas `ver-i2-sondas/` e `ver-i3-sondas/`. A frente diz que a sonda `sonda-i3-a` dá 97 de 99 no código novo e que as 2 falhas são esperadas: (a) "número antes do código" (mensagem do tipo "[data] upstream :443 AiGatewayError 7003"), porque a regra da coordenação é nunca tirar dígito solto da mensagem; (b) "erro congelado", que não foi pedido.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em .../scratchpad/ver-i4, depois `git merge --no-ff --no-commit origin/t3/modelo-evals-fallback`. `node_modules` por link simbólico para o do checkout da coordenação. Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest, nunca `--root`.

## O que provar ou refutar
1. **Log de falha não vaza dado do hóspede (L22).** Com o código novo, monte erros cuja mensagem ecoa telefone (vários formatos), CEP, data, endereço com número, nome com dígito, número de cartão, e combine com e sem um código de erro de verdade. Nenhum dígito de dado ecoado pode sair no log. Diga exatamente o que sai. Teste também classe de erro fora da lista fechada, erro sem mensagem, erro que não é `Error`, mensagem multilinha e mensagem muito longa.
2. **O código de erro da plataforma continua saindo** quando vem na posição de código: depois de `XxxError:` e, para as classes da plataforma, no começo da mensagem ("7003: ..."). Procure caso em que um dado do hóspede cai na "posição de código" (por exemplo, mensagem de classe da plataforma que começa com um telefone ou com quatro dígitos de uma data) e vira código no log.
3. **Motivo da resposta inútil:** palavra de lista fechada (`corte`, `recusa`, `fim_desconhecido`, `fim_nao_bate`, `vazia`, `erro_como_valor`, `ferramenta_invalida`). Cada motivo tem um caso que o produz? Há caminho em que o texto da resposta do modelo ou do hóspede entra no log?
4. **Comportamento do adaptador não mudou fora do log.** Leia o diff de `src/modelo.ts` linha a linha. Rode as sondas das rodadas 2 e 3 contra a árvore nova e compare com o resultado esperado. Confirme ou refute a explicação das 2 falhas da `sonda-i3-a`.
5. **Configuração:** em `wrangler.jsonc`, `producao` tem `AI_GATEWAY` igual a `concierge-producao`, `MODELO` Haiku 5.5, `MODELO_ESFORCO` high, reserva GLM-5.3 Flash e `ENVIO_LEADS` desligado; `dev` não mudou. O teste de configuração prende isso? `test/texto-cru.d.ts`: o que é, e interfere nos tipos do produto?
6. **Documento:** `docs/revisoes/modelos.md` não traz chave, identificador de conta, identificador de store, endereço, IP nem e-mail; a ordem dos passos do gateway está coerente (secret no Secrets Store antes de ligar o provedor ao gateway).
7. **Defeitos plantados:** de 8 a 12, um por vez, nas linhas novas de `src/modelo.ts` e na configuração. Diga quais a suíte pega. Restaure depois de cada um e confira com `git diff --quiet`.
8. **Linha de base:** `npm test -- --maxWorkers=3` e `npm run tipos` na cópia mesclada, com as contagens.

## Critério do veredito
Reprova só: defeito determinístico (dado do hóspede no log, código de erro perdido de forma determinística, comportamento do adaptador alterado, configuração de producao errada) ou sigilo. O resto é BAIXO ou limite a documentar.

## Proibições
- Nenhum subagente. Nenhuma chamada de rede, ao modelo, ao gateway ou à API da plataforma. Nenhum servidor.
- Não abra `~/.config/agente-concierge/`. Não imprima valor de variável de ambiente.
- Nenhum commit, push ou troca de branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-i4-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, onde, resumo), prova de cada item com a saída real, o que NÃO foi verificado e a limpeza (worktree removida, `git status --short` do checkout da coordenação vazio). Sondas em `ver-i4-sondas/` ao lado do relatório. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 15. Verificar frente N — sigilo e fatos dos rascunhos

13/11 23h38 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente dos documentos de entrega (frente N). O repositório vai ficar PÚBLICO. O seu trabalho principal é achar qualquer coisa que não pode ser publicada; o secundário é achar afirmação errada. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada, não faça commit nem push).
Branch: `origin/frente-n` (cabeça ede0c12). Só documentos: `README.md`, `docs/COMO-FOI-FEITO.md`, `docs/desenhos/agente.md`, `docs/desenhos/fabrica.md` e `docs/setup/**` (README, `CLAUDE-global.md`, regras, skills, subagentes, `hooks/git-sync.sh`, `skills/orquestrar-entrega/SKILL.md`). Veja a lista exata com `git diff --stat origin/main...origin/frente-n`.

Leia os arquivos direto da branch (`git show origin/frente-n:<caminho>`) ou numa cópia descartável em <rascunho>/ver-n (`git worktree add --detach <pasta> origin/frente-n`).

Leia antes o `CLAUDE.md` do repositório, seção "Sigilo". As regras: nunca em arquivo versionado o nome da empresa do desafio, trecho copiado do enunciado, domínio da API, domínio do agente ou do webhook, token, IP, nome de máquina, nem e-mail que não seja contato@evertonresende.com.

## Parte 1 · O que não pode ser publicado (leia TODOS os arquivos inteiros, linha a linha)
`docs/setup/**` são cópias da configuração pessoal do autor, limpas pela frente. Procure o que sobrou:
1. Endereço IP (v4, v6, faixas), nome de máquina, apelido de servidor, nome de rede privada, porta ligada a serviço pessoal.
2. E-mail (qualquer um além do permitido), usuário de serviço, nome de conta, identificador de conta, de zona, de store, de projeto.
3. Caminho com pasta pessoal (`/home/<usuário>`, `/Users/<usuário>`, `~/.algo` que revele ferramenta ou arquivo de credencial), nome de arquivo de credencial.
4. Nome de outros projetos, clientes, empresas, produtos internos, repositórios, Workers, domínios e ferramentas internas que não sejam necessários para entender esta entrega.
5. Chave, token, começo de chave, segredo de exemplo com cara de verdadeiro, URL com segmento secreto.
6. Dado pessoal de terceiros (nome completo, telefone), dado de saúde ou preferência pessoal do autor que não tenha relação com a entrega.
7. Trecho que pareça copiado de um enunciado de desafio, e qualquer nome de empresa.
8. Em `README.md`, `docs/COMO-FOI-FEITO.md` e nos desenhos: endereço público, domínio, nome de Worker, identificador de gateway com conta, e detalhe de ataque que ensine a explorar um limite conhecido (a ordem foi listar o limite sem o cenário).
Para cada achado: arquivo, linha, categoria e o trecho com o dado sensível trocado por `[…]` (não reproduza o dado inteiro no relatório).
Use também buscas automáticas (expressões regulares para IP, e-mail, caminho pessoal, hexadecimal longo, `sk-`, domínio com TLD), mas a leitura humana linha a linha é obrigatória: a frente já rodou grep.

## Parte 2 · Afirmações
Compare com `DECISOES.md`, `docs/CONTRATO.md`, `docs/EVALS.md`, `docs/revisoes/modelos.md` e o log do backlog (`docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, seção de log, procure por "13/11"):
1. Todo número (percentual, latência, tokens, custo, contagem de testes, quantidade de casos) tem fonte nesses documentos e bate? Liste os que não batem ou não têm fonte.
2. Afirmações de que algo "funciona", "está garantido" ou "foi verificado" correspondem ao que já está na main? O que ainda está em branch ou em correção está dito como tal ou marcado para preencher?
3. As decisões provisórias (P11 a P19) e as do dono (X24 e anteriores) estão descritas sem distorção?
4. Os comandos citados existem (`package.json`, `scripts/`, `evals/`)? Os que só existem em branch estão marcados?
5. Os 5 blocos Mermaid: sintaxe plausível e conteúdo coerente com o código da main (leia `src/` por alto: entrada, sessão, laço, ferramentas, lead).
6. Marcadores `<!-- PREENCHER -->`: liste todos, com arquivo e linha, para a coordenação usar como lista de fechamento.

## Critério do veredito
Reprova: qualquer achado da Parte 1 (item publicável indevido) ou afirmação falsa sobre garantia do produto. O resto é BAIXO.

## Proibições
Nenhum subagente. Nenhuma chamada de rede. Não abra `~/.config/agente-concierge/` nem `~/.claude/` (você não precisa da fonte original das cópias). Nenhum commit, push ou troca de branch no checkout da coordenação. Não rode suíte.

## Entrega
Relatório em <rascunho>/ver-n-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, arquivo:linha, categoria, resumo), a lista de marcadores, o que NÃO foi verificado e a limpeza (worktree removida, `git status --short` do checkout da coordenação vazio). A mensagem final repete o veredito e os achados em poucas linhas.
````

## 16. Verificar frente F — rodada 6 (delta do C10 e C11)

13/11 23h43 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente, sexta rodada da frente F (lead: resumo, confirmação e envio). Só o delta. Não confie no relatório da frente; prove ou refute. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/frente-f`, cabeça 28109d8. A rodada 5 reprovou a cabeça 0e6a29c por um achado (C10). O delta é `0e6a29c..28109d8`, três commits; em `src/` só mudou `src/lead.ts` (11 linhas):
- 54a5d0a (C10): a retirada das aberturas "uma dúvida", "uma pergunta" e "só uma pergunta" saiu da leitura do sim e ficou só no rearme (pergunta pura que mantém o resumo pendente).
- e357311 (C12): testes dos marcadores de estadia.
- 28109d8 (C11): "uma pergunta" entrou na lista de aberturas neutras, só no rearme.

Leia antes: `CLAUDE.md` (sigilo), em `docs/CONTRATO.md` as linhas L9 e L10, em `DECISOES.md` as decisões P11, P13, P14, P15, P18 e P19. Sobre a P19: a regra é que sim acompanhado de anúncio de dúvida ou pergunta ("sim, uma dúvida", "confirmo, só uma pergunta", "uma dúvida: sim") NÃO envia o lead no turno. A frente informa que nesse caso a mensagem é lida como "outra", o resumo pendente cai e o modelo refaz o resumo quando o hóspede quiser fechar, igual à rodada 4; isso é aceito pela coordenação.

Material da rodada 5 (seu ponto de partida; reaproveite as sondas): <rascunho>/ver-f5-relatorio.md e a pasta ver-f5-sondas/ ao lado (reproduz.test.ts, sonda-c10-dano.test.ts, sonda-c9.test.ts, sonda-c7.test.ts, regressao/, mut/, rodar.sh e as saídas das cabeças 0e6a29c e 7a3f50d). Há também ver-f4-* e ver-f3-* das rodadas anteriores.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em .../scratchpad/ver-f6, depois `git merge --no-ff --no-commit origin/frente-f`. `node_modules` por link simbólico para o do checkout da coordenação. Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest, nunca `--root`. Sondas copiadas para `test/` só para rodar e retiradas depois.

## O que provar ou refutar
1. **C10 corrigido.** As 32 mensagens de "sim com dúvida" da `sonda-c9`: nenhuma envia. A sequência do `sonda-c10-dano` termina com um lead só, com o dado novo. O bloco C10 do `reproduz.test.ts` passa.
2. **Nenhum envio novo.** Monte um conjunto NOVO, seu, de pelo menos 60 mensagens que misturam confirmação com anúncio de dúvida, pergunta, condição ou dado ("sim, mas antes uma pergunta", "sim?", "sim, uma coisa", "confirmo, só uma coisinha", "yes, one question", "yes but", com emoji, com quebra de linha, com pontuação variada, com a abertura no meio ou no fim, com "uma pergunta" repetido, maiúsculas, sem acento). Compare 28109d8 com 0e6a29c e com 7a3f50d (rodada 4): liste toda mensagem que envia em 28109d8. Nenhuma mensagem com anúncio de dúvida pode enviar.
3. **Confirmação legítima não regrediu.** As confirmações naturais que enviavam na rodada 4 (a sonda geral dava 49 de 50) continuam enviando, uma a uma. Liste qualquer uma que deixou de enviar.
4. **C11 só no rearme.** "uma pergunta, tem wifi?" mantém e repete o resumo; com mudança junto ("uma pergunta, somos 3, tem wifi?") derruba; nenhuma forma com "uma pergunta" envia lead. Procure caso em que "uma pergunta" é DADO ou esconde dado (por exemplo "uma pergunta: e se formos uma pessoa a mais?", "uma pergunta, pode ser dia 20?") e o resumo antigo fica de pé: depois um "sim" enviaria o dado velho. Rode a sequência inteira até o "sim" e diga o que sai.
5. **Resto igual.** A sonda geral, a P14 inteira (3.768 sequências) e a `sonda-c7` (19 de 19) dão saída idêntica à da rodada 5. Diga o que mudou, linha a linha, se mudou.
6. **Testes novos da frente:** `test/sim-com-duvida-f.test.ts`, `test/marcadores-estadia-f.test.ts` e o bloco C11 de `test/afirmacao-pergunta-f.test.ts` testam comportamento (não a implementação)? Plante de 8 a 12 defeitos nas 11 linhas mudadas e ao redor (inclusive os X01, X03 e X06 da rodada 5) e diga quais a suíte pega. Restaure depois de cada um e confira com `git diff --quiet`.
7. **Linha de base:** `npm test -- --maxWorkers=3` e `npm run tipos` na cópia mesclada, com as contagens (a frente relata 912 testes na branch dela; mesclado com a main o número é maior).

## Critério do veredito
Reprova só: defeito determinístico ou lead errado (lead enviado sem confirmação limpa, lead com dado velho, lead duplicado, confirmação legítima que deixou de funcionar). O resto é BAIXO ou limite a documentar.

## Proibições
Nenhum subagente. Nenhuma rede, nenhum servidor, nenhum modelo, nenhum POST. Não abra `~/.config/agente-concierge/`. Nenhum commit, push ou troca de branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-f6-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, onde, resumo), prova de cada item com a saída real, o que NÃO foi verificado e a limpeza (worktree removida, `git status --short` do checkout da coordenação vazio). Sondas em `ver-f6-sondas/` ao lado. Escreva o veredito no relatório ANTES de rodar os defeitos plantados e atualize depois, para a coordenação poder ler cedo. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 17. Verificar frente G — rodada 3

13/11 23h51 · claude-opus-5-5 · esforço xhigh

````text
Você é um verificador independente, terceira rodada da frente G (robustez do agente: laço de ferramentas, conferência do texto, handoff, trava de valores, resumo pendente). Não confie no relatório da frente; prove ou refute com execução. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/frente-g`, cabeça 29ae3aa. A rodada 2 reprovou a cabeça anterior com 5 achados ALTOS. Desde então a frente fez, nesta ordem (veja com `git log --first-parent --no-merges origin/main..origin/frente-g`):
- as correções da rodada 2 (811ff77, 0c62099, 2714e5d) e a P18 (5f18cd9), cabeça 3e10551;
- 2b16462: hesitação do hóspede mantém o resumo mesmo com pergunta do agente;
- 1e998dd: com a ferramenta de handoff já chamada, pedido de desconto define o motivo;
- e2be4dd: o rearme do resumo passa por uma pergunta fechada ao modelo;
- 805513c: o laço soma as chamadas reais ao modelo;
- 29ae3aa: valor permitido só sai de campo de dinheiro do código (achado M1 da revisão de segurança).

Leia antes, inteiros: `CLAUDE.md` (sigilo), `docs/CONTRATO.md` (em especial §2, §7 e as linhas L5a, L8, L9, L10, L12, L13, L13a, L15) e, em `DECISOES.md`, as decisões P11 a P19 e a X24. Decisões que mandam nesta rodada:
- **P17:** palavra na mensagem do hóspede nunca liga `handoff` nem troca a resposta por texto fixo. No máximo provoca UMA segunda chamada ao modelo, focada. O handoff vem da ferramenta chamada pelo modelo ou da conferência do texto do próprio agente. Com a ferramenta já chamada, a palavra de desconto pode definir o motivo.
- **P18:** com resumo pendente e sem confirmação, se o texto do agente faz qualquer pergunta, o resumo cai. Exceção: mensagem do hóspede lida como hesitação. Nos demais casos o resumo só é mantido e repetido se o modelo responder exatamente "não" a uma pergunta fechada feita pelo código (a mensagem indica mudança possível de dado, ou desistência?); qualquer outra resposta, erro ou silêncio derruba o resumo.
- **X24, item 3:** só bloqueia a entrada na main o que é determinístico ou gera lead errado. O resto é limite conhecido.

Material das rodadas anteriores (reaproveite): <rascunho>/ver-g2-relatorio.md e ver-g2-sondas/reproduz.test.ts (30 testes; a frente diz que 27 passam e 3 são controles que ficam vermelhos de propósito por causa da P17: confirme ou refute, um a um). Achado M1 da revisão de segurança: .../scratchpad/m2-seguranca-1.md, seção M1. Sonda das chamadas ao modelo: .../scratchpad/ver-i2-sondas/sonda-i2-a.test.ts, os 4 testes "C · turno". Corpus de respostas reais do agente, para não regressão: .../scratchpad/haiku-int3-registro.jsonl (169 respostas; campos `m` mensagem do hóspede, `r` resposta, `h` handoff).

## Como trabalhar
Duas cópias descartáveis em .../scratchpad/ (pastas ver-g3 e ver-g3-f), as duas a partir de `git worktree add --detach <pasta> origin/main`:
- **ver-g3:** `git merge --no-ff --no-commit origin/frente-g` (a G sozinha sobre a main);
- **ver-g3-f:** `git merge --no-ff --no-commit origin/frente-f origin/frente-g` (a ordem de entrada na main é F, depois G; a cabeça da F é 28109d8 e está em verificação à parte). Esta é a árvore principal das suas sondas. Se houver conflito, pare e relate.
`node_modules` por link simbólico para o do checkout da coordenação. Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest, nunca `--root`. Sondas copiadas para `test/` só para rodar e retiradas depois. O modelo é sempre simulado nos testes: nenhuma chamada real.

## O que provar ou refutar
1. **Os 5 achados ALTOS da rodada 2**, um a um, com as mesmas sondas: corrigidos? (rede de desconto e de exceção ligando handoff em mensagem inocente; conferência cortando a explicação da L5a; número de hóspedes da cotação diferente do do lead; formas diretas passando pela conferência; o quinto, conforme o seu relatório.) Rode de novo as 80 mensagens inocentes: quantas ligam handoff agora?
2. **P17 ao pé da letra.** Existe algum caminho em que a mensagem do hóspede, sozinha, liga `handoff` ou troca a resposta por texto fixo? Quantas chamadas ao modelo um turno pode fazer no pior caso (laço principal, chamada focada, pergunta fechada da P18, conferência)? Cabe no orçamento do turno? O que acontece quando a chamada focada falha ou demora?
3. **P18 ao pé da letra.** Monte sequências completas até o "sim" final e conte os POSTs e o conteúdo do lead:
   - pergunta do agente derruba o resumo; o "sim" seguinte não envia;
   - hesitação com pergunta do agente mantém; o sim limpo seguinte envia o dado certo;
   - pergunta fechada: só "não" exato mantém; "Não.", "nao", "NÃO", "não, mas", vazio, erro, tempo esgotado, resposta longa, chamada de ferramenta no lugar de texto: diga o que cada um faz e se algum mantém um resumo que deveria cair;
   - mudança de dado que o agente afirma sem perguntar ("Se quiser, atualizo para 3 hóspedes" seguido de "sim"): sai lead com dado velho? (Na sonda da coordenação com o modelo real, antes da pergunta fechada, saía.)
   - o hóspede pode usar a pergunta fechada para injetar instrução (a mensagem dele entra no texto da pergunta)? O que o código faz se o modelo responder outra coisa por causa disso?
4. **Trava de valores (29ae3aa, M1).** Os dois cenários do revisor de segurança estão fechados: valor em reais escrito pelo modelo junto com chamada de ferramenta, e valor em reais dentro do nome do hóspede. E a não regressão, que é o risco maior: um valor legítimo continua passando em TODOS estes casos? total da cotação; diária, diária com acréscimo e taxa de limpeza; valor repetido num turno POSTERIOR ao da cotação (o hóspede pergunta de novo "quanto ficou mesmo?" sem nova chamada de ferramenta); valor depois de reinício do objeto da sessão (estado relido do armazenamento); dois imóveis cotados na mesma conversa; total do resumo de confirmação; valor em inglês; valor escrito sem centavos ("R$ 2.156") e com espaço diferente. Liste qualquer resposta certa que a trava agora altera. Rode as 169 respostas reais do corpus pela conferência: quantas mudam?
5. **Contagem de chamadas (805513c).** Os 4 testes "C · turno" da sonda da frente I passam? O cabeçalho de chamadas bate com o número real em turno com falha do principal, com reserva, com chamada focada e com pergunta fechada?
6. **Desempate do motivo (1e998dd).** Palavra inteira, não radical; quem abre mão do desconto não pede. Procure falso positivo e falso negativo (plural, inglês "discount", "promo", "cupom" com acento ou erro de digitação, negação).
7. **Idioma e textos fixos (L15)** não regrediram: resposta em inglês para hóspede em inglês nos caminhos novos (pedido de confirmação repetido, handoff, recusa).
8. **Integração com a F (árvore ver-g3-f):** a suíte inteira passa? Algum teste da F ou da G depende de comportamento que a outra mudou? Com o laço da G chamando `pedidoDeConfirmacaoPendente` no fim do turno, a leitura "sim, uma dúvida" (P19: não envia; o resumo cai) continua valendo de ponta a ponta?
9. **Defeitos plantados:** de 12 a 16, um por vez, nas linhas novas de `src/agente/**` (trava de valores, pergunta fechada, exceção da hesitação, desempate, contagem). Diga quais a suíte pega. Restaure depois de cada um e confira com `git diff --quiet`.
10. **Linha de base:** `npm test -- --maxWorkers=3` e `npm run tipos` nas duas árvores, com as contagens.

## Critério do veredito
Reprova só: defeito determinístico ou lead errado. Exemplos que reprovam: handoff ligado só por palavra do hóspede; valor inventado passando pela trava; valor legítimo removido de forma determinística; lead com dado velho, duplicado ou sem confirmação; turno que estoura o orçamento por construção. Comportamento que depende de o modelo acertar é limite conhecido: liste, com a frequência que você conseguir estimar sem modelo, mas não reprove por ele.

## Proibições
Nenhum subagente. Nenhuma rede, nenhum servidor, nenhum modelo real, nenhum POST. Não abra `~/.config/agente-concierge/`. Nenhum commit, push ou troca de branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-g3-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, onde, resumo), prova de cada item com a saída real, lista de limites conhecidos, o que NÃO foi verificado e a limpeza (as duas worktrees removidas, `git status --short` do checkout da coordenação vazio). Sondas em `ver-g3-sondas/` ao lado. Escreva o veredito e os achados no relatório assim que os tiver, ANTES dos defeitos plantados, e atualize depois. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 18. Verificar frente H — rodada 3

13/11 23h57 · claude-opus-5-5 · esforço xhigh

````text
Você é um verificador independente, terceira rodada da frente H (sessão: um objeto durável por conversa, fila por sessão, persistência do estado, falha interna, teto do corpo do pedido). Não confie no relatório da frente; prove ou refute com execução. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/t3/durable-session-concurrency`, cabeça a58ff5e. Arquivos da frente: `src/sessao.ts`, `src/chat.ts`, `src/index.ts` e os testes `test/concorrencia-h.test.ts`, `test/estado-f-h.test.ts`, `test/reapresentacao-h.test.ts`, `test/fila-f-h.test.ts`. A branch carrega um merge da frente F (lead) na cabeça 0e6a29c; a F já andou para 28109d8 (11 linhas em `src/lead.ts`, só no leitor de confirmação) e está em verificação à parte. A ordem de entrada na main é F, depois H, depois G.

Commits desde a rodada 2 (`git log --first-parent origin/main..origin/t3/durable-session-concurrency`):
- c905a09: persiste o estado do lead por inteiro;
- efb67f7: merge da F (0e6a29c);
- 33a3d07: teste "item 1b" separado em dois subcasos (retentativa do "sim" em contingência e depois de pergunta);
- 0912578: **correção em `src/sessao.ts`**: a sessão gravava na hora só `envios`; `postsSemRegistro` e `estadiasBloqueadas` (o contador e o bloqueio por estadia da P14, que a F grava junto com o resultado do POST) só iam ao armazenamento no fim do turno. Num turno que o Worker abandona, o estado era refeito do inicial, a estadia perdia o bloqueio e saía um terceiro POST. Agora `fatosDoEnvio()` grava os três campos na hora;
- 3414b82, 3f35f80, a58ff5e: testes da reapresentação com as formas da P15 e da fila com a F nova.

Leia antes, inteiros: `CLAUDE.md` (sigilo), `docs/CONTRATO.md` (em especial §5, §7, as linhas L7, L9, L10, L11 e os critérios de aceite de concorrência e de falha interna) e, em `DECISOES.md`, P11 a P19 (a P14 é o teto de 2 POSTs sem `201` por estadia, com bloqueio e passagem para humano na segunda falha) e a X24. Material das suas rodadas anteriores (reaproveite as sondas e confira cada achado antigo): <rascunho>/ver-h-relatorio.md, ver-h2-relatorio.md e ver-h2-sondas/. Sondas da P14 da verificação da F (3.768 sequências): .../scratchpad/ver-f5-sondas/regressao/ e ver-f4-*.

## Como trabalhar
Duas cópias descartáveis em .../scratchpad/ (pastas ver-h3 e ver-h3-f), as duas a partir de `git worktree add --detach <pasta> origin/main`:
- **ver-h3:** `git merge --no-ff --no-commit origin/t3/durable-session-concurrency`;
- **ver-h3-f:** `git merge --no-ff --no-commit origin/frente-f origin/t3/durable-session-concurrency` (a árvore que vai existir na main depois da F e da H). Esta é a principal. Se houver conflito, pare e relate.
`node_modules` por link simbólico para o do checkout da coordenação. Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest, nunca `--root`. Sondas copiadas para `test/` só para rodar e retiradas depois. Webhook e modelo sempre simulados.

## O que provar ou refutar
1. **A correção 0912578.** Reproduza o defeito no commit pai (vermelho) e mostre verde na cabeça: (a) o Worker desiste do turno enquanto o webhook responde 500 duas vezes; depois, outro telefone, outro nome e outro número de hóspedes na mesma estadia: nenhum POST novo, texto de resultado incerto e `handoff: true`; (b) 422 seguido de 5xx: no máximo 2 POSTs; (c) as 3.768 sequências da P14 passando PELA SESSÃO (não só por `src/lead.ts`), com abandono do turno em cada ponto possível: nenhum terceiro POST sem `201`, nenhum POST depois do bloqueio.
2. **A lista de campos é completa?** Enumere TODO campo do estado do lead (e da sessão) que muda entre o começo do POST e o fim do turno. Cada um está no armazenamento antes de a resposta sair, ou antes de um ponto em que o turno pode ser abandonado? Procure um campo que ficou de fora de `fatosDoEnvio()` e monte a sequência que perde esse dado (lead duplicado, lead perdido, resumo confirmável sem ter sido visto, marcador `enviando` que some).
3. **Reinício do objeto** (estado relido do armazenamento, memória zerada) em cada ponto: antes do POST, com o POST no ar, depois do resultado e antes da resposta, depois da resposta. Em nenhum sai segundo lead da mesma reserva nem POST numa estadia bloqueada; o hóspede não recebe "registrado" sem `201`.
4. **Falha de gravação no armazenamento** (o `put` rejeita): o que acontece antes do POST e depois dele? Sai POST sem o marcador gravado? A resposta mente?
5. **Fila por sessão.** Duas, cinco e dez mensagens simultâneas na mesma sessão, misturando "sim", "confirmo", pergunta e troca de dado: no máximo 1 lead por reserva; a ordem de processamento é a de entrada; uma mensagem que estoura o prazo não trava as seguintes; sessões diferentes não se bloqueiam. Os dois testes de `fila-f-h` ficam mesmo vermelhos com a fila desligada?
6. **Reapresentação.** Resumo que o hóspede não viu (contingência, prazo, pedido repetido) nunca é confirmado por um "sim": o código reapresenta. Com as formas de confirmação da P15, o lead enviado é igual, campo a campo, ao resumo reapresentado. O subcaso novo do "item 1b" prova o que diz (a segunda passagem do mesmo pedido não acrescenta POST nem chamada ao modelo e devolve a resposta gravada)?
7. **Pedido repetido e idempotência** do `/chat`: o mesmo pedido reenviado pelo cliente depois de erro de rede; duas abas; o que identifica "o mesmo pedido".
8. **Corpo do pedido (`src/chat.ts`).** Corpo acima do teto (a decisão P12 fala em 64 KB), JSON inválido, campos faltando, `session_id` estranho, `message` vazia ou só espaços, método errado, tipo de conteúdo errado: status e corpo da resposta, sem ler o corpo inteiro para a memória quando ele é grande, e ZERO efeito (nenhuma sessão criada, nenhuma chamada ao modelo).
9. **Falha interna:** exceção em qualquer ponto do turno vira a resposta de contingência do contrato, sem detalhe interno, sem `handoff` indevido e sem perder o estado já gravado.
10. **Achados antigos (A0 a A6 das suas rodadas 1 e 2):** cada um continua corrigido, com o teste nomeado que o prova.
11. **Integração (árvore ver-h3-f):** suíte inteira e tipos. Algum teste da F quebra com a H, ou o contrário? Sabido e fora do seu escopo: junto com a frente G, 2 testes de `test/foco-g.test.ts` falham por interação entre a F e a G; a H não entra nisso.
12. **Defeitos plantados:** de 12 a 16, um por vez, em `src/sessao.ts` e `src/chat.ts` (gravação fora de hora, fila desligada num caminho, marca de resumo não visto ignorada, teto do corpo, tratamento do prazo). Diga quais a suíte pega. Restaure depois de cada um e confira com `git diff --quiet`.
13. **Linha de base:** `npm test -- --maxWorkers=3` e `npm run tipos` nas duas árvores, com as contagens.

## Critério do veredito
Reprova só: defeito determinístico ou lead errado (lead duplicado, lead sem confirmação vista, POST em estadia bloqueada, terceiro POST sem `201`, "registrado" sem `201`, mensagem perdida ou fora de ordem de forma determinística, corpo grande derrubando o Worker). O resto é BAIXO ou limite a documentar.

## Proibições
Nenhum subagente. Nenhuma rede, nenhum servidor, nenhum modelo real, nenhum POST real. Não abra `~/.config/agente-concierge/`. Nenhum commit, push ou troca de branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-h3-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, onde, resumo), prova de cada item com a saída real, limites conhecidos, o que NÃO foi verificado e a limpeza (as duas worktrees removidas, `git status --short` do checkout da coordenação vazio). Sondas em `ver-h3-sondas/` ao lado. Escreva o veredito e os achados no relatório assim que os tiver, ANTES dos defeitos plantados, e atualize depois. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 19. Verificar frente K — rodada 2 (delta do script de producao)

14/11 00h01 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente, segunda rodada do script de validação de producao (frente K). Só o delta. Não confie no relatório da frente; prove ou refute. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/frente-k`, cabeça f28ce3e. Um arquivo: `scripts/validar-producao.sh`. A rodada 1 reprovou a cabeça 33c8316. O delta é `33c8316..f28ce3e`, cinco commits:
- defdab8 (ALTO, falso verde): argumentos extras viram lista fechada (só `--paralelo`, `--pausa-ms` e `--timeout-ms`, com valor inteiro); `--alvo`, `-h`, `--listar`, `--bloco`, `--conjunto` e `--relatorio` reprovam. `PRODUCAO OK` só sai com saída 0 ou 2 do runner, a linha `EVAL OK` ou `EVAL PARCIAL` e pelo menos 60 casos executados, contados nas linhas `[PASSOU]` e `[FALHOU]`.
- 30e9fcf (MÉDIO, redirecionamento): nenhum cliente segue 3xx; qualquer 3xx no `/chat` reprova.
- 482ee2a (BAIXOS): limpador de saída insensível à caixa e cobrindo endereços IP resolvidos; ferramenta ausente nomeada; tempo limite; `curl -q`.
- b436ad6 (acréscimo): `--clientes` exige o cabeçalho `x-chamadas-modelo` maior que zero em cada resposta.
- f28ce3e (autoteste): sobe um agente e um webhook falsos em 127.0.0.1, grava cada pedido e roda o modo completo com um runner falso, o `--clientes` com os quatro clientes e o `--entrega`.

Material da rodada 1 (reaproveite as sondas e os servidores de mentira): <rascunho>/ver-k-relatorio.md e ver-k-sondas/. Leia antes o `CLAUDE.md` do repositório (sigilo e a regra do webhook real).

## REGRAS DURAS (valem mais que qualquer item abaixo)
1. NENHUMA requisição ao webhook real, ao ambiente de producao nem ao ambiente de dev publicado. Nem GET. Prova por leitura e por execução contra servidores locais seus.
2. Só execute um modo do script (além do `--autoteste`) se você GARANTIR que todo endereço usado aponta para servidor local seu, por pasta de configuração temporária e arquivo de ambiente falso, sem editar o arquivo real. O `--autoteste` novo sobe servidores: leia o código antes de rodar e confirme que ele só fala com 127.0.0.1 e não lê o arquivo de ambiente real.
3. Nunca imprima, copie para arquivo nem cite valor do arquivo de ambiente real. Não abra `~/.config/agente-concierge/`. Sem `set -x`, sem modo verboso.
4. Servidores locais seus: só nas portas 8788 a 8792, conferindo antes que a porta está livre e derrubando no fim (confira com `ss -ltn`). Diga também em que portas o `--autoteste` sobe os servidores dele e se elas podem colidir com as portas 8787 a 8799, usadas por outras sessões nesta máquina. Nunca inicie o ambiente `producao` do Worker localmente.
5. Nenhum subagente. Nenhum commit, push ou troca de branch no checkout da coordenação.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em .../scratchpad/ver-k2, depois `git merge --no-ff --no-commit origin/frente-k`. `node_modules` por link simbólico para o do checkout da coordenação.

## O que provar ou refutar
1. **Falso verde fechado.** Com cada argumento extra possível (os da lista fechada com valor bom, com valor ruim, repetidos, com `=`, abreviados; os proibidos; argumento desconhecido; argumento vazio; `--` no meio) nunca sai `PRODUCAO OK` sem conversas reais. A contagem mínima de 60 casos pode ser enganada (linhas `[PASSOU]` vindas de outro lugar da saída, runner falso, saída do runner com erro no meio, casos pulados contados como executados)? O que acontece com saída 2 do runner e menos de 60 casos, com `EVAL REPROVADO`, com saída 0 e nenhuma linha de veredito?
2. **O número 60 se sustenta?** Hoje, quantos dos 98 casos do conjunto de desenvolvimento rodam contra um alvo que responde `ambiente: producao` (use `node evals/rodar.mjs --listar` e a trava do runner, por leitura ou com o seu agente de mentira)? Aviso: a frente dona do runner está mudando a trava para negação por padrão (contra alvo que não é dev, só roda caso com `confirma: false` explícito). Diga quantos casos têm hoje `confirma: false` explícito e se o mínimo de 60 continuaria alcançável depois dessa mudança. Isso não reprova; é informação para a coordenação.
3. **Redirecionamento.** 301, 302, 303, 307 e 308 no `/chat` e no `/saude`, para cada cliente (curl, requests, urllib, fetch do Node) e para o modo completo: nenhum pedido chega ao servidor de destino do `Location`, e o script reprova. O runner (`evals/rodar.mjs`) ainda segue redirecionamento (isso é da outra frente): diga o que o script faz nesse caso hoje.
4. **Só GET no webhook de mentira**, de novo, em todos os modos e nos cenários de falha da rodada 1, com o script novo.
5. **Limpador de saída e argumentos de processo:** nenhum endereço, hostname (em qualquer caixa) ou IP na saída nem em `ps`, inclusive nas mensagens novas (ferramenta ausente, tempo esgotado, 3xx).
6. **`--clientes` e o cabeçalho de chamadas:** ausente, zero, não numérico, negativo: reprova em cada cliente.
7. **`--autoteste`:** passa; quanto tempo leva; deixa processo ou porta ocupada quando é interrompido (mande SIGINT e SIGTERM no meio)? Plante de novo os 12 defeitos da rodada 1, adaptados, e mais os que você achar pertinentes: quais ele pega?
8. **Regressão:** os cenários que já reprovavam na rodada 1 (saúde ruim, GET de leads falhando, leads crescendo, runner reprovando ou com erro, cliente com 403) continuam reprovando. `--entrega` continua reprovando com o envio desligado e nunca manda conversa.
9. Leitura do script inteiro atrás de endereço, domínio, IP, e-mail ou nome de máquina escritos nele.

## Critério do veredito
Reprova: qualquer caminho que possa mandar requisição que não seja GET ao webhook real; conversa com confirmação podendo ir para producao por causa do script; endereço vazando; falso verde determinístico; `--autoteste` que deixa servidor no ar. O resto é BAIXO ou limite a documentar.

## Entrega
Relatório em <rascunho>/ver-k2-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados, prova de cada item com a saída real, o que NÃO foi verificado e a limpeza (servidores derrubados, portas livres, worktree removida, `git status --short` do checkout da coordenação vazio). Sondas em `ver-k2-sondas/` ao lado. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 20. Verificar frente S — gate de sigilo

14/11 00h03 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente do gate de sigilo corrigido (frente S). O repositório vai ficar PÚBLICO com o histórico inteiro; este script é a última barreira antes de cada commit e de cada push. Não confie no relatório da frente; prove ou refute. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/frente-gate`, cabeça 1d5e406, seis commits sobre a main, dois arquivos: `scripts/verificar-sigilo.sh` (alterado) e `scripts/verificar-sigilo.teste.sh` (novo).
- cf14598: lê o conteúdo de todos os commits publicáveis (antes só o índice);
- cef0c73: nenhuma saída mostra o texto encontrado (antes saíam até 8 caracteres do termo quando ele estava no corpo de uma mensagem de commit);
- 8eddf17: nome da empresa em host com sufixo composto;
- 66b2119: binário tratado como texto (`-a`) e limites documentados no cabeçalho;
- 30a6fa1 e 1d5e406: teste do gate.
A frente também decidiu sozinha: ler cada blob uma vez e só localizar o commit quando acha algo; procurar termos também em NOMES de arquivo e pasta; trocar por linha genérica toda localização que contenha um termo; no máximo 20 linhas por relato.

O gate deriva os termos proibidos de um arquivo de ambiente fora do repositório, em `${AGENTE_CFG:-$HOME/.config/agente-concierge}/env`, mais `sigilo-extra` e `sigilo-liberados` na mesma pasta. Achados que motivaram a mudança: <rascunho>/m2-codigo-1.md (seções A1, M1, M2 e B7) e as sondas em .../scratchpad/m2-codigo-sondas/sonda-sigilo.sh. Leia antes o `CLAUDE.md` do repositório (seções Sigilo e Histórico).

## REGRAS DURAS
1. Não abra, não liste e não copie nada de `~/.config/agente-concierge/`. Todo teste seu usa uma pasta de configuração FALSA apontada por `AGENTE_CFG`, com valores inventados (hosts terminados em `.invalid` ou `.test`), em repositórios descartáveis numa pasta temporária sua.
2. Única exceção: você pode rodar o gate novo UMA vez contra o repositório real, de dentro da cópia descartável mesclada, com a saída inteira redirecionada para um arquivo no seu rascunho, e olhar SÓ a última linha, o código de saída, o número de linhas e o tempo. Não abra esse arquivo de saída nem o cite: se o gate tiver defeito, ele pode conter um termo real.
3. Sem `set -x`, sem modo verboso. Nenhum subagente. Nenhum commit, push ou troca de branch no checkout da coordenação. Nenhuma rede além do que o próprio gate faz.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em .../scratchpad/ver-s, depois `git merge --no-ff --no-commit origin/frente-gate`. Guarde também a versão antiga do gate (`git show origin/main:scripts/verificar-sigilo.sh`) para comparar comportamento.

## O que provar ou refutar
1. **Histórico (A1).** Em repositório descartável: termo num commit e apagado no seguinte; termo só numa branch que não é a atual; só numa tag; só numa ref remota; em arquivo renomeado; em arquivo dentro de subpasta; em commit de merge; termo partido em duas linhas (não precisa pegar; diga); termo em maiúsculas ou minúsculas trocadas; cada tipo de termo (host, token, empresa, nome de máquina, host de variável `_URL`, linha de `sigilo-extra`). Em todos reprova, com saída diferente de 0, e mostra onde sem mostrar o termo.
2. **Nenhuma saída mostra o termo (M1).** Capture TODA a saída (stdout e stderr) do gate em cada cenário de reprovação: índice, histórico, assunto e corpo de mensagem de commit, nome de arquivo, nome de pasta, nome de branch, e-mail de autor fora do padrão, arquivo de ambiente versionado. Procure na saída o termo inteiro e qualquer pedaço dele com 4 caracteres ou mais (faça isso por programa, com os seus termos falsos). Inclua termo no começo de linha, termo que é o próprio nome do arquivo, e caminho que contém o termo.
3. **Falha fechada.** O gate nunca imprime `SIGILO OK` nem sai com 0 quando: falta o arquivo de ambiente; a variável do catálogo está vazia; `git` falha no meio (repositório corrompido, objeto ausente, `HEAD` sem commit, repositório raso); a leitura do histórico é interrompida; um `grep` do meio do encadeamento falha; o arquivo temporário não pode ser criado; há 0 commits. Procure encadeamento em que a falha de um comando é engolida (`|`, `||`, subshell, `set -e` ausente, `pipefail` ausente).
4. **Regressão: tudo o que a versão antiga pegava a nova continua pegando.** Monte a lista do que a versão antiga checa (índice, arquivo local ou de ambiente versionado, IP, e-mail, mensagens de commit, e-mails de autor e committer, reflog com amend, rebase ou squash, refs que não deveriam estar no remoto) e rode cada caso nas duas versões.
5. **Sufixo composto (M2).** Hosts de dois, três e quatro rótulos, com sufixo composto e simples, com e sem `sigilo-extra`: que termo de empresa é derivado em cada um? Algum caso deriva um termo curto ou genérico demais (falso positivo em massa: "api", "www", "app") ou nenhum termo sem avisar?
6. **Binário e nomes (B7 e a decisão da frente).** Termo entre bytes nulos, em arquivo grande, em nome de arquivo com espaço, acento, aspas e quebra de linha: pega, e a saída continua sem o termo e sem quebrar o formato.
7. **Falso positivo no repositório real:** a execução única da regra dura 2. Última linha, código de saída, tempo.
8. **O teste do gate** (`scripts/verificar-sigilo.teste.sh`): passa na versão nova e reprova a antiga (a frente diz que os casos b, c, d, d2, e e g falham na antiga). Só usa valores falsos e nenhum IP, e-mail ou coisa com cara de chave nos arquivos versionados. Limpa a pasta temporária mesmo quando é interrompido. Plante de 10 a 14 defeitos no gate novo, um por vez (voltar a ler só o índice; voltar a imprimir o começo da linha; tirar o `-a`; tirar a busca em nomes; engolir a falha da leitura do histórico; aceitar rótulo curto; tirar um tipo de termo) e diga quais o teste pega. Restaure depois de cada um e confira com `git diff --quiet`.
9. **O que continua de fora**, para a coordenação decidir: mensagem de tag anotada, IPv6, IP e e-mail em commits antigos, reescrita com push forçado, notas do git, stash. Para cada um diga se é alcançável na prática neste repositório (o `CLAUDE.md` proíbe push de outras refs e reescrita).
10. **Qualidade de shell:** aspas, nomes com caracteres especiais, uso de `mktemp` e limpeza por `trap`, dependências (ferramentas que precisam existir), tempo em repositório com 5.000 commits (extrapole).

## Critério do veredito
Reprova: termo que passa sem ser pego num caminho publicável; qualquer pedaço de termo na saída; `SIGILO OK` em caminho de erro; algo que a versão antiga pegava e a nova não pega; falso positivo que impediria todo commit no repositório real. O resto é BAIXO ou limite a documentar.

## Entrega
Relatório em <rascunho>/ver-s-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, onde, resumo), prova de cada item com a saída real (dos seus cenários falsos), o que NÃO foi verificado e a limpeza (pastas temporárias e worktree removidas, `git status --short` do checkout da coordenação vazio). Sondas em `ver-s-sondas/` ao lado. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 21. Verificar frente B2 — rodada 2 (juiz e runner)

14/11 00h10 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente, segunda rodada da frente B2 (harness de evals: runner, juiz e casos de desenvolvimento). Este juiz vai decidir a prova de qualidade do produto: três rodadas seguidas com pelo menos 95% por bloco. Um juiz frouxo infla a nota; um juiz que reprova resposta certa impede a prova. Os dois lados importam. Não confie no relatório da frente; prove ou refute. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Branch: `origin/frente-b2`, cabeça 897e44b. Arquivos da frente: `evals/rodar.mjs`, `evals/teste-do-runner.mjs`, `evals/lib/**` (inclui o novo `evals/lib/rotulo-componente.mjs` e `evals/lib/juiz-preco.mjs`), `evals/casos/dev/**`, `evals/README.md`. A rodada 1 reprovou a cabeça 15cbb00 com 4 achados ALTOS (o juiz aprovava desconto do tipo "Cada noite sai por R$ X", total errado com "no total" depois do valor, e as proibidas de `inv-07` e `man-07` estavam frouxas), mais médios, e 7 de 18 defeitos plantados escapavam.

Commits desde então (`git log --first-parent --no-merges origin/main..origin/frente-b2`):
- Lista do juiz: 3deb630 (componente conferido pela estrutura da estadia), e8b5d79 (proibidas de `inv-07`, `man-07`, `hand-09`, `inv-01`), 6b18786 (`lead-12-troca-resumo` turno 4 e varredura P13), 1c6e92a (`lead-05` t2), 25a8106 (diária pelo tipo de noite; concessão pela construção; motivo no erro), b954a48 (proibidas aceitam pergunta indireta e "quando"), 897e44b (rótulos em inglês: `con-10`).
- Runner: 4a4e2ef (trava de producao por negação: fora de dev só roda caso com `confirma: false` explícito; recusa na carga caso sem nenhum `espera` e sem `leads_esperados`), 3b37fa0 (`leads_ate_agora` em turno paralelo), cfa662d (juiz recusa hóspedes 0, negativo, fracionário, NaN), 21e6e9c (`pedidos_sem_uso`), 808d6a8 (`redirect: "manual"` nas chamadas; 3xx no `/chat` é falha do turno).

Leia antes: `CLAUDE.md` (sigilo; a regra do conjunto reservado), `docs/EVALS.md` inteiro, `docs/CONTRATO.md` (§3 preço, §7, as linhas L5a, L8, L9, L12, L13, L13a, L14, L15) e, em `DECISOES.md`, P11 a P20 e X24. Material da rodada 1 (reaproveite): <rascunho>/ver-b2c-relatorio.md e ver-b2c-sondas/ (corpus de 100 respostas certas e erradas, sondas 1 a 7, mutantes). Respostas REAIS do agente com o modelo de produção, para medir falso reprovado: .../scratchpad/haiku-int7-registro.jsonl (169 respostas, rodada integrada mais recente, modelo em nível alto) e haiku-int3-registro.jsonl (169, rodada anterior). Campos: `s` sessão, `m` mensagem do hóspede, `r` resposta, `h` handoff. Achados da revisão de código que geraram os itens do runner: .../scratchpad/m2-codigo-1.md (seções M3 e M4) e m2-codigo-sondas/.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em .../scratchpad/ver-b2d, depois `git merge --no-ff --no-commit origin/frente-b2` (a main já tem as frentes F e I). `node_modules` por link simbólico para o do checkout da coordenação. Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest. Agente e webhook, quando precisar, só de mentira, locais, nas portas 8788 a 8792 (confira antes que a porta está livre, derrube no fim, confira com `ss -ltn`).

## Parte A · o juiz
1. **Os achados da rodada 1**, um a um, com as mesmas sondas: fechados? Rode o corpus de 100: erradas aprovadas e certas reprovadas (a frente diz 0 e 1; a certa que sobra é "2 noites × R$ 590,00 = R$ 1.180,00").
2. **Corpus novo, seu, que a frente não viu:** pelo menos 60 respostas ERRADAS e 60 CERTAS, metade em português e metade em inglês, escritas no estilo das respostas reais (leia umas 30 do registro antes). Erradas: desconto concedido de formas diferentes; total errado; total certo com componente errado; diária comum apresentada como de sexta e sábado e o contrário; taxa de limpeza cobrada por noite; número de noites errado; valor por hóspede; total sem a limpeza apresentado como total; valor de outro imóvel; "from R$", "starting at"; desconto em inglês ("I can offer", "discounted", "special rate"). Certas: as mesmas contas com redações variadas, listas, tabelas, negrito, valores repetidos, recusa de desconto que cita os valores, explicação da regra de sexta e sábado. Meça os dois erros. O inglês é o ponto fraco conhecido (o `con-10` reprovou uma resposta certa em inglês na rodada integrada).
3. **Respostas reais:** rode o juiz como o runner roda (ligue cada resposta ao turno do caso) sobre os dois registros. Liste TODA reprovação e classifique: resposta errada de verdade, ou juiz errado. A frente diz que nenhuma das 163 ligadas reprova no registro novo.
4. **A decisão da frente de não aceitar "qualquer valor igual a um componente":** concorda? Mostre o que cada escolha deixaria passar ou reprovaria.
5. **Casos mexidos** (`lead-12-troca-resumo`, `lead-05`, `hand-09`, `inv-07`, `man-07`, `inv-01`): a expectativa nova segue o contrato e as decisões, ou afrouxou? Para cada um, escreva uma resposta errada plausível que o caso antigo reprovava e veja se o novo ainda reprova.
6. **Juiz de hóspedes inválidos** e o restante de `juiz-preco.mjs`: as contas continuam batendo com o produto (compare com `src/nucleo/preco.ts` em pelo menos 200 estadias).
7. **Tempo:** entrada de 40.000 caracteres e entradas montadas para forçar retrocesso nas expressões regulares novas.

## Parte B · o runner
8. **Trava de producao por negação:** monte um agente de mentira que responde `ambiente: producao` no `/saude`. Só rodam casos com `confirma: false` explícito? Tente furar: `confirma` como texto, `0`, `null`, ausente, dentro de subturno; caso com confirmação e a marca errada; alvo que muda de ambiente entre o `/saude` e o `/chat`. Algum caso marcado `confirma: false` nos 98 manda mensagem de confirmação, nome com telefone seguido de "sim", ou espera lead? Liste por leitura dos arquivos de caso, um a um, não por palavra-chave. Quantos casos ficam elegíveis contra producao (outro script exige pelo menos 60 executados)?
9. **Carga:** caso sem `espera` é recusado; os 98 casos carregam (`node evals/rodar.mjs --listar`).
10. **`leads_ate_agora` em paralelo:** a sonda da revisão reprova agora; e os limites (um subturno com o campo e outro sem; valores diferentes).
11. **Redirecionamento:** 301, 302, 307 e 308 no `/chat`, no `/saude` e na leitura de leads: nenhum pedido chega ao destino do `Location`, o turno falha, e o endereço do `Location` não aparece na saída nem no relatório.
12. **`pedidos_sem_uso`:** bate com o que aconteceu (erro de rede, tempo esgotado, resposta sem cabeçalhos).
13. **Autotestes:** `node evals/teste-do-runner.mjs`, `--trava`, `node --test evals/simulador/teste.mjs`, `node evals/simulador/gerar-casos-ataque.mjs --verificar`. Plante de 14 a 18 defeitos, um por vez, no juiz novo e no runner (inclusive os 7 que escapavam na rodada 1) e diga quais os autotestes pegam. Restaure depois de cada um e confira com `git diff --quiet`.
14. **Linha de base:** `npm test -- --maxWorkers=3` e `npm run tipos` na cópia mesclada.

## Critério do veredito
Reprova: o juiz aprova resposta errada de forma determinística num padrão que o agente real pode escrever; o juiz reprova resposta certa num padrão que aparece nas respostas reais ou que é redação natural em português ou inglês (impede a prova dos 95%); expectativa de caso afrouxada contra o contrato; a trava de producao pode ser furada; o runner segue redirecionamento com POST. O resto é BAIXO ou limite a documentar. Diga, no fim, se você usaria este juiz para a prova dos 95% e com quais ressalvas.

## Proibições
Nenhum subagente. Nenhuma rede, nenhum modelo real, nenhuma eval contra agente real. NUNCA abra o conjunto reservado nem `~/.config/agente-concierge/`. Nenhum commit, push ou troca de branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-b2d-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados (gravidade, onde, resumo), prova de cada item com a saída real, o que NÃO foi verificado e a limpeza (servidores derrubados, worktree removida, `git status --short` do checkout da coordenação vazio). Sondas e o corpus novo em `ver-b2d-sondas/` ao lado. Escreva o veredito e os achados no relatório assim que os tiver, ANTES dos defeitos plantados, e atualize depois. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 22. Verificar frente T — datas sem ano (P21)

14/11 00h24 · claude-opus-5-5 · esforço high

````text
Você é um verificador independente da frente T (datas sem ano). Só o delta. Não confie no relatório da frente; prove ou refute com execução. Responda em português do Brasil.

## Alvo
Repositório: <worktree da coordenação> (checkout da coordenação; NÃO troque de branch nele, não edite nada nele, não faça commit nem push).
Commit a verificar: e53e777 (branch `origin/frente-datas`). Ele foi construído por cima da branch de outra frente, a G (commit da64da4), que está em verificação à parte e entra na main antes. O SEU delta é só `da64da4..e53e777`, dois commits:
- 5e5c07a fix(datas): saída sem ano a mais de 90 noites da entrada não cota (P21), em `src/nucleo/datas.ts` e `src/agente/ferramentas/pedido.ts`, com `test/datas-sem-ano-t.test.ts`;
- e53e777 test(datas): recusa da P21 pelo turno inteiro, sem total e sem handoff.
Não avalie o código da G; se algo dela atrapalhar, anote e siga.

Leia antes: `CLAUDE.md` (sigilo); em `docs/CONTRATO.md`, a §3 (as três recusas), as linhas L1, L1b, L2 e o critério CA-06; em `DECISOES.md`, P1 a P7 (datas) e a P21, que é a regra desta frente: quando a saída foi escrita SEM ano e, resolvida depois da entrada como manda a P5, cai MAIS DE 90 noites depois dela, o código não cota; recusa, sem total, e o agente pede as datas de novo (com o ano, se a estadia for longa mesmo). 90 noites exatas passam. Saída escrita com ano não entra na regra. Não é caso de passar para humano.
O defeito de origem: "de 20/01 a 18/01" virava 363 noites com total de seis dígitos.

## Como trabalhar
Cópia descartável: `git worktree add --detach <pasta> origin/main` em <rascunho>/ver-t, depois `git merge --no-ff --no-commit e53e777`. Uma segunda cópia em .../scratchpad/ver-t-base com `git merge --no-ff --no-commit da64da4`, para comparar antes e depois. `node_modules` por link simbólico para o do checkout da coordenação. Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest, nunca `--root`. Sondas copiadas para `test/` só para rodar e retiradas depois. Modelo sempre simulado.

## O que provar ou refutar
1. **A regra, ao pé da letra.** Para entrada em pelo menos 20 datas diferentes (fim de mês, virada de ano, ano bissexto, 29/02) e saída sem ano: exatamente 90 noites cota, 91 recusa, e nada no meio foge. Faça uma varredura: para cada entrada, todas as saídas possíveis sem ano (366 dias) nas duas árvores; liste só o que mudou de resultado. Tudo o que mudou tem de ser "cotava acima de 90 noites, agora recusa". Nada abaixo de 91 noites pode ter mudado.
2. **O que conta como "sem ano".** Passe por todos os formatos que o leitor de datas aceita (dia e mês com barra, com hífen, com ponto; mês por extenso em português e em inglês; abreviado; "dia 18"; dia da semana; "amanhã", "depois de amanhã"; data ISO; ano com dois dígitos, que pela P7 é ano escrito). Para cada um, diga se a saída é tratada como com ano ou sem ano e se o resultado está certo pela regra. Procure o formato em que a marcação erra para algum dos dois lados: saída COM ano recusada (regressão), ou saída SEM ano a 300 noites cotada (furo).
3. **Não regressão da P5 e do resto das datas.** "de segunda a sexta" dito numa quarta; "de 29/12 a 02/01"; saída no mesmo mês; os exemplos de P1 a P7. Todos os testes existentes de datas, preço, cotação e pedido dão o mesmo resultado nas duas árvores.
4. **Pelas ferramentas e pelo turno.** `cotar` e `montar_resumo`: o resultado para o modelo não tem total nem valor em reais; `handoff` falso; com resumo pendente, o que acontece é o mesmo que nas outras recusas de data (compare com a recusa de entrada no passado, campo a campo).
5. **A instrução ao modelo.** Leia o texto. Ela diz para pedir as datas ao hóspede e NÃO escolher o ano por conta própria? Se o modelo chamar a ferramenta de novo com o ano que ele mesmo pôs ("18/01/2028"), a cotação de 363 noites sai: isso é esperado pela regra (saída com ano), mas a instrução deveria desencorajar. Diga se o texto atual desencoraja e proponha a frase, se faltar. Não reprove por isso; é para a coordenação decidir.
6. **Casos de borda:** entrada sem ano com saída com ano (a frente diz que continua cotando a estadia longa, por estar fora da regra); entrada e saída iguais; saída um dia antes da entrada; entrada no passado com saída sem ano; hoje em 31/12 e em 28/02 de ano não bissexto; fuso de São Paulo perto da meia-noite.
7. **Inglês:** as mesmas datas como um hóspede em inglês escreveria.
8. **Defeitos plantados:** de 8 a 12, um por vez, no delta (90 por 91; maior por maior ou igual; marcação invertida; recusa só em `cotar`; recusa que devolve total; teto aplicado a saída com ano). Diga quais a suíte pega. Restaure depois de cada um e confira com `git diff --quiet`.
9. **Linha de base:** `npm test -- --maxWorkers=3` e `npm run tipos` nas duas árvores, com as contagens.

## Critério do veredito
Reprova só: defeito determinístico (estadia de 91 noites ou mais com saída sem ano que ainda cota; estadia que cotava certo e agora é recusada; total ou valor na recusa; handoff indevido; resumo pendente em estado diferente do das outras recusas de data). O resto é BAIXO ou limite a documentar.

## Proibições
Nenhum subagente. Nenhuma rede, nenhum servidor, nenhum modelo real, nenhum POST. Não abra `~/.config/agente-concierge/`. Nenhum commit, push ou troca de branch no checkout da coordenação.

## Entrega
Relatório em <rascunho>/ver-t-relatorio.md, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, hash revisado, tabela de achados, prova de cada item com a saída real, o que NÃO foi verificado e a limpeza (as duas worktrees removidas, `git status --short` do checkout da coordenação vazio). Sondas em `ver-t-sondas/` ao lado. A mensagem final repete o veredito e os achados em poucas linhas.
````

## 23. Verificador K3: delta do script de producao

14/11 00h39 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 3, curta) do script `scripts/validar-producao.sh` da frente K do repositório `agente-concierge`. Responda em português do Brasil. Não confie no relatório da frente: prove cada ponto rodando.

## O que verificar
- Delta exato: commits `86c00c1` e `b57b4ee` (intervalo `f28ce3e..b57b4ee`), um arquivo só: `scripts/validar-producao.sh`. Use sempre os hashes, nunca o nome da branch.
- Leia antes: `CLAUDE.md` do repositório e o relatório da rodada 2, em `<rascunho>/ver-k2-relatorio.md` (sondas dela em `ver-k2-sondas/` na mesma pasta; reaproveite `fixo/falso.py`, `fixo/rodar.sh`, `fixo/contar.mjs` copiando para a sua pasta).

## Perguntas a responder com prova
1. **Bloqueio da rodada 2 fechado?** No modo completo, com o `/chat` do agente falso respondendo 307 ou 308 para outro servidor: quantos pedidos chegam ao destino do `Location`? Tem que ser zero, e o modo completo tem que reprovar. Repita com 301, 302 e 303 (nenhum GET ao destino). Confira se o envoltório do `fetch` no `NODE_RUNNER` cobre TODO caminho de rede do runner (`evals/rodar.mjs` e o que ele importa): `fetch` chamado com objeto `Request`, `fetch` importado de outro módulo, uso de `node:http`/`node:https`/`undici`, processo filho que o runner abra. Se existir um caminho que escape, mostre com sonda.
2. **Baixos da rodada 2 (itens 2 a 6 da tabela):** cada um corrigido de fato? `EVAL PARCIAL (pausa_ms=N)` aceito sem aceitar veredito errado; runner em grupo de processos próprio e morto no fim (SIGTERM, SIGHUP, SIGINT no Python: o filho morre? quantos POST chegam depois do sinal?); `principal` sem `validar_extras` pego pelo autoteste; `re.fullmatch(r"[0-9]+")` no lugar de `isdigit()`; cabeçalho dizendo o que o limpador não mascara.
3. **Risco novo do delta:** a morte do grupo de processos pode atingir o próprio script, o shell que o chamou ou outro processo? Código de saída certo em cada sinal? Algum caminho novo que dê `PRODUCAO OK` quando deveria reprovar (falso verde)? Algum caminho novo que imprima URL, host, token ou IP sem máscara?
4. **Sem regressão:** rode de novo a matriz da rodada 2 (os casos que ela guardou) e diga quantos mudaram de resultado e por quê. `scripts/validar-producao.sh --autoteste` tem que dar `AUTOTESTE OK`.
5. **Mutantes:** plante de novo, um por vez, os defeitos da rodada 2 que escapavam do autoteste (os 10 do item 7 daquele relatório) mais estes: runner sem o envoltório do `fetch`; `principal` sem `validar_extras`; `pausa_ms` voltando a reprovar; `isdigit` de volta; morte do grupo retirada. Diga quantos o autoteste pega.

## Critério do veredito
- REPROVADO se existir qualquer caminho que possa mandar requisição que não seja GET ao webhook real, qualquer falso verde, vazamento de endereço ou token na saída, ou regressão de item já aprovado.
- Baixo que não gera nada disso NÃO reprova: entra na tabela como limite a documentar.

## Regras duras
- **Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado.** Só servidores falsos seus em `127.0.0.1`.
- **Não abra `~/.config/agente-concierge/`** nem leia variável de ambiente real. Toda execução do script com `env -i`, `HOME` vazio e `AGENTE_ENV` apontando para um arquivo falso com endereços `127.0.0.1`.
- Portas para os seus servidores falsos: **só 8796, 8797 e 8798** (confira livres com `ss -ltn` antes; se ocupadas, pare e avise). Não use nenhuma outra porta de 8788 a 8799.
- Cópia de trabalho: `git worktree add --detach <pasta> origin/main` numa pasta `ver-k3` dentro de `<rascunho>/`, depois `git merge --no-ff --no-commit b57b4ee` nela. No fim: `git merge --abort` (ou descarte) e `git worktree remove --force`. **Não edite, não faça commit, não faça push, não crie branch** e não toque no checkout em que você nasceu (não crie arquivo nele).
- Carga da máquina: se precisar de `npm test` ou `tsc`, só por `~/.cache/agente-concierge/com-trava.sh <comando>` e com `--maxWorkers=3`. Não abra subagentes. Não suba servidor do agente (`wrangler dev`): o script é testado com agente falso.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP que não seja `127.0.0.1`, nome de máquina ou e-mail.

## Entrega
- Relatório em `<rascunho>/ver-k3-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois: o que reprova (se reprovar), tabela de achados com gravidade, prova por item (comando, saída resumida, contagem de pedidos por servidor), mutantes pegos de quantos.
- Sondas em `ver-k3-sondas/` na mesma pasta.
- Mensagem final curta: veredito, os achados em uma linha cada e o caminho do relatório.
````

## 24. Verificar frente H — rodada 4 (delta da fila: B1 e B2)

14/11 01h00 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 4, só o delta) da frente H do repositório `agente-concierge` (fila por sessão no Durable Object). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 35 minutos. Grave o veredito e os achados no relatório assim que os tiver, antes dos defeitos plantados.

## O que verificar
- Hash exato: `03e1605` (branch remota `origin/t3/durable-session-concurrency`; use o hash, nunca o nome). A rodada 3 revisou `a58ff5e` e reprovou por dois achados. O delta da frente são só estes commits: `ffb885a` (B1), `6956937` (B2), `0243cb8` (ajuste do teste do B2 à frente G) e `03e1605` (teste do alcance do B1). Os outros commits do intervalo são merges da `main` (frente G, já verificada): não revise a G.
- Leia antes: `CLAUDE.md` do repositório e o relatório da rodada 3, `<rascunho>/ver-h3-relatorio.md` (seções B1, B2, item 5 e a varredura da P14). As sondas dela estão em `ver-h3-sondas/` na mesma pasta: reaproveite.

## Barra de aprovação (fechada: aprove se tudo isto valer; não abra frente nova de investigação)
1. **B1 fechado:** "quero fechar" e "sim" mandados ao mesmo tempo não geram lead de resumo que o hóspede não tinha recebido. A sonda D1 da rodada 3 (que afirmava o defeito) fica vermelha, com 0 leads. O controle D1 continua verde.
2. **Misturas do item 5:** as rajadas de 5 e de 10 mensagens (inclusive "hospedes 3" seguido de "sim", "hospedes 4" seguido de "confirmo") saem sem nenhum lead de resumo não visto, em pelo menos 10 rodadas de cada; todas as mensagens são respondidas, na ordem de chegada, e nenhuma chave de reserva tem 2 leads.
3. **B2 fechado:** quando o Worker desiste com o pedido ainda na fila do objeto, o resumo gravado depois não fica confirmável sem ter sido visto. Sondas D2 e D2b vermelhas com 0 leads; controle D2c verde. A frente diz que a D2b fica vermelha também por outro motivo depois do merge com a G (o turno "lento" derruba o resumo visto, porque o modelo falso da sonda não responde "NÃO" à pergunta fechada da G) e que o teste dela `B2b` isola o B2: confira se isso é verdade e se o teste `B2b` fica vermelho sem o commit `6956937`.
4. **Alcance do B1:** com o resumo já visto, dois "sim" simultâneos dão exatamente 1 lead, um "foi registrado" e um "já está registrado", sem reapresentação, nas duas ordens de chegada. É o formato dos casos de eval `evals/casos/dev/funciona-leads/lead-14-duplo-sim-paralelo.json` e `evals/casos/dev/contrato/con-07-confirmacoes.json`. Confira também que um "sim" sozinho depois de resumo visto envia na primeira vez (sem reapresentação indevida) e que mensagem que não é confirmação, enfileirada atrás de outro turno, é respondida normalmente.
5. **Sem regressão na P14:** rode de novo a varredura da P14 pela sessão da rodada 3 (pode ser um lote reduzido, mas diga quantas execuções e quais cortes): 0 violação.
6. **Flake:** a frente viu um teste de `test/fila-resumo-h` falhar uma vez depois do merge com a G e não reproduziu. Rode `fila-resumo-h` e `desistencia-h` pelo menos 20 vezes cada, parte delas com outra suíte rodando ao mesmo tempo. Qualquer falha reprova: diga qual teste e a causa.
7. **Risco novo do delta, só nestes pontos:** o id marcado como desistido "sempre" cresce sem limite ou é podado? Nova tentativa interna com o mesmo id depois da marca: o que o hóspede recebe? A marca do B1 sobrevive a reinício do objeto no meio da rajada (o que acontece com o "sim" depois do reinício: não pode enviar resumo não visto)?
8. **Integração:** árvore `origin/main` (confira o hash que usou) com `git merge --no-ff --no-commit 03e1605`: sem conflito, suíte inteira e tipos verdes.
9. **Defeitos plantados:** reverta cada correção (B1, B2, alcance) uma por vez na cópia e confirme que os testes novos da frente pegam.

REPROVA: lead de resumo não visto por qualquer caminho de fila medido; mais de 1 lead na mesma reserva; dois "sim" depois de resumo visto que não dão 1 lead; falha de teste intermitente; suíte ou tipos vermelhos na árvore integrada. Baixo que não gera lead errado NÃO reprova: entra na tabela como limite.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópias de trabalho: `git worktree add --detach <pasta> origin/main` em pastas `ver-h4*` dentro de `<rascunho>/`, com `git merge --no-ff --no-commit 03e1605`. No fim, remova as worktrees. Não edite, não faça commit, não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules`: link simbólico para o do checkout em que você nasceu, se o `package.json` não mudou.
- Carga: toda suíte e todo `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`, sem `--root`. Sem subagentes. Se precisar de servidor local, só portas 8788 a 8792, uma por vez, conferindo com `ss -ltn` antes.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail.

## Entrega
- Relatório em `<rascunho>/ver-h4-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra (passou ou não, com a prova), a tabela de achados e os defeitos plantados.
- Sondas em `ver-h4-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item da barra e o caminho do relatório.
````

## 25. Verificar frente S — rodada 2 (delta do gate de sigilo)

14/11 01h02 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 2, só o delta) do gate de sigilo do repositório `agente-concierge`: `scripts/verificar-sigilo.sh` e o teste dele. Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 30 minutos. Grave o veredito e os achados no relatório assim que os tiver.

## O que verificar
- Hash exato: `af79e24` (branch `frente-gate`; use o hash, nunca o nome). Delta: `1d5e406..af79e24`, 12 commits, só os dois arquivos da frente (confira com `git diff --stat 1d5e406 af79e24`).
- Leia antes: `CLAUDE.md` do repositório (seção Sigilo) e o relatório da rodada 1, `<rascunho>/ver-s-relatorio.md`. Se houver pasta de sondas da rodada 1 ao lado dele, reaproveite.

## Barra de aprovação (fechada: aprove se tudo isto valer; não abra frente nova de investigação)
1. **Os 5 médios da rodada 1 fechados**, cada um com sonda sua: (a) byte 0x1E numa mensagem de commit não esconde termo; (b) linha inválida no arquivo de ambiente sai com 2 mostrando só o número da linha, nunca o conteúdo, e nunca termina em `SIGILO OK`; (c) termo em nome de branch, nome de tag, mensagem de tag anotada, nome de autor e de committer é pego; (d) branch órfã (HEAD sem commit) não pula o histórico; (e) falha de leitura do git sai com 2, nunca com `SIGILO OK`.
2. **Os baixos que viraram código:** clone raso sai com 2; `sigilo-extra` vazio não desliga o nome da empresa derivado; nome de arquivo com termo é pego, inclusive arquivo criado só num merge e nome não ASCII; a busca de e-mail não trava em linha longa.
3. **Sem falso verde novo:** plante, numa cópia descartável com arquivo de ambiente FALSO, um termo em cada lugar que o gate diz cobrir (arquivo no índice, arquivo apagado em commit antigo, corpo e assunto de mensagem de commit, nome de arquivo, nome de branch e de tag). Cada um tem que reprovar.
4. **Sem falso vermelho que trave o trabalho:** o arquivo de ambiente é lido como dado. Teste os formatos que um arquivo real costuma ter (`NOME=valor`, `export NOME=valor`, aspas simples e duplas, comentário no fim, linha vazia, valor com `=` ou com `&` dentro de aspas, URL com caminho e consulta). Diga exatamente quais formatos saem com 2. Um formato comum e legítimo que saia com 2 é achado MÉDIO, porque o gate roda antes de todo commit.
5. **Nada de segredo na saída:** em nenhum caminho (achado, erro de formato, falha de leitura, tempo esgotado) o gate imprime o valor de um termo, de uma variável do arquivo de ambiente ou mais que a contagem e o local. Confira com termos falsos e `grep` na saída.
6. **Tempo:** no repositório real (cerca de 480 commits) o gate termina em menos de 10 s. Para medir isso, rode o gate na sua cópia descartável SEM arquivo de ambiente real: use o mecanismo que o próprio gate e o teste dele oferecem para apontar para um arquivo falso. Se não der para medir sem o arquivo real, diga isso e não meça.
7. **Mutantes:** plante de novo, um por vez, os 5 que escapavam na rodada 1 e os 3 que a frente acrescentou; o teste do gate tem que pegar todos. Acrescente até 5 seus nos trechos novos (leitura do arquivo de ambiente, `le()`, nomes de ref).
8. `TESTE DO GATE OK` com saída 0, também com `LC_ALL=C`.

REPROVA: termo plantado que passa com `SIGILO OK` num lugar que o gate diz cobrir; valor de segredo na saída; `SIGILO OK` depois de falha de leitura; teste do gate vermelho; formato legítimo comum do arquivo de ambiente saindo com 2. Limite já documentado no cabeçalho do script NÃO reprova (IP e e-mail só no índice, IPv6, reescrita com push forçado, sufixos longos, termo partido por quebra de linha): só confira que o cabeçalho diz a verdade.

## Regras duras
- **Não abra nem leia `~/.config/agente-concierge/`** (nem `env`, nem `sigilo-extra`, nem a pasta do reservado) e não imprima variável de ambiente real. Toda execução do gate nas suas sondas usa arquivo de ambiente e termos FALSOS (por exemplo host `exemplo-falso.test`, token `tokfalso123`).
- Nenhuma rede. Nenhuma requisição a `producao`, a `dev` ou ao webhook.
- Cópias de trabalho: `git worktree add --detach <pasta> af79e24` e repositórios git novos de brinquedo, tudo dentro de `<rascunho>/ver-s2/`. No fim, remova a worktree. Não edite, não faça commit, não faça push e não crie branch, tag nem arquivo no repositório real nem no checkout em que você nasceu (branch e tag de teste só nos repositórios de brinquedo).
- Sem subagentes. Se rodar `npm test` ou `tsc`, só por `~/.cache/agente-concierge/com-trava.sh <comando>` com `--maxWorkers=3`.
- Sigilo: no relatório e nas sondas, nada de nome de empresa real, domínio real, token, IP, nome de máquina ou e-mail real.

## Entrega
- Relatório em `<rascunho>/ver-s2-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra (passou ou não, com a prova), a tabela de achados e os mutantes.
- Sondas em `ver-s2/sondas/`.
- Mensagem final curta: veredito, uma linha por item da barra e o caminho do relatório.
````

## 26. Verificar frente F — rodada 7 (delta da P20: nome do lead)

14/11 01h12 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 7, só o delta) da frente F do repositório `agente-concierge` (lead). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 35 minutos. Grave o veredito e os achados no relatório assim que os tiver, antes dos defeitos plantados.

## O que verificar
- Hash exato: `8f8fbd5` (branch `origin/frente-f`; use o hash, nunca o nome). A `main` está em `0e68247` ou adiante (confira e anote). O delta da frente sobre a `main`: em `src/`, só `src/agente/ferramentas/lead.ts` (commit `63b6e8c`, a regra); o resto são testes (commits `8cce20b`, `2113c7e`, `1b24c7b`, `2e760bb`, mais `test/nome-f.test.ts`).
- A regra (decisão P20 no `DECISOES.md`, leia a linha inteira): o nome do lead só pode ser formado por palavras que o hóspede escreveu na conversa, comparadas sem diferenciar maiúsculas e acentos; o nome pode ter vindo em pedaços, em mensagens diferentes; se alguma palavra do nome não está em nenhuma mensagem do hóspede, `montar_resumo` recusa e devolve ao modelo a instrução de usar o nome como o hóspede escreveu, ou pedir o nome; nome de uma palavra só continua aceito (L20).
- Leia antes: `CLAUDE.md`, a P20 e a L20, e `git show 63b6e8c -- src`.

## Barra de aprovação (fechada: aprove se tudo isto valer; não abra frente nova de investigação)
1. **A regra faz o que a P20 diz**, no nível da ferramenta: nome com palavra que o hóspede não escreveu é recusado e nenhum resumo é gravado; nome formado só por palavras dele passa, em qualquer caixa, com ou sem acento, vindo em pedaços de mensagens diferentes; nome de uma palavra passa; o caso do incidente ("o titular é o Pedro" e o modelo passa "Pedro (se puder, me diga também o sobrenome)") é recusado.
2. **Pelo caminho real da sessão (Durable Object `Sessao` e o laço do agente, com modelo falso roteirizado):** o hóspede diz o nome num turno e pede para fechar em outro turno, mais tarde. O resumo tem que sair. Se o histórico não chegar ao contexto da ferramenta no caminho de produção, o nome dito antes seria recusado para sempre: isso reprova. Teste o nome dito 1, 5 e 30 turnos antes, e depois de reinício do objeto.
3. **Sem laço que prenda o hóspede:** quando a ferramenta recusa e o modelo falso insiste no nome errado até o limite de voltas do laço, o que o hóspede recebe? Tem que ser uma resposta coerente (pergunta pelo nome ou contingência com `handoff`), nunca um resumo com o nome errado, nunca "registrado", nunca um POST. Diga o texto exato.
4. **Nenhum lead errado novo:** com a regra, o lead enviado tem exatamente o nome do resumo que o hóspede confirmou; a recusa não apaga nem troca um resumo já pendente (confira o que acontece com o resumo aberto quando um `montar_resumo` seguinte é recusado pelo nome: o "sim" depois disso envia o quê?).
5. **Formas reais de nome que não podem ser recusadas** quando o modelo repete o que o hóspede escreveu: hífen e apóstrofo ("Ana-Maria", "D'Ávila", "O'Brien"), partículas ("de", "da", "dos"), abreviação como o hóspede escreveu ("Maria Ap. Souza"), nome em maiúsculas ou minúsculas, nome com número ou sufixo ("João Paulo II", "Carlos Jr."), nome não latino, nome com emoji ao lado na mensagem, nome dito em inglês ("my name is John Smith"). Liste as que são recusadas; recusa de forma comum é achado MÉDIO.
6. **Cenário de segurança mantido:** nome com valor em reais escrito pelo hóspede ("Ana R$ 10,00") continua sem liberar valor na resposta do modelo (a trava de valores da frente G), e o resumo não é montado com valor inventado.
7. **Os commits de teste em arquivos de outras frentes (`2113c7e`, `1b24c7b`, `2e760bb`) só mudam o texto da mensagem do hóspede:** confira linha a linha que nenhuma asserção e nenhum roteiro do modelo mudou (a frente diz que em `8cce20b` uma linha com `expect(` mudou só no argumento da mensagem: confira). Confira a afirmação de que `1b24c7b` conserta 8 testes que passavam sem montar o resumo que preparavam.
8. **Integração:** árvore `origin/main` com `git merge --no-ff --no-commit 8f8fbd5`: sem conflito, suíte inteira e tipos verdes. Rode também as sondas das rodadas anteriores da F que você encontrar em `ver-f*-sondas/` na pasta abaixo; as que roteirizam um nome que o hóspede não escreveu precisam do nome na mensagem do hóspede para valer (ajuste só isso na sua cópia e diga quantas ajustou).
9. **Defeitos plantados na regra**, um por vez: sem a recusa; só a mensagem do turno conta (ignora o histórico); qualquer papel do histórico conta (mensagem do agente prova o nome); comparação por pedaço de texto em vez de palavra; sem tirar acento; conferência depois do corte de 120 caracteres. A suíte tem que pegar todos.

REPROVA: nome que o hóspede não escreveu chegando a um resumo ou a um lead; nome dito em turno anterior recusado no caminho da sessão; resumo com nome errado depois do limite de voltas; lead diferente do resumo confirmado; asserção ou roteiro mudado nos commits de teste das outras frentes; suíte ou tipos vermelhos na árvore integrada. Limites já aceitos NÃO reprovam (só confirme que são verdade): palavras do hóspede em outra ordem ou combinação passam; pontuação e símbolos não são conferidos; fora da janela de 80 mensagens o nome é pedido de novo; sem histórico no contexto só a mensagem do turno vale.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópias de trabalho: `git worktree add --detach <pasta> origin/main` em pastas `ver-f7*` dentro de `<rascunho>/`, com `git merge --no-ff --no-commit 8f8fbd5`. No fim, remova as worktrees. Não edite, não faça commit, não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules`: link simbólico para o do checkout em que você nasceu, se o `package.json` não mudou.
- Carga: toda suíte e todo `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`, sem `--root`. Sem subagentes. Sem servidor local.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail. Use nomes e telefones inventados.

## Entrega
- Relatório em `<rascunho>/ver-f7-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra (passou ou não, com a prova), a tabela de achados e os defeitos plantados.
- Sondas em `ver-f7-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item da barra e o caminho do relatório.
````

## 27. Verificar frente H — P24 e testes do nome (delta 03e1605..a4abacb)

14/11 01h15 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE de um delta pequeno da frente H do repositório `agente-concierge` (Worker da Cloudflare com um Durable Object `Sessao` por conversa). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 25 minutos. Grave o veredito e os achados no relatório assim que os tiver.

## O que verificar
- Só o delta `03e1605..a4abacb` (branch `origin/t3/durable-session-concurrency`; use os hashes, nunca o nome). São dois commits: `50ce319` (P24, em `src/chat.ts` e `src/sessao.ts`, mais `test/fora-do-turno-h.test.ts`) e `a4abacb` (só testes: o hóspede passa a escrever o nome nos testes da frente). O que vem antes de `03e1605` está com outro verificador: não revise.
- A P24 (leia a linha inteira no `DECISOES.md` da `origin/main`): com resumo pendente, quando o Worker responde fora do turno a uma mensagem vazia ("Pode escrever a sua mensagem?") ou acima de 8.000 caracteres ("Pode resumir?") e o `session_id` é conhecido, ele avisa a sessão, e a confirmação seguinte reapresenta o resumo em vez de enviar. Corpo acima de 64 KB continua sem tocar na sessão. Sem resumo pendente, nada muda.
- Leia antes: `CLAUDE.md`, a P24, a P18, e `git show 50ce319`.

## Barra de aprovação (fechada: aprove se tudo isto valer; não abra frente nova de investigação)
1. **Com resumo pendente e visto:** mensagem vazia e depois "sim": o "sim" reapresenta o resumo, com 0 POST e 0 chamada ao modelo; o "sim" seguinte envia 1 lead, igual campo a campo ao resumo reapresentado. O mesmo com mensagem acima de 8.000 caracteres (dentro de 64 KB). Pelo `POST /chat` real.
2. **Sem resumo pendente:** a mensagem vazia e a longa não mudam nada no turno seguinte (resposta, `handoff`, histórico) e não gravam nada no armazenamento da sessão. Confira também o caso de `session_id` que nunca existiu: o aviso cria alguma linha no armazenamento? Se cria, é achado MÉDIO (escrita sem limite por pedido vazio); se só instancia o objeto sem gravar, é limite a documentar.
3. **Corpo acima de 64 KB:** continua sem nenhuma chamada à sessão (conte as chamadas ao namespace) e com a mesma resposta de antes.
4. **O aviso é de melhor esforço:** se a chamada à sessão falha ou fica pendurada, o hóspede recebe a mesma resposta do Worker, no mesmo status, dentro do prazo curto; nada vira contingência nem erro 5xx.
5. **Fila:** mensagem vazia e "sim" mandados ao mesmo tempo, depois de resumo visto: no máximo 1 lead, nunca 2, e nenhum lead de resumo que o hóspede não viu. Diga o que acontece em cada ordem de chegada (enviar ou reapresentar são os dois aceitáveis).
6. **Reinício do objeto** entre a mensagem vazia e o "sim": diga se a marca sobrevive. Se não sobrevive, o "sim" envia o resumo visto: é limite a documentar, não reprova.
7. **O `handoff` não muda** por causa do aviso (essas respostas têm `handoff: false`), e o histórico da conversa não ganha turno fantasma que confunda o modelo no turno seguinte (mostre o que o modelo recebe no turno depois de uma mensagem vazia).
8. **Commit `a4abacb`:** confira linha a linha que só o texto da mensagem do hóspede mudou (e a mesma string na comparação do modelo falso); nenhuma asserção, nenhum roteiro e nada em `src/`.
9. **Integração:** árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit a4abacb`: sem conflito, suíte inteira e tipos verdes. Depois, na mesma árvore, `git merge --no-ff --no-commit` não é possível duas vezes: então monte uma segunda árvore com `origin/main`, merge de `8f8fbd5` (frente F, regra do nome do lead) e de `a4abacb` juntos, e rode suíte e tipos. A frente diz que dá 1450 de 1450; confira.
10. **Defeitos plantados:** tire o aviso no ramo da mensagem vazia; tire no ramo da mensagem longa; faça o aviso ligar a marca mesmo sem resumo pendente; faça o aviso gravar `handoff`. Os testes novos têm que pegar os quatro.

REPROVA: lead enviado no "sim" logo depois da mensagem vazia ou longa com resumo pendente (itens 1); 2 leads na mesma reserva; lead de resumo não visto; resposta do Worker mudada ou atrasada quando o aviso falha; chamada à sessão com corpo acima de 64 KB; asserção ou roteiro mudado no `a4abacb`; suíte ou tipos vermelhos numa das duas árvores. Baixo que não gera lead errado NÃO reprova.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópias de trabalho: `git worktree add --detach <pasta> origin/main` em pastas `ver-h5*` dentro de `<rascunho>/`. No fim, remova as worktrees. Não edite, não faça commit, não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules`: link simbólico para o do checkout em que você nasceu, se o `package.json` não mudou.
- Carga: toda suíte e todo `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`, sem `--root`. Há outros verificadores usando a trava: espere a sua vez, não contorne. Sem subagentes. Sem servidor local.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail.

## Entrega
- Relatório em `<rascunho>/ver-h5-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra (passou ou não, com a prova), a tabela de achados e os defeitos plantados.
- Sondas em `ver-h5-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item da barra e o caminho do relatório.
````

## 28. Verificar frente B2 — rodada 3 (delta do juiz, barra fechada)

14/11 01h25 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 3, só o delta) do juiz de preço e dos casos de eval da frente B2 do repositório `agente-concierge`. Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 35 minutos. Grave o veredito e os achados no relatório assim que os tiver, antes dos defeitos plantados.

## O que verificar
- Hash exato: `f4ee189` (branch `origin/frente-b2`; use o hash, nunca o nome). A rodada 2 revisou `7f12107` e reprovou. O delta da frente: `a859fe0` (A1), `7d0546b` (A2), `eaeb8f7` (A3), `3db6fd5` (A4), `6d0fbad` (M1), `e4d6281` e `7102f4b` (M2), `2fd997d` (os dois corpus viram teste de regressão em `evals/lib/corpus-juiz.json`), `a2e77f1` e `f4ee189` (limites do juiz no `evals/README.md`), `ab2c5e0` e `f150d8c` (caso novo `funciona-recusas/rec-12-saida-sem-ano-longe`). O merge `30b501a` traz a `main` com a frente G: não revise a G.
- Leia antes: `CLAUDE.md` e o relatório da rodada 2, `<rascunho>/ver-b2d-relatorio.md` (sondas, os dois corpus e as saídas em `ver-b2d-sondas/` na mesma pasta: reaproveite). Os cinco registros reais de conversas estão na mesma pasta: `haiku-int3-registro.jsonl` a `haiku-int7-registro.jsonl`.
- **Importante sobre o método:** a frente fechou o achado A3 pelos dois caminhos juntos (regra no juiz e expressões proibidas nos casos de desconto `hand-01`, `hand-03`, `marco1-02`, `man-12`). A sua `sonda-c2` da rodada 2 avalia só pelo juiz. Nesta rodada, avalie cada resposta como o runner avalia: pelo `espera` do caso inteiro (`avaliarRespostaTurno` em `evals/rodar.mjs`), não só pelo juiz de preço.

## Barra de aprovação (FECHADA: aprove se tudo isto valer. Não escreva um terceiro corpus genérico; um juiz por expressão sempre terá redação nova que escapa, e isso já está aceito como limite)
(a) **Os dois corpus (o de 100 da rodada 1 e o de 134 da rodada 2) são teste de regressão da frente**, com o veredito esperado de cada resposta, e o teste roda no autoteste (`node evals/teste-do-runner.mjs`). Confira que o veredito esperado gravado para cada resposta é o CERTO (errada marcada como reprova, certa como aprova), exceto as que estão na lista de limites, e que nenhuma resposta foi tirada dos corpus.
(b) **Nos cinco registros reais, zero resposta certa reprovada.** As únicas reprovações aceitas são erro real do agente: `lead-05` t3 no int6 e `man-06` t1 no int3. Refaça a sua sonda dos registros.
(c) **Zero errada aprovada nos mecanismos A1 e A3 e nos casos da rodada 1**, avaliando pelo `espera` do caso: as 10 frases da sua sonda c3 (total sem a limpeza com "pelas N noites" / "for the N nights") e as concessões W01, W02, W04, W05, W08 a W17, W20, W64, W68; e as erradas do corpus de 100.
(d) **Limites aceitos pela coordenação (não reprovam; só confira que cada um está escrito no `evals/README.md` com um exemplo e fixado no corpus):** conta com "×" e com "+"; subtotal e conta entre parênteses; "em vez de"; tabela com vírgula no rótulo; "come to"; subtotal chamado de total em inglês; concessão hipotética (R65); diária comum "por noite" com o acréscimo só descrito; negação a mais de 3 palavras da palavra proibida; "a partir de"; noites entre parênteses; total sem a limpeza e sem a palavra "total" (W25, W26, W28); componente trocado com o total certo; limpeza por noite em `sem_total`; contagem em inglês por extenso; valor por pessoa (inclusive a W51, que piorou nesta rodada); a fronteira W49.
(e) **Recusas naturais nos casos de desconto não podem ser reprovadas pelas proibidas novas.** Este é o único ponto em que você escreve respostas novas, e só para os quatro casos (`hand-01`, `hand-03`, `marco1-02`, `man-12`): tire dos cinco registros reais todas as respostas do agente a esses casos, e escreva mais 40 recusas CERTAS no mesmo molde de frase do agente real (português e inglês), usando as palavras que as proibidas novas procuram dentro de uma negação ("não posso isentar a taxa de limpeza", "não consigo baixar para", "I can't waive the cleaning fee", "we don't offer discounted rates"), com a negação a 1, 2, 3, 4 e 6 palavras de distância. Diga quantas são reprovadas e por qual expressão. Reprova a rodada só se uma resposta REAL dos registros for reprovada, ou se mais de 4 das 40 forem reprovadas com a negação a até 3 palavras; o resto entra como limite, com a lista.
(f) **M1 e M2:** `lead-05` t2 não aprova mais "Está tudo certo, então vou enviar seu pedido" e continua aprovando a pergunta de confirmação certa; `inv-07` reprova "normalmente devolvemos o valor pago" e "costuma ser grátis", e aprova "Não tenho informações sobre cancelamento, multa ou reembolso".
(g) **Caso novo da P21** (`rec-12-saida-sem-ano-longe`): o `espera` aprova uma recusa certa e reprova uma cotação. Respostas reais do agente a essa mensagem, medidas pela coordenação com o modelo de verdade, para você avaliar pelo `espera` do caso (as quatro têm que passar): (1) "Não consigo cotar com essas datas: a saída (18/01) é anterior à entrada (20/01). Pode confirmar as duas datas? Se a estadia for em meses diferentes, informe também o ano." (2) "Não consegui cotar essa estadia: a data de saída 10/03 vem antes da entrada 15/03 se considerarmos o mesmo ano, o que indica um possível erro de digitação. Pode confirmar as datas de entrada e de saída? Se a estadia for mesmo de um ano para o outro, informe também o ano." (3) "Não consegui calcular essa estadia. A data de saída (18 de janeiro) é anterior à de entrada (20 de janeiro), então deve haver um engano de digitação. Você pode confirmar as datas de entrada e de saída, incluindo o ano se for o caso?" (4) "Para cotar, preciso das datas completas, com o ano. A entrada seria 20/01 e a saída 18/01 de qual ano? Se a saída for em outro mês, informe também o mês. Assim que me passar, calculo o total do GRM-301 para 2 pessoas." E esta tem que reprovar: "A estadia de 20/01/2027 a 18/01/2028 fica em R$ 215.000,00 no total."
(h) **Sem regressão no que a rodada 2 aprovou:** trava de `producao` (casos com confirmação não rodam contra `producao`; 70 elegíveis, acima de 60), redirecionamento, `leads_ate_agora`. Só rode de novo as sondas que você já tem; não aprofunde.
(i) **Linha de base e autotestes:** árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit f4ee189`: sem conflito, `npm test` e tipos verdes, `node evals/teste-do-runner.mjs` com `RUNNER OK` e com `--trava` dando `TRAVA OK`. 100 casos no conjunto dev.
(j) **Defeitos plantados** nas regras novas (A1, A2, A3 no juiz, A4, e uma proibida de cada caso de desconto): reverta uma por vez e confirme que o autoteste pega.

REPROVA: qualquer item de (a), (b), (c), (f), (g), (h), (i) falhando; o limiar de (e) estourado; veredito esperado errado gravado no corpus fora da lista de limites. NÃO reprova: redação nova que você inventar fora de (e); os limites de (d); os baixos B1 a B6 da rodada 2.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado (`reservado/`).
- Cópias de trabalho: `git worktree add --detach <pasta> origin/main` em pastas `ver-b2e*` dentro de `<rascunho>/`. No fim, remova as worktrees. Não edite, não faça commit, não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules`: link simbólico para o do checkout em que você nasceu, se o `package.json` não mudou.
- Carga: toda suíte e todo `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`, sem `--root`. Há outros verificadores usando a trava: espere a sua vez. Sem subagentes.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail.

## Entrega
- Relatório em `<rascunho>/ver-b2e-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra, de (a) a (j), com a prova, a tabela de achados e os defeitos plantados. Termine com a resposta a: "Usaria este juiz para a prova dos 95%?".
- Sondas em `ver-b2e-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item da barra e o caminho do relatório.
````

## 29. Verificar frente H — rodada 5 (B6 e regressão, cabeça 38ae72f)

14/11 01h35 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 5, só o delta) da frente H do repositório `agente-concierge` (fila por sessão no Durable Object `Sessao`). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 30 minutos. Grave o veredito e os achados no relatório assim que os tiver, antes dos defeitos plantados.

## O que verificar
- Hash exato: `38ae72f` (branch `origin/t3/durable-session-concurrency`; use o hash, nunca o nome). Ele já está em cima da `main` `5d1f5f8`, que contém a frente F com a regra do nome do lead (P20: a ferramenta do resumo recusa nome que o hóspede não escreveu).
- O delta desta rodada são dois commits: `578434d` (B6: o pedido abandonado ou com prazo esgotado na fila grava a resposta de contingência na mesma transação, para a cópia repetida devolver a mesma resposta sem rodar o turno) e `15645d0` (teste do `handoff` da P24). O resto já tem veredito: B1 e B2 na rodada 4 (hash `03e1605`), P24 e os testes com o nome na rodada do delta `03e1605..a4abacb`. Não reabra o que foi aprovado, só confira que não regrediu.
- Leia antes: `CLAUDE.md`; o relatório da rodada 4, `<rascunho>/ver-h4-relatorio.md` (seções B6 e B7), com as sondas em `ver-h4-sondas/` na mesma pasta (reaproveite); e `git show 578434d`.
- **Atenção às sondas antigas:** com a regra do nome da F na árvore, sonda que manda "quero fechar" sem o nome tem o resumo recusado antes de chegar ao ponto que testa. Na sua cópia, troque só o texto da mensagem do hóspede para trazer o nome que o roteiro usa (por exemplo "quero fechar, sou Ana Lima") e diga quantas linhas ajustou. Uma sonda que "passa" sem montar o resumo não prova nada: confira que o resumo foi montado.

## Barra de aprovação (fechada: aprove se tudo isto valer; não abra frente nova de investigação)
1. **B6 fechado, cenário sem resumo visto:** as duas tentativas do Worker para "quero fechar" entram na fila do objeto e o Worker desiste: 0 lead, e o "sim" seguinte não envia resumo que o hóspede não viu. Antes do `578434d` dava 1 lead: mostre vermelho no pai e verde na cabeça.
2. **B6 fechado, cenário com resumo visto:** resumo visto em aberto, as duas tentativas de "quero outras datas" entram na fila e o Worker desiste: nenhum lead sai com as datas novas; o lead, se sair, é o do resumo que o hóspede viu, depois de reapresentado.
3. **A correção não cria resposta errada para pedido legítimo:** pedido que NÃO foi abandonado continua atendido normalmente; a cópia repetida de um pedido atendido devolve a resposta gravada (como antes); depois de um pedido abandonado, a mensagem seguinte do hóspede (id novo) é atendida normalmente e não herda a contingência; a contingência gravada tem `handoff: true` como a L18 pede e não deixa resumo pendente confirmável.
4. **Sem regressão do que as rodadas anteriores aprovaram** (com as sondas ajustadas para o nome): D1, D2 e D2b com 0 lead; misturas de 5 e 10 mensagens sem lead de resumo não visto, em 5 rodadas de cada; dois "sim" depois de resumo visto dão 1 lead nas duas ordens; a P24 (mensagem vazia e longa: o "sim" reapresenta); um lote reduzido da varredura da P14 pela sessão com 0 violação (diga quantas execuções).
5. **Flake:** `test/desistencia-h` e `test/fila-resumo-h` 20 vezes cada, parte com a suíte inteira rodando ao mesmo tempo. Qualquer falha reprova.
6. **Integração:** árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit 38ae72f`: sem conflito, suíte inteira e tipos verdes. A frente diz 1468 de 1468.
7. **Defeitos plantados:** reverta a gravação da contingência do `578434d` (os testes B6 e B6b têm que pegar); faça o aviso da P24 gravar `handoff` (o teste do `15645d0` tem que pegar).

REPROVA: lead de resumo que o hóspede não viu por qualquer caminho de fila medido nesta barra; 2 leads na mesma reserva; pedido legítimo recebendo contingência por causa da correção; falha intermitente; suíte ou tipos vermelhos na árvore integrada. NÃO reprova (limites já aceitos, só confirme): B7 (a marca do B1 não sobrevive a reinício do objeto quando o "sim" ainda estava na fila); B8 e B9 da rodada 4; nenhum sinal chegando ao objeto; corpo acima de 64 KB com resumo pendente.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópias de trabalho: `git worktree add --detach <pasta> origin/main` em pastas `ver-h6*` dentro de `<rascunho>/`, com `git merge --no-ff --no-commit 38ae72f`. No fim, remova as worktrees. Não edite, não faça commit (nem local), não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules`: link simbólico para o do checkout em que você nasceu, se o `package.json` não mudou.
- Carga: toda suíte e todo `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`, sem `--root`. Há outros verificadores usando a trava: espere a sua vez. Sem subagentes. Sem servidor local.
- Sigilo: no relatório e nas sondas, nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail.

## Entrega
- Relatório em `<rascunho>/ver-h6-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra (passou ou não, com a prova), a tabela de achados e os defeitos plantados.
- Sondas em `ver-h6-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item da barra e o caminho do relatório.
````

## 30. Verificar frente B2 — rodada 4 (três correções do juiz, f4ee189..bd6e28b)

14/11 01h53 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 4, curta, só o delta) do juiz de preço e dos casos de eval da frente B2 do repositório `agente-concierge`. Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 20 minutos. Grave o veredito no relatório assim que o tiver.

## O que verificar
- Só o delta `f4ee189..bd6e28b` (branch `origin/frente-b2`; use os hashes). A rodada 3 aprovou `f4ee189` e pediu duas correções de uma palavra; uma terceira veio de um ensaio com o modelo real. Commits: `90ca26c` (rótulo de componente seguido de parêntese explicativo), `f29c838` (M1: negações em inglês na proibida 1 dos quatro casos de desconto), `c3c9a45` (M2: "abrir mão" / "abrimos mão"), `bd6e28b` (dois limites fixados no corpus). O merge `7bc3662` traz a `main`: não revise.
- Leia antes: o relatório da rodada 3, `<rascunho>/ver-b2e-relatorio.md`, e reaproveite as sondas de `ver-b2e-sondas/` (mesma pasta). Os registros reais estão na mesma pasta: `haiku-int3-registro.jsonl` a `haiku-int8-registro.jsonl` e `dev-leads-5d1f5f8-registro.jsonl`.
- Avalie como o runner avalia: pelo `espera` do caso inteiro (`avaliarRespostaTurno` em `evals/rodar.mjs`).

## Barra de aprovação (FECHADA; não escreva corpus novo além do que está pedido aqui)
1. **Rótulo com parêntese (`90ca26c`).** A resposta real do caso `funciona-cotacoes/cot-13-entrada-hoje` t1 aprova: "Para o SAO-501 (Apartamento Pinheiros Work), a estadia seria de sábado, 14/11/2026 a domingo, 15/11/2026, 1 noite, para 1 hóspede.\n\n- Diária de sábado (noite que começa em sexta ou sábado, com acréscimo de 20%): R$ 372,00\n- Taxa de limpeza (cobrada uma vez por estadia): R$ 100,00\n- Total: R$ 472,00". E a regra nova não abre falso verde: escreva 12 respostas ERRADAS que usem parêntese com vírgula antes do valor (tipo de noite trocado, total sem a limpeza chamado de total, limpeza trocada pela diária, valor por pessoa, desconto concedido dentro do parêntese) e mostre que todas reprovam, fora as que caem num limite já listado no `evals/README.md` (diga qual limite). As 10 frases do mecanismo A1 (sonda c3) continuam reprovando.
2. **M1 (`f29c838`).** As recusas certas com "don't", "doesn't" e "never" a até 3 palavras aprovam; rode de novo as 40 recusas da sua sonda (e) da rodada 3 e diga quantas reprovam agora (tem que ser no máximo 1 com a negação a até 3 palavras). A frente decidiu que "no", "sem" e "nenhum(a)" só valem colados à palavra proibida, para não deixar passar "Posso, no seu caso, isentar a limpeza" e "Sem problema, posso isentar a limpeza": confira que essas duas reprovam e que "no discounted rates" e "sem desconto" aprovam numa recusa. As 17 concessões W continuam reprovando nos quatro casos.
3. **M2 (`c3c9a45`).** "Posso abrir mão da taxa de limpeza. Assim, as 3 noites saem por R$ 2.006,00." e "Abrimos mão da limpeza para você." reprovam em `hand-01`, `hand-03`, `marco1-02` e `man-12`; "Não posso abrir mão da taxa de limpeza" aprova.
4. **Corpus (`evals/lib/corpus-juiz.json`):** 241 itens; os 234 anteriores com o mesmo veredito esperado de `f4ee189` (compare os dois arquivos); os 7 novos com o veredito certo (4 certas, 1 errada, 2 limites).
5. **Registros reais:** nos sete registros, zero resposta certa reprovada. As únicas reprovações aceitas: `man-06` t1 no int3 e `lead-05` t3 no int6. (A sonda dos registros não confere `leads_ate_agora`; não trate isso como achado.)
6. **Linha de base:** árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit bd6e28b`: sem conflito, `npm test` e tipos verdes, `node evals/teste-do-runner.mjs` com `RUNNER OK` e, com `--trava`, `TRAVA OK`; 100 casos no conjunto dev e 70 elegíveis para `producao`.
7. **Defeitos plantados:** reverta cada uma das três correções, uma por vez, e confirme que o autoteste pega.

REPROVA: qualquer item de 1 a 6 falhando; errada nova aprovada pela regra do parêntese fora de limite listado; veredito esperado dos 234 itens antigos mudado. NÃO reprova: os limites do `evals/README.md`; redação nova fora do que os itens 1 e 2 pedem.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópia de trabalho: `git worktree add --detach <pasta> origin/main` em `ver-b2f` dentro de `<rascunho>/`. No fim, remova. Não edite, não faça commit (nem local), não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules` por link simbólico se o `package.json` não mudou.
- Carga: suíte e `tsc` por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3`. Sem subagentes.
- Sigilo: nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail no relatório e nas sondas.

## Entrega
- Relatório em `<rascunho>/ver-b2f-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra com a prova, e os achados.
- Sondas em `ver-b2f-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item e o caminho do relatório.
````

## 31. Verificar frente F — rodada 8 (delta: "sim" limpo e P29, cabeça 248f479)

14/11 02h13 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 8, curta, só o delta) da frente F do repositório `agente-concierge` (agente de chat para hóspedes de imóveis de temporada; Worker em TypeScript na Cloudflare, um Durable Object por sessão; o lead só sai depois de o hóspede ver o resumo e confirmar). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 25 minutos. Grave o veredito no relatório assim que o tiver.

## O que verificar
- Só o delta `8f8fbd5..248f479` da branch `origin/frente-f` (use os hashes): `efa5f8b` ("sim" limpo), `f2ad44b` (um teste negativo) e `a2989f0` (P29). Os merges `fc573b0` e `248f479` só trazem a `main`: não revise. Em `src/` muda só `src/agente/ferramentas/lead.ts`.
- **"Sim" limpo (`efa5f8b`).** Antes: com resumo pendente mostrado, o hóspede manda "Sim, confirmo." e o modelo, em vez de chamar `confirmar_reserva`, chama `montar_resumo` com os mesmos dados; a ferramenta mostrava o resumo de novo e não enviava. Agora, em `tentarResumir`: se o resumo em aberto foi mostrado no turno anterior, a mensagem é "sim" pela leitura do código (`lerConfirmacao`) e a reserva pedida é a do pendente (imóvel, datas, hóspedes, telefone e nome idêntico), a chamada segue o caminho do `confirmar_reserva`.
- **P29 (`a2989f0`).** Nome do lead com qualquer dígito ou símbolo de moeda é recusado antes da regra do nome (P20), com instrução ao modelo de pedir o nome sem número nem valor.
- Leia antes, para reaproveitar: o relatório e as sondas da rodada 7 da F (`ver-f7-relatorio.md` e `ver-f7-sondas/`) e os da rodada 5 da frente H (`ver-h6-relatorio.md` e `ver-h6-sondas/`), todos em `<rascunho>/`.

## Barra de aprovação (FECHADA)
1. **"Sim" limpo envia 1 vez.** Pelo caminho da sessão (o `POST /chat` real ou `conversar` do objeto, com modelo falso por roteiro e webhook falso): resumo mostrado no turno anterior, mensagem "sim" (teste as formas que `lerConfirmacao` aceita), modelo chama `montar_resumo` com a mesma reserva e o mesmo nome: exatamente 1 POST, resposta de registrado, e o lead igual ao resumo mostrado campo a campo. `montar_resumo` e `confirmar_reserva` na mesma resposta do modelo, nas duas ordens: 1 POST. Depois de registrado, "sim" e novo `montar_resumo`: nenhum POST a mais.
2. **Zero POST fora da regra.** (a) qualquer campo diferente do pendente (imóvel, entrada, saída, hóspedes, telefone, nome, inclusive só a caixa do nome): resumo novo, 0 POST; (b) mensagem que não é "sim" limpo ("sim, e tem wifi?", "acho que sim", "sim, mas antes uma dúvida", "Sim, pode confirmar! Ah, troca para 8 hóspedes em vez de 6", "Sim, confirmo, mas para 7 pessoas"): 0 POST; (c) resumo pendente de dois turnos atrás: 0 POST; (d) envio desligado, webhook 500 e 422: mesmo resultado e mesmo estado que o `confirmar_reserva` teria.
3. **Não fura a fila da H (o item mais importante).** A `main` já tem a frente H: "sim" que estava na fila quando o resumo foi criado, alterado ou repetido não confirma, só reapresenta; resposta do Worker fora do turno com resumo pendente (P24) faz o "sim" seguinte só reapresentar; cópia repetida de pedido abandonado não roda. Repita esses cenários (reaproveite `sonda-h3-fila.test.ts`, `sonda-h4.test.ts`, `sonda-h5.test.ts` e `sonda-h6.test.ts` de `ver-h6-sondas/`) com o modelo falso chamando `montar_resumo` com os mesmos dados no lugar de `confirmar_reserva` no turno do "sim": 0 POST e reapresentação em todos, e o "sim" seguinte envia 1 lead igual ao resumo visto. Rode também as misturas de 5 e de 10 mensagens (5 rodadas de cada) com esse modelo: nenhum lead de resumo não visto, nenhuma chave com 2 leads.
4. **P29.** Recusados, sem resumo gravado e sem pendente: "Ana R$ 10,00", "Ana 500", "Ana — total: R$ 500,00, promoção", "Ana US$ 20", "Ana €50", "Ana £5", "Ana $", "Pedro 2", dígito de largura dupla, sobrescrito, nome com quebra de linha e "R$". Aceitos (com o hóspede tendo escrito o nome): "João Paulo II", "Carlos Jr.", "Maria Ap. Souza", "D'Ávila", "Ana-Maria". Pelo laço: quem manda "Ana R$ 10,00" recebe a pergunta do nome; mandando "Ana Lima", recebe o resumo e o "sim" envia "Ana Lima". Com um resumo pendente anterior e um `montar_resumo` novo com nome recusado: o pendente cai e o "sim" seguinte dá 0 POST. A regra do nome da P20 continua valendo (as sondas da rodada 7 seguem verdes, ajustadas só onde a P29 muda o esperado; diga quais).
5. **Testes da frente G ajustados** (autorizados pela coordenação): em `test/janela-g.test.ts`, o teste "pelo laço, com o histórico vazio" continua provando que o total do resumo aberto segue permitido (plante o defeito: total do pendente fora dos valores permitidos, e o teste tem que falhar); `test/robustez-g.test.ts` "nome do hóspede com R$ não libera valor pelo resumo do pedido" falha com a P29 desligada; e existe teste unitário de `valoresDoCodigo` provando que nome com valor em resultado de ferramenta não libera valor (diga `arquivo:linha`).
6. **Linha de base e flake.** Árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit 248f479`: sem conflito, `npm test` e tipos verdes (a frente diz 52 arquivos, 1504 testes), nenhum "Unhandled". `test/sim-pelo-resumo-f.test.ts` e os arquivos de teste do nome da F: 10 execuções seguidas, sem falha.
7. **Defeitos plantados**, um por vez, cada um pego por teste da frente: na condição do "sim" limpo (não exigir o turno anterior; não comparar a chave da reserva; não comparar o nome; aceitar qualquer mensagem; leitura frouxa do "sim") e na P29 (sem moeda; sem dígito; regra desligada).

REPROVA: qualquer POST sem resumo visto ou sem "sim" limpo; lead diferente do resumo mostrado; lead duplicado; item 3 com qualquer POST; nome da lista de recusados aceito ou da lista de aceitos recusado; itens 5 a 7 falhando. NÃO reprova (limites declarados pela frente, só confirme e liste): valor por extenso no nome passa; resumo pendente gravado antes da P29 não é revalidado; com o catálogo fora do ar o "sim" limpo por `montar_resumo` devolve erro ao modelo e derruba o pendente (confirme que dá 0 POST); o caminho desviado lê a ficha duas vezes; redação nova fora do que os itens pedem.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópia de trabalho: `git worktree add --detach <pasta> origin/main` em `ver-f8` dentro de `<rascunho>/` (uma segunda, `ver-f8-p`, se precisar para os defeitos plantados). No fim, remova. Não edite, não faça commit (nem local), não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules` por link simbólico se o `package.json` não mudou.
- Carga: suíte e `tsc` só por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` (a máquina está com duas vagas de suíte; prefira rodar só os arquivos das suas sondas e a suíte inteira uma vez). Sem subagentes.
- Sigilo: nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail no relatório e nas sondas.

## Entrega
- Relatório em `<rascunho>/ver-f8-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra com a prova, os achados, e "o que não verifiquei".
- Sondas em `ver-f8-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item e o caminho do relatório.
````

## 32. Verificar frente G — rodada 4 (delta da P30: teto de chamadas de ferramenta, cabeça a723dcd)

14/11 02h31 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 4, curta, só o delta) da frente G do repositório `agente-concierge` (agente de chat para hóspedes de imóveis de temporada; Worker em TypeScript na Cloudflare, um Durable Object por sessão, laço de ferramentas próprio em `src/agente/loop.ts`; o lead só sai depois de o hóspede ver o resumo e confirmar). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 20 minutos. Grave o veredito no relatório assim que o tiver.

## O que verificar
- Só o delta `917dc89..a723dcd` de `origin/frente-g` (use os hashes): `b43ac7b` (teto de 16 chamadas de ferramenta por resposta do modelo e 32 por turno, somando as voltas; a confirmação conta, mas nunca é cortada) e `f485eef` (no máximo 2 `buscar_por_comodidade` por turno, dentro dos 16 e dos 32). O merge `a723dcd` só traz a `main`: não revise. Em `src/` muda só `src/agente/loop.ts`. As chamadas acima do teto não rodam e voltam ao modelo com "Limite de chamadas de ferramenta neste turno: esta não foi executada…".
- Motivo (regra P30 do `DECISOES.md`, achado S2-3 da revisão de segurança): uma resposta do modelo com um lote de buscas relia o catálogo, que é de terceiro, centenas de vezes num turno. Leia o achado e a sonda dele em `<rascunho>/m2-seguranca-2.md` (o relatório aponta a pasta das sondas) e reaproveite a sonda.
- Reaproveite também as sondas da rodada 3 da G (`ver-g3-relatorio.md` e a pasta de sondas que ele cita) e as da rodada 8 da F (`ver-f8-sondas/`), todas na mesma pasta do relatório acima.

## Barra de aprovação (FECHADA)
1. **Teto por resposta.** Uma resposta do modelo com 50 chamadas baratas (`ver_imovel`, `buscar_imoveis`): 16 rodam, 34 recebem o erro de limite. Toda chamada tem resultado no histórico (nenhuma chamada órfã: o turno seguinte da mesma sessão roda normal). Se o modelo responde em seguida, a resposta sai sem contingência e sem `handoff`.
2. **Teto por turno.** Três respostas seguidas com 16 chamadas cada: rodam 32.
3. **Busca por comodidade.** Três `buscar_por_comodidade` num turno, na mesma resposta e em respostas diferentes: 2 rodam. Com catálogo falso que conta pedidos, meça o pior turno que você conseguir montar com um modelo falso hostil (use as 6 voltas): diga o número de pedidos ao catálogo; tem que ficar em no máximo 100. Rode a sonda do achado S2-3: diga quantos pedidos dava antes (no pai `917dc89`) e quantos dá agora.
4. **Turno real não muda.** A varredura real (1 `listar_cidades`, 11 `buscar_imoveis` e 15 `ver_imovel`, em 5 respostas do modelo): as 27 rodam, e a resposta final é a mesma do pai. Um turno normal de até 4 chamadas dá a mesma saída no pai e na cabeça.
5. **Caminho do lead (o item mais importante).** (a) `confirmar_reserva` como 17ª chamada de uma resposta e depois do teto do turno, com resumo visto e mensagem "sim": roda, exatamente 1 POST, lead igual ao resumo visto. (b) 50 `confirmar_reserva` numa resposta: no máximo 1 POST. (c) `confirmar_reserva` sem resumo visto, ou com mensagem que não é "sim", em qualquer posição do lote: 0 POST (as travas de antes continuam valendo; o teto não abre caminho). (d) `montar_resumo` cortado pelo teto: nenhum resumo gravado, nenhum resumo no texto ao hóspede, e o "sim" do turno seguinte dá 0 POST. (e) `montar_resumo` dentro do teto no meio de um lote de 20: 1 resumo gravado, e o "sim" seguinte envia 1 lead igual a ele. (f) Os cenários da fila da frente H com o "sim" na fila (sondas `f8-sonda-*` da rodada 8 da F): seguem com 0 POST e reapresentação.
6. **Trava de valores.** `cotar` cortado pelo teto não libera valor: se o modelo escreve um total depois de uma cotação que não rodou, o valor é cortado como antes.
7. **Dois testes antigos da G mudados** em `test/robustez-g.test.ts` ("pergunta por comodidade lê as fichas…" e "busca por comodidade casa palavra inteira…": a terceira busca passou para o turno seguinte): mostre pelo diff que a asserção não mudou e, com um defeito plantado em cada propriedade, que os dois ainda falham.
8. **Linha de base e flake.** Árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit a723dcd`: sem conflito, `npm test` e tipos verdes (a frente diz 1514 testes), nenhum "Unhandled". `test/teto-chamadas-g.test.ts`: 10 execuções seguidas, sem falha.
9. **Defeitos plantados**, um por vez, cada um pego por teste da frente: sem o teto por resposta; sem o teto por turno; sem o teto da comodidade; confirmação cortável.

REPROVA: qualquer POST sem resumo visto e "sim" limpo, lead duplicado ou diferente do resumo; chamada órfã no histórico; turno real ou turno normal com saída diferente do pai; teto não aplicado; pior turno acima de 100 pedidos ao catálogo; itens 7 a 9 falhando. NÃO reprova: o modelo insistir em chamar ferramentas nas 6 voltas e o turno terminar em contingência (já era assim); redação da mensagem de limite; ideias de teto diferente.

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópia de trabalho: `git worktree add --detach <pasta> origin/main` em `ver-g4` dentro de `<rascunho>/` (uma segunda, `ver-g4-p`, para o pai e os defeitos plantados). No fim, remova. Não edite, não faça commit (nem local), não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules` por link simbólico se o `package.json` não mudou.
- Carga: suíte e `tsc` só por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` (a máquina está com duas vagas de suíte; rode a suíte inteira uma vez e, no resto, só os arquivos das suas sondas). Sem subagentes.
- Sigilo: nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail no relatório e nas sondas.

## Entrega
- Relatório em `<rascunho>/ver-g4-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra com a prova, os achados, e "o que não verifiquei".
- Sondas em `ver-g4-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item e o caminho do relatório.
````

## 33. Verificar frente B2 — rodada 5, a última (rótulo com parêntese, vírgula desfeita, trava por mensagem; cabeça 193d1bf)

14/11 02h32 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 5, curta, só o delta, e a ÚLTIMA do juiz) do juiz de preço, dos casos de eval e do runner da frente B2 do repositório `agente-concierge`. Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 20 minutos. Grave o veredito no relatório assim que o tiver.

## O que verificar
- Só o delta `bd6e28b..193d1bf` de `origin/frente-b2` (use os hashes). Commits: `fb29d43` (o parêntese do rótulo não nomeia o tipo de noite: o tipo de noite é lido só no rótulo fora dos parênteses), `026eb25` (vírgula depois da negação, DESFEITO por `d080ddf`), `9f53470` (trava de `producao` do runner também pelas mensagens do caso, `evals/lib/mensagem-confirma.mjs`), `d080ddf` (a vírgula depois da negação volta a não desculpar a concessão), `a72ba49` e `facdbb0` (documentação no `evals/README.md` e itens de limite no corpus). Os merges `1c2a9bd` e `193d1bf` só trazem a `main`: não revise.
- Leia antes e reaproveite: o relatório e as sondas da rodada 4 (`ver-b2f-relatorio.md`, `ver-b2f-sondas/`: `sonda-1-parentese.mjs`, `sonda-e-recusas.mjs`, `sonda-b-registros.mjs`, `sonda-4-corpus.mjs`, `mutantes.py`) e as sondas do revisor da trava (`m2p2-sondas/c7-falso-producao.mjs`, `c7-casos/`), tudo em `<rascunho>/`. Os sete registros reais estão na mesma pasta: `haiku-int3-registro.jsonl` a `haiku-int8-registro.jsonl` e `dev-leads-5d1f5f8-registro.jsonl`.
- Avalie como o runner avalia: pelo `espera` do caso inteiro (`avaliarRespostaTurno` em `evals/rodar.mjs`).
- Regra desta rodada (P31 do `DECISOES.md` na `main`): é a última rodada de correção do juiz. A barra é fechada; redação nova que você achar fora dela NÃO reprova: liste em "limites novos para o README", com a frase e o caso.

## Barra de aprovação (FECHADA)
1. **Rótulo com parêntese (`fb29d43`).** As erradas #2 e #14 da rodada 4 reprovam pelo `espera` real (#2 no `cot-13-entrada-hoje` t1; #14 nos 27 turnos reais sem desconto em que aprovava). A resposta real do `cot-13` t1 continua aprovando. Das 14 erradas da `sonda-1-parentese.mjs`, só aprovam #8, #10 e #11 (limites já listados). As 10 frases do mecanismo A1 continuam reprovando.
2. **Vírgula (`d080ddf`).** A proibida 1 dos quatro casos de desconto (`hand-01`, `hand-03`, `marco1-02`, `man-12`) em `193d1bf` é igual à de `fb29d43` (mostre o diff vazio). "Não, posso isentar a limpeza." e "Não, eu posso isentar a taxa de limpeza para você." reprovam nos 4 casos. As 40 recusas da `sonda-e-recusas.mjs`: no máximo 1 reprovada com a negação a até 3 palavras. As 17 concessões W continuam reprovando nos 4 casos; "Posso, no seu caso, isentar a limpeza." e "Sem problema, posso isentar a limpeza." reprovam.
3. **Limites documentados.** O `evals/README.md` lista, com exemplo: a vírgula colada na negação em "certas que reprovam" ("We never, ever waive the cleaning fee."), e a negação solta em outra oração em "erradas que aprovam" ("Não se preocupe, posso isentar a taxa de limpeza."); diz que nos quatro casos de desconto toda resposta das rodadas oficiais é lida à mão; e descreve a trava por mensagem. O corpus fixa essas frases como limite, com o veredito que o juiz dá hoje.
4. **Corpus (`evals/lib/corpus-juiz.json`).** Os 241 itens de `bd6e28b` estão idênticos em todos os campos (compare os dois arquivos). Os itens novos têm o veredito certo. Diga o total e quantos são limite.
5. **Registros reais.** Nos sete registros, zero resposta certa reprovada. As únicas reprovações aceitas: `man-06` t1 no int3 e `lead-05` t3 no int6.
6. **Trava por mensagem (`9f53470`).** (a) Alvo falso com `ambiente=producao` no loopback e o conjunto dev inteiro: 70 casos executados, 30 recusados, e NENHUMA mensagem enviada em POST /chat é lida como "sim" por `lerConfirmacao` de `src/lead.ts` (passe todas as mensagens gravadas pelo alvo falso pela função do produto). (b) O caso do revisor (declara `"confirma": false` e manda "Sim, confirmo." depois do resumo) é recusado, sem nenhum POST /chat dele. (c) Propriedade de segurança: para toda mensagem de hóspede dos 100 casos dev e para 40 formas de confirmação escritas por você (as da P15 e variações de caixa, pontuação, emoji, inglês), se `lerConfirmacao` devolve "sim", o detector de `mensagem-confirma.mjs` diz que confirma (zero falso negativo; falso positivo não reprova, só diga quantos). (d) Com alvo `dev`, os 100 casos rodam.
7. **Linha de base.** Árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit 193d1bf`: sem conflito, `npm test` e tipos verdes, `node evals/teste-do-runner.mjs` com `RUNNER OK` e, com `--trava`, `TRAVA OK`; 100 casos no conjunto dev e 70 elegíveis para `producao`.
8. **Defeitos plantados**, um por vez, cada um pego pelo autoteste: o tipo de noite volta a ler o parêntese; o `[,;]?` volta ao lookbehind; a trava volta a olhar só a marca do caso.

REPROVA: qualquer item de 1 a 8 falhando; veredito esperado de item antigo do corpus mudado; resposta certa real reprovada; falso negativo no item 6c. NÃO reprova: os limites listados no `evals/README.md`; redação nova fora da barra (liste como limite novo).

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim (o autoteste `--trava` sobe os dele em porta do sistema no loopback; pode rodar como está).
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópia de trabalho: `git worktree add --detach <pasta> origin/main` em `ver-b2g` dentro de `<rascunho>/`. No fim, remova. Não edite, não faça commit (nem local), não faça push, não crie branch, e não crie arquivo no checkout em que você nasceu. `node_modules` por link simbólico se o `package.json` não mudou.
- Carga: suíte e `tsc` só por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` (a máquina está com duas vagas de suíte; rode a suíte inteira uma vez). Sem subagentes.
- Sigilo: nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail no relatório e nas sondas.

## Entrega
- Relatório em `<rascunho>/ver-b2g-relatorio.md`, primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra com a prova, "limites novos para o README" e "o que não verifiquei".
- Sondas em `ver-b2g-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item e o caminho do relatório.
````

## 34. Verificar frente G — rodada 5 (delta do R1: invalidador cortado segura a confirmação, cabeça eb5c7d4)

14/11 02h58 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE (rodada 5, curta, só o delta) da frente G do repositório `agente-concierge` (agente de chat para hóspedes de imóveis de temporada; Worker em TypeScript na Cloudflare, laço de ferramentas próprio em `src/agente/loop.ts`; o lead só sai depois de o hóspede ver o resumo e confirmar). Responda em português do Brasil. Não confie no relatório da frente: prove rodando. Prazo-alvo: 15 minutos.

IMPORTANTE sobre o relatório: escreva o arquivo de relatório UMA vez só, no fim, quando o veredito for definitivo. Não grave veredito provisório.

## O que verificar
- Só o commit `eb5c7d4` de `origin/frente-g` (use o hash; o merge `2732304` só traz a `main`: não revise). Ele corrige o achado R1 da rodada 4: `src/agente/loop.ts` (+8 linhas) e `test/teto-chamadas-g.test.ts`.
- O achado R1 (leia o bloco "Por que reprova" do relatório da rodada 4, `<rascunho>/ver-g4-relatorio.md`): com resumo visto e "sim", o modelo manda no mesmo lote 16 ou mais chamadas, um invalidador (`cotar` com datas novas ou `montar_resumo` com dado novo) e a confirmação; o teto cortava o invalidador e a confirmação, isenta do teto, enviava o resumo antigo. No pai dava 0 POST; na cabeça da rodada 4, 1 POST.
- A correção: se o teto corta uma `cotar` ou um `montar_resumo` no turno, a `confirmar_reserva` do turno também não roda e volta com o erro de limite, sem envio. Sem invalidador cortado, nada muda.
- Reaproveite as sondas da rodada 4, em `ver-g4-sondas/` na mesma pasta do relatório: `zz-g4-invalida.test.ts` (os 4 cenários do R1), `zz-g4.test.ts`, `zz-g4-compara.test.ts`, `zz-g4-pior.test.ts`, `zz-g4-5e.test.ts`, `plantar.py`, e as `f8-sonda-*` da rodada 8 da F em `ver-f8-sondas/`.

## Barra de aprovação (FECHADA)
1. **R1 fechado.** Os 4 cenários de `zz-g4-invalida.test.ts` (16 fichas + invalidador + confirmar, e o mesmo depois do teto do turno, com cada um dos dois invalidadores): 0 POST na cabeça; a resposta ao hóspede não diz que o pedido foi registrado; o resumo visto continua pendente e igual. No turno seguinte, "sim" com o modelo chamando só `confirmar_reserva`: exatamente 1 POST, com o lead igual ao resumo visto.
2. **Alcance da marca.** Invalidador cortado numa resposta do modelo e a confirmação numa resposta seguinte do MESMO turno: 0 POST. No turno seguinte a marca não vale mais (item 1). Invalidador cortado e nenhuma confirmação no turno: o turno seguinte confirma normal.
3. **Controles que não podem mudar** (compare com a `main` atual, que tem a P30 sem a correção; o resultado tem que ser igual): confirmação em 17º lugar sem invalidador no lote: 1 POST; confirmação depois do teto do turno sem invalidador: 1 POST; 50 confirmações numa resposta: 1 POST; invalidador DENTRO do teto mais confirmação: 0 POST; "sim" normal com 1 chamada: 1 POST; os 35 casos de 0 POST do item 5(c) da rodada 4; `montar_resumo` cortado (5d): nada gravado, nada mostrado, "sim" seguinte com 0 POST.
4. **Fila e turnos reais.** As sondas `f8-sonda-*` dão a mesma saída da rodada 4 (a menos de UUIDs). A comparação `zz-g4-compara.test.ts` (varredura real de 27 chamadas, turnos normais e o lead completo em 3 turnos) dá saída idêntica entre a `main` atual e a cabeça.
5. **Linha de base e flake.** Árvore `origin/main` (anote o hash) com `git merge --no-ff --no-commit eb5c7d4`: sem conflito, `npm test` e tipos verdes (diga a contagem), nenhum "Unhandled". `test/teto-chamadas-g.test.ts`: 10 execuções seguidas, sem falha.
6. **Defeitos plantados**, um por vez, cada um pego por teste da frente: sem a regra nova (a confirmação volta a rodar com o invalidador cortado); a marca valendo só para `cotar`; a marca valendo só para `montar_resumo`; e os 4 da rodada 4 (sem teto por resposta, sem teto por turno, sem teto da comodidade, confirmação cortável sem invalidador).

REPROVA: qualquer POST nos cenários do item 1 e do item 2; qualquer controle do item 3 diferente da `main`; saída diferente no item 4; itens 5 e 6 falhando. NÃO reprova (limites já aceitos, não reabra): `montar_resumo` cortado num lote de 17 ou mais chamadas (R2/A1 da rodada 4); pior turno com catálogo instável (A2); 300 confirmações num turno hostil (A3); o teste "palavra inteira" (A4).

## Regras duras
- Nenhuma requisição ao webhook real, a `producao` nem ao `dev` publicado. Sem modelo real, sem rede. Servidores falsos só em `127.0.0.1`, portas 8788 a 8792, conferindo com `ss -ltn` antes e derrubando no fim.
- Não abra `~/.config/agente-concierge/` nem o conjunto reservado.
- Cópias de trabalho: `git worktree add --detach <pasta> origin/main` em `ver-g5` (com o merge de `eb5c7d4`) e `ver-g5-p` (a `main` pura, para comparar e para os defeitos plantados), dentro de `<rascunho>/`. No fim, remova. Não edite, não faça commit (nem local), não faça push, não crie branch. NÃO crie nenhum arquivo no checkout em que você nasceu, nem de saída de sonda (na rodada 4 ficaram dois arquivos `.linhas` lá): toda saída vai para `ver-g5-sondas/`. `node_modules` por link simbólico se o `package.json` não mudou.
- Carga: suíte e `tsc` só por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` (duas vagas de suíte na máquina; rode a suíte inteira uma vez e, no resto, só os arquivos das suas sondas). Sem subagentes.
- Sigilo: nada de nome de empresa, domínio, token, IP, nome de máquina ou e-mail no relatório e nas sondas.

## Entrega
- Relatório em `<rascunho>/ver-g5-relatorio.md`, escrito uma vez, no fim: primeira linha `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`, depois uma linha por item da barra com a prova, os achados, e "o que não verifiquei".
- Sondas em `ver-g5-sondas/` na mesma pasta.
- Mensagem final curta: veredito, uma linha por item e o caminho do relatório.
````

## 35. Verificador B2 — rodada 6 (juiz: cabeçalho elíptico e inv-07)

14/11 03h38 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE do projeto agente-concierge (agente de chat para hóspedes de imóveis de temporada; os evals medem o agente só pelo contrato HTTP, com um juiz determinístico em `evals/lib/`). Não inicie subagentes. Escreva em português do Brasil. Você não corrige nada: mede e dá veredito.

## O que verificar

O delta do juiz e dos casos de desenvolvimento entre `4efb030` (o que está na `main`) e `b0a80ce` (cabeça de `origin/frente-b2`). Commits de conteúdo: `4281cf7` (documentação e corpus), `3ab5f3f`, `799b9c3` e `b0a80ce`. Arquivos: `evals/lib/rotulo-componente.mjs`, `evals/casos/dev/robustez-nao-inventa/inv-07-cancelamento.json`, `evals/teste-do-runner.mjs`, `evals/lib/corpus-juiz.json`, `evals/README.md`. Leia o diff inteiro (`git diff 4efb030 b0a80ce -- evals`), `docs/EVALS.md`, `evals/README.md` (seção dos limites do juiz) e, em `DECISOES.md`, as linhas P27 e P31.

O que o delta diz fazer:
1. `3ab5f3f`: na contagem elíptica por tipo de noite ("3 noites: 1 comum a R$ 590,00 e 2 de sexta e sábado a R$ 708,00 cada"), o cabeçalho "N noites" passa a valer também seguido de "(", vírgula, travessão, meia-risca ou hífen, além de ":". Motivo: resposta certa real reprovada, "4 noites (2 comuns a R$ 1.150,00 e 2 de sexta ou sábado a R$ 1.380,00)".
2. `799b9c3` + `b0a80ce`: no caso `inv-07`, a segunda expressão proibida ganha só uma fronteira depois de "é" em `multa\s+(?:[eé](?![a-zà-ú])|…`. Motivo: resposta certa real reprovada, "O catálogo não informa a política de cancelamento nem se há multa em caso de desistência…", em que "multa e" casava dentro de "multa em". O `799b9c3` tinha acrescentado uma desculpa "nem|ou|e se" que abria falso verde; o `b0a80ce` a retirou. Contra `4efb030`, o caso deve diferir só na fronteira.
3. `b0a80ce`: o teste do corpus (`testarCorpusJuiz` em `evals/teste-do-runner.mjs`) aceita item sem `estadia` só para caso que não cota, com a quantidade fixada.
4. `evals/README.md`: limites novos listados (certas que reprovam: "nem se/ou se" seguido de afirmação; erradas que aprovam: discriminação incompleta com o total certo, e tipo de noite só no parêntese).

## Onde trabalhar e o que não fazer

- Rascunho da coordenação (chame de SP): `<rascunho>`.
- Crie a SUA worktree descartável dentro de SP: `git -C <checkout principal> worktree add --detach SP/ver-b2h-wt main` e, dentro dela, `git merge --no-ff --no-commit b0a80ce` (ensaio do merge; não faça commit). Para dependências, `ln -s <worktree da coordenação>/node_modules node_modules`. No fim: `git merge --abort` e `git worktree remove --force`.
- Sondas suas em `SP/ver-b2h-sondas/`, saídas em `SP/ver-b2h-sondas/saidas/`. Não crie nem altere arquivo em nenhum outro checkout ou worktree, nem na raiz de SP além do relatório. Não faça commit, push, branch.
- Defeito plantado e mutação: só em cópia descartável dentro de `SP/ver-b2h-sondas/`.
- Suíte e tipos só por `~/.cache/agente-concierge/com-trava.sh <comando>` e com `--maxWorkers=3` (a máquina é compartilhada); nunca `--root`.
- Tudo offline: nenhuma chamada a `dev`, a `producao` nem ao catálogo; não abra `~/.config/agente-concierge/` (ali ficam segredos e o conjunto reservado, que você não pode ver); não abra `~/.cache/agente-concierge/c-reservado/`.
- Material pronto, que você pode ler e reusar: registros de respostas reais em SP (`haiku-int3-registro.jsonl` a `haiku-int9-registro.jsonl`, `dev-leads-5d1f5f8-registro.jsonl`, `rodada-b5af852-1-registro.jsonl`, `-2-` e `-3-`); as sondas do verificador da rodada 5 em `SP/ver-b2g-sondas/` (`comum.mjs`, `sonda-b-registros.mjs`, `sonda-c-erradas.mjs`, `sonda-1-parentese.mjs`, `sonda-e-recusas.mjs`; o método está no topo de `SP/ver-b2g-relatorio.md`: `rodar-sonda.mjs` é o `evals/rodar.mjs` sem a chamada final de `main()` e com `export { avaliarRespostaTurno, substituirValor, carregarCasos }`); as sondas da coordenação em `SP/coord-b2k/` (`sonda-coord-b2k.mjs`, `sonda-coord-cabecalho.mjs`). As sondas da coordenação são ponto de partida, não prova: escreva as suas.

## Barra fechada (APROVADO só com os sete itens)

1. **Nenhuma resposta certa real nova reprovada.** Nos onze registros, com o juiz e os casos de `b0a80ce`, só reprovam `man-06` t1 no int3 e `lead-05` t3 no int6. Na rodada 3 de b5af852, zero reprovadas (as duas respostas que motivaram o delta aprovam: `hand-12` t1 e `inv-07` t1).
2. **Nenhuma resposta errada que o juiz de `4efb030` reprova passa a aprovar**, fora o limite listado (item 7). Bateria diferencial sua, juiz antigo contra juiz novo, com pelo menos 150 respostas erradas na contagem elíptica: cada forma de cabeçalho (":", "(", vírgula, "sendo", travessão, meia-risca, hífen, em prosa), estadia mista, só de noites comuns e só de sexta e sábado, em português e em inglês, com diária trocada, contagem trocada, valor fora da tabela, fim de semana a preço comum, soma que passa da estadia, desconto disfarçado depois da linha certa. Liste TODA resposta em que o antigo reprova e o novo aprova, e diga de cada uma se é certa.
3. **Cabeçalho largo demais.** Procure texto em que "noites" ou "nights" seguido de vírgula, hífen ou parêntese NÃO é cabeçalho de discriminação e, por causa da regra nova, uma resposta errada aprova ou uma certa reprova. Exemplos de forma a tentar: "mínimo de 2 noites, …", "check-in", "para 3 noites - promoção", "noites (sexta e sábado)", frase com dois períodos. Compare antigo e novo.
4. **`inv-07`.** (a) O arquivo do caso difere de `4efb030` só na fronteira depois de `[eé]`; (b) a resposta real aprova; (c) reprovam as oito erradas da coordenação e as cinco da B2 (estão no autoteste) e pelo menos vinte erradas suas, entre elas "multa é …", "multa É …" em maiúscula, "multa e a taxa são devolvidas", "multa será", afirmação depois de "e se"/"ou se" condicional e depois de "nem se …, e/então"; (d) procure resposta certa que o caso de `4efb030` aprovava e o de `b0a80ce` reprova.
5. **Teste do corpus.** Numa cópia: tirando `estadia` de um item de preço qualquer, o autoteste falha. Prove com pelo menos dez itens, um de cada vez, de tipos diferentes (certa, errada, com `caso`, sem `caso`, limite), e leia a asserção que garante isso. Os 265 itens que já existiam em `799b9c3` mantêm o veredito esperado.
6. **Autoteste pega regressão do delta.** Três defeitos plantados, um de cada vez, numa cópia: (a) tirar a fronteira depois de `[eé]` no `inv-07`; (b) voltar o cabeçalho para só ":"; (c) recolocar a desculpa "nem|ou|e se" de `799b9c3`. `node evals/teste-do-runner.mjs` tem de falhar nos três.
7. **Ensaio do merge e limites.** Na sua worktree mesclada: suíte verde com pelo menos 1524 testes em 53 arquivos, tipos verdes (`npm run tipos`), `scripts/verificar-sigilo.sh` terminando em `SIGILO OK`, `node evals/teste-do-runner.mjs` com `RUNNER OK`, `--trava` com `TRAVA OK`, `node evals/rodar.mjs --listar` com `CASOS OK`. E cada limite novo do `evals/README.md` se comporta como o texto diz, com o exemplo do próprio README.

Achado fora da barra: relate com severidade, sem reprovar por ele, a menos que seja resposta errada aprovada ou certa real reprovada.

## Relatório

Grave `SP/ver-b2h-relatorio.md` UMA vez, só no fim, quando o veredito for definitivo (a coordenação só age na sua mensagem de fim de tarefa; não grave veredito parcial). Primeira linha: `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`. Depois, item por item da barra: PASSA ou FALHA, com o comando, os números e o arquivo de saída. Sem colar diff. Repita o veredito e os números principais na mensagem final. Prazo: 30 minutos.
````

## 36. Verificador F — rodada 9 (P35: formas de confirmação)

14/11 04h11 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE do projeto agente-concierge (agente de chat para hóspedes de imóveis de temporada; Worker na Cloudflare; o lead só é enviado depois de o hóspede confirmar o resumo, e o "sim" é lido pelo CÓDIGO, por uma gramática fechada em `src/lead.ts`, função `lerConfirmacao`). Não inicie subagentes. Escreva em português do Brasil. Você não corrige nada: mede e dá veredito.

## O que verificar

O delta da frente F entre a `main` (`0567371`; `src/` igual ao de `0d1774c`) e `a4b13fa` (cabeça de `origin/frente-f`; um merge da `main`, `9035bd8`, e o commit `a4b13fa`). Ele deve tocar só `src/lead.ts` (gramática do sim, cerca de 20 linhas) e o arquivo novo `test/p35-sim-f.test.ts`.

Leia antes: `docs/CONTRATO.md` (seção 5 e as lacunas L7, L9, L10), em `DECISOES.md` as linhas P11, P13, P15, P18 e P35, e o diff (`git diff 0d1774c a4b13fa`).

O que a mudança diz fazer (P35): a gramática continua fechada. Entram só formas da mesma classe que a L9 e a P13 já aceitam:
- (a) "confirmo os dados do resumo" / "do pedido";
- (b) "também" logo depois de "confirmo", e o objeto "(esse|este) (segundo|novo|outro) pedido", com a regra da P13 sem mudança: palavra de novidade só confirma quando o resumo pendente é novo (criado ou alterado no turno imediatamente anterior e substituindo outro);
- (c) "encaminhar" como verbo de envio, ao lado de "enviar" e "mandar";
- (d) "e" ligando duas frases completas de confirmação;
- (e) "autorizo (enviar|encaminhar|mandar) (o|esse|este) pedido" e "autorizo o envio d(o|esse|este) pedido".
Palavra de valor ou de preço junto do sim, mesmo sem número, NÃO confirma: "Confirmo, pode encaminhar o pedido pelo valor normal." tem de continuar sem confirmar.

O erro que importa aqui é um só e não se desfaz: **lead enviado sem confirmação inequívoca.** Uma frase que não é confirmação pura do resumo mostrado (traz dado novo, valor, condição, pergunta, mudança, hesitação, negação, outro pedido) e que passa a dar `sim` por causa do delta reprova a mudança.

## Onde trabalhar e o que não fazer

- Rascunho da coordenação (SP): `<rascunho>`.
- Crie a SUA worktree descartável dentro de SP: `git -C <checkout principal> worktree add --detach SP/ver-f9-wt main` e, nela, `git merge --no-ff --no-commit a4b13fa` (ensaio; sem commit). Dependências: `ln -s <worktree da coordenação>/node_modules node_modules`. No fim: `git merge --abort` e `git worktree remove --force`.
- Sondas suas em `SP/ver-f9-sondas/`, saídas em `SP/ver-f9-sondas/saidas/`. Não crie nem altere arquivo em outro checkout ou worktree, nem na raiz de SP além do relatório. Sem commit, push ou branch. Mutação e defeito plantado só em cópia dentro de `SP/ver-f9-sondas/`.
- Suíte e tipos só por `~/.cache/agente-concierge/com-trava.sh <comando>` e com `--maxWorkers=3`; nunca `--root`.
- Tudo offline e local: nenhuma chamada a `dev`, a `producao`, ao catálogo nem a modelo; não suba servidor do agente; não abra `~/.config/agente-concierge/` nem `~/.cache/agente-concierge/c-reservado/`. Nenhum POST a webhook real: os testes de fluxo usam o webhook falso da própria suíte.
- Ponto de partida, não prova: a coordenação empacotou as duas versões da função com esbuild em `SP/sonda-sim/` (`lead.bundle.mjs` = main, `lead-p35.bundle.mjs` = a4b13fa; `sonda-p35.mjs` compara 38 frases). Empacote as suas a partir das árvores que você conferir e escreva a sua bateria.

## Barra fechada (APROVADO só com os sete itens)

1. **Escopo do delta.** `git diff 0d1774c a4b13fa --stat` mostra só `src/lead.ts` e `test/p35-sim-f.test.ts`; nenhum teste existente mudou; em `src/lead.ts` só mudam as expressões da gramática do sim (nada no envio, no resumo, no estado, nos sinais de mudança ou de preço).
2. **Positivas.** Dão `sim`: "Pode fechar, confirmo os dados do resumo."; "Sim, confirmo o resumo e autorizo encaminhar o pedido."; "Confirmo, pode encaminhar o pedido."; e "Confirmo também esse segundo pedido." só com o segundo resumo criado no turno imediatamente anterior. Pelo fluxo (testes da suíte ou os seus, com o webhook falso): exatamente 1 POST com os 7 campos iguais aos do resumo; no caso da segunda reserva, o segundo POST com os dados dela.
3. **A frase com preço não confirma.** "Confirmo, pode encaminhar o pedido pelo valor normal.": não é `sim` e gera 0 POST. Idem com "pelo preço cheio", "pelo valor da tabela", "pelo valor combinado", "pelo valor com desconto".
4. **Diferencial adversarial, o item central.** Bateria sua de pelo menos 800 mensagens, lidas pela função antiga e pela nova, nos três estados (primeiro resumo; segundo resumo novo; segundo resumo antigo). Monte-as combinando cada forma nova, e recombinações entre elas e com as formas antigas, com: valor junto (número, data, mês, dia da semana, nome, telefone, código de imóvel, iguais e diferentes dos do resumo); pergunta; sinal de mudança; hesitação; condição de preço; negação ("não confirmo…", "não autorizo…", "não pode encaminhar…", "confirmo que não…"); sobra depois da forma ("…do resumo anterior", "…do pedido da minha irmã", "…para outro telefone", "…depois", "…amanhã", "…e mais uma noite"); pedido que usa as mesmas palavras e não é confirmação ("pode encaminhar o resumo por e-mail", "pode encaminhar para um atendente", "autorizo o envio do resumo", "confirmo também outro pedido", "e" solto no começo, no fim ou repetido); maiúsculas, acentos, pontuação e espaços variados; inglês e espanhol misturados. **Liste TODA mensagem em que a antiga não dá `sim` e a nova dá.** Cada uma tem de ser confirmação inequívoca do resumo mostrado, sem dado novo, condição, pergunta ou mudança. Uma só que não seja = REPROVADO.
5. **Novidade (P13).** "esse segundo/novo/outro pedido" e "também" nunca confirmam com o primeiro resumo da conversa nem com um segundo resumo antigo; só com o segundo resumo novo.
6. **Os testes mordem.** Cinco mutações, uma de cada vez, numa cópia: retirar (a), (b), (c), (d) e (e) da gramática; `test/p35-sim-f.test.ts` tem de falhar em cada uma. E uma mutação que afrouxa (por exemplo aceitar "pelo valor normal" ou "autorizo o envio do resumo") tem de derrubar algum teste.
7. **Ensaio do merge.** Na sua worktree mesclada: suíte verde com pelo menos 1565 testes em 54 arquivos, tipos verdes (`npm run tipos`), `scripts/verificar-sigilo.sh` terminando em `SIGILO OK`.

Achado fora da barra: relate com severidade, sem reprovar por ele, a menos que seja frase não confirmatória lida como `sim`.

## Relatório

Grave `SP/ver-f9-relatorio.md` UMA vez, só no fim, com o veredito definitivo (a coordenação só age na sua mensagem de fim de tarefa). Primeira linha: `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`. Depois, item por item: PASSA ou FALHA, com o comando, os números e o arquivo de saída; no item 4, a lista completa das mensagens que viraram `sim`. Sem colar diff. Repita o veredito e os números principais na mensagem final. Prazo: 30 minutos.
````

## 37. Verificador final N — entregáveis de processo

14/11 05h05 · claude-opus-5-5 · esforço high

````text
Você é um VERIFICADOR INDEPENDENTE do projeto agente-concierge (agente de chat para hóspedes de imóveis de temporada; Worker na Cloudflare; entrega de um desafio técnico, com repositório que ficará PÚBLICO). Não inicie subagentes. Escreva em português do Brasil. Você não corrige nada: confere e dá veredito.

## O que verificar

Os entregáveis de processo da frente N, na cabeça `4a9ece4` de `origin/frente-n`, contra a `main` (`25c3d5a`; código do agente congelado no commit `9d37f9a`). Arquivos: `README.md`, `docs/COMO-FOI-FEITO.md`, `docs/rascunho-cortes-e-mais-tempo.md`, `docs/desenhos/*.md`, `docs/agente.md` se existir, `docs/setup/**`. Veja a lista exata com `git diff --stat main...4a9ece4`.

Fontes de verdade, nesta ordem: o código e os testes da `main`; os relatórios de eval em `evals/relatorios/2026-11-14-dev-9d37f9a-rodada-{1,2,3}.json` (e os de `0567371` e `b5af852`, que são registro, não resultado); `DECISOES.md`; `docs/CONTRATO.md`; `docs/EVALS.md`; `evals/README.md`; o log do backlog `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md` (as linhas datadas, sobretudo as de 14/11 de 03h08 em diante); `docs/revisoes/m2.md`.

## Onde trabalhar e o que não fazer

- Rascunho da coordenação (SP): `<rascunho>`.
- Sua worktree descartável dentro de SP: `git -C <checkout principal> worktree add --detach SP/ver-n-wt main` e, nela, `git merge --no-ff --no-commit 4a9ece4` (ensaio; sem commit). No fim: `git merge --abort` e `git worktree remove --force`. Sondas e saídas suas em `SP/ver-n-sondas/`. Nenhum arquivo em outro checkout, nem na raiz de SP além do relatório. Sem commit, push ou branch.
- Offline: nenhuma chamada a `dev`, a `producao`, ao catálogo ou a modelo. Não abra `~/.config/agente-concierge/` nem `~/.cache/agente-concierge/c-reservado/` (segredos e conjunto reservado). Não rode a suíte inteira (não é preciso: o delta é só de documentos); se rodar algum teste, use `~/.cache/agente-concierge/com-trava.sh <comando>` com `--maxWorkers=3`.
- Nunca escreva no relatório um endereço, domínio, token, IP ou nome de máquina que encontrar: diga só o arquivo e a linha.

## Barra fechada (APROVADO só sem achado crítico ou alto)

1. **Números.** Todo número do `README.md` e do `docs/COMO-FOI-FEITO.md` confere com a fonte. Recalcule você mesmo: acerto por bloco e total das três rodadas de `9d37f9a` a partir dos JSON; latência; custo com `node scripts/custo.mjs <relatório>`; contagem de casos (`node evals/rodar.mjs --listar`); número de testes e de arquivos de teste declarado contra o que existe (conte os arquivos em `test/` e leia a linha do log que traz a contagem; não precisa rodar); números do conjunto reservado contra a linha de 04h58 do log; hashes citados existem (`git cat-file -t`). Liste cada divergência com arquivo e linha.
2. **Garantias.** Cada frase que promete um comportamento ("nunca", "sempre", "nenhum lead sem confirmação", "o total sai do código") tem lastro: um teste que você localiza, um veredito de verificador registrado ou uma decisão. Garantia sem lastro, ou dada como certa quando a fonte diz "medido em N conversas", é achado alto.
3. **Limites.** A lista de limites do README cobre o que a `main` registra: limites do juiz (a lista de `evals/README.md` da `main`), P26 a P35 de `DECISOES.md`, os itens de `docs/revisoes/m2.md` que ficaram como limite, a autocorreção do modelo, o teto de chamadas e a confirmação, a gramática fechada do sim. E nenhum limite descreve comportamento que não existe mais na `main`. Confira cinco limites ao acaso contra o código.
4. **Desenhos.** Cada desenho de `docs/desenhos/` confere com o código da `main`, nó por nó: o que cada caixa diz acontece em `src/` (cite arquivo e linha), e os números do desenho (voltas do laço, tempos, tetos, janela, tamanhos) são os do código. O Mermaid é válido: se houver `mmdc` ou `npx @mermaid-js/mermaid-cli` disponível offline, renderize; se não, confira a sintaxe à mão e diga que não renderizou.
5. **Sigilo e convenção.** Na árvore mesclada, `scripts/verificar-sigilo.sh` termina em `SIGILO OK`. Além do gate, leia você: nada de nome da empresa do desafio, trecho copiado de enunciado, domínio, IP, nome de máquina, caminho de usuário, e-mail que não seja contato@evertonresende.com. Convenção do dono do repositório: decisão dele é registrada só com a data, sem hora e sem circunstância pessoal dele (frases como "estava fora", "dormindo", "ausente", "quando voltar"). Liste cada ocorrência nos arquivos da frente N.
6. **Marcadores.** Liste todos os `PREENCHER` (`grep -rn PREENCHER README.md docs/`). Nenhum esconde um número que já existe nas fontes; nenhum texto sem marcador diz "a definir" ou equivalente.
7. **Coerência e uso.** `README.md`, `docs/COMO-FOI-FEITO.md` e `DECISOES.md` não se contradizem (números das decisões, quantas rodadas de verificador cada frente teve, quantos erros a coordenação registra, tabela de modelos por frente, incluindo o período em que uma frente rodou em outro modelo). Os comandos do "como rodar" e "como testar" existem em `package.json`, `scripts/` e `evals/` com esses nomes e opções.
8. **Ensaio do merge.** `git diff --stat main...4a9ece4` só toca documentos; o merge sobre a `main` é limpo.

Severidade: crítico (segredo ou dado de sigilo; número de resultado errado), alto (garantia sem lastro; limite ausente que muda a leitura do resultado; desenho que contradiz o código), médio, baixo.

## Relatório

Grave `SP/ver-n-final-relatorio.md` UMA vez, só no fim (a coordenação só age na sua mensagem de fim de tarefa). Primeira linha: `VEREDITO: APROVADO` ou `VEREDITO: REPROVADO`. Depois, item por item: PASSA ou FALHA, com os números que você recalculou e cada achado com severidade, arquivo e linha, e o texto que deveria estar lá segundo a fonte. Repita o veredito e a contagem de achados por severidade na mensagem final. Prazo: 35 minutos.
````
