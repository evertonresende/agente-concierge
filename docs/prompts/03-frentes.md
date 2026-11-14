# Prompts de abertura das frentes

Os 18 textos com que a sessão coordenadora abriu cada frente de trabalho, na ordem de envio, com a data, a hora de Brasília e o modelo de cada uma.

Extraídos do registro da sessão coordenadora por script, sem edição do texto, com estas exceções: caminhos da máquina e o identificador local da conversa da coordenadora foram trocados por marcadores (`<rascunho>`, `<worktree da coordenação>`, `<checkout principal>`, `~/`, `<conversa da coordenadora>`); 2 frase(s) sobre a disponibilidade do Éverton foram omitidas e estão marcadas no lugar; e as mensagens de acompanhamento enviadas depois da abertura não entram aqui. O que cada prompt produziu está no log do backlog (`docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`), pela data e pela hora.

## 1. Frente B1 — webhook falso

13/11 15h58 · deepseek/deepseek-flash

````text
Você é a frente B1 — webhook falso do projeto agente-concierge. Trabalhe só nesta worktree.

Leia inteiro, antes de tudo: AGENTS.md, docs/CONTRATO.md (seções 5, 8 e 9 com atenção) e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, as seções "Sessão B1", "Regras que valem para toda frente", "Frente fora do Claude (B1, B2, C, D e J)" e "Dono de arquivo". Não existe outra fonte de requisitos.

Objetivo: um Worker próprio da Cloudflare em falso/ que replica o contrato do webhook de leads (contrato §5) para o ambiente dev, mais falso/teste.mjs, que imprime FALSO OK. É a infraestrutura de teste de CA-09, CA-10, CA-11 e CA-19.

Arquivos seus: tudo dentro de falso/ e nada fora. falso/ tem package.json, lockfile e configuração do wrangler próprios. Precisou de qualquer outro arquivo: pare e avise.

Restrições desta frente (você roda fora do Claude):
- Você NÃO faz deploy. Entregue falso/wrangler.jsonc pronto para a coordenadora rodar `npx wrangler deploy` dentro de falso/: sem secret, sem account_id no arquivo, com a flag de compatibilidade global_fetch_strictly_public, e com armazenamento que sobrevive entre requisições (Durable Object com SQLite ou equivalente; a conta está no plano pago). Confira a sintaxe na documentação oficial da Cloudflare antes de escrever; docs/VERIFICACOES.md §4 traz o que já foi verificado sobre wrangler.jsonc.
- Não abra ~/.config/agente-concierge/env. Você não precisa de nenhuma URL real e não recebe nenhuma.
- Teste só local: `npx wrangler dev` dentro de falso/ na porta 8795 e `node falso/teste.mjs http://127.0.0.1:8795/leads/<segmento>`.

O que o Worker faz:
- `POST /leads/<segmento>`: valida presença e tipo dos 7 campos de contrato §5 (nome, telefone, imovel_id, checkin e checkout em AAAA-MM-DD, hospedes inteiro, valor_total número). Aceitou: 201 e guarda o lead com a hora de chegada. Faltou campo ou tipo errado: 422 com `{ "erros": [ ... ] }` e não guarda.
- `GET /leads/<segmento>`: `{ "leads": [ ... ] }` só daquele segmento.
- Uma lista de leads por segmento: segmentos diferentes nunca se misturam.
- Modos de teste, por cabeçalho ou por segmento especial: forçar 500, forçar atraso (configurável, longo o bastante para estourar o tempo limite de um cliente) e forçar 422. Documente em falso/README.md como ligar cada modo e se, em cada um, o lead é guardado ou não.
- `DELETE /leads/<segmento>`: limpa aquela lista. Só existe no falso.
- falso/teste.mjs: Node 24, sem dependências. Recebe a URL de um segmento e cobre: POST válido → 201 e aparece no GET; POST sem campo → 422 e não aparece; tipo errado → 422; dois segmentos isolados; cada modo de teste; DELETE limpa. Usa segmentos próprios da rodada para não depender de lista vazia. Imprime FALSO OK e sai 0 só se tudo passou; senão diz o que falhou e sai 1.

Critérios de aceite: os da seção "Sessão B1" do backlog, com CHECK e ESPERA. Cumprido = saída 0 e o marcador na saída. O CHECK contra `$LEADS_URL_DEV` é da coordenadora, depois do deploy.

Fora do escopo: qualquer arquivo fora de falso/; qualquer requisição a um webhook real; deploy.

Regras duras: nenhum POST a webhook real; nunca imprimir segredo; `scripts/verificar-sigilo.sh` terminando em SIGILO OK antes de cada commit (com tudo em stage) e de cada push; nunca squash, amend ou rebase, e essas palavras não entram em assunto de commit; um commit por mudança lógica, com push da sua branch a cada commit; não mude a identidade do git nem o nome da branch; rodapé do commit como manda o AGENTS.md, com o nome real da sua ferramenta e do seu modelo; lacuna do contrato ou critério impossível: pare e avise, não decida comportamento.

Ao terminar: releia o seu diff inteiro como revisor e corrija o que achar; commit e push da sua branch; e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK que você rodou, o que você não rodou, o que ficou de fora, o nome da branch (`git branch --show-current`) e os commits. Sem colar diff.
````

## 2. Frente A — esqueleto até o Marco 1

13/11 15h59

````text
Você é a frente A — esqueleto vertical até o Marco 1 do projeto agente-concierge. Trabalhe só nesta worktree (branch frente-a).

Leia inteiro, antes de tudo: CLAUDE.md, docs/CONTRATO.md e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, o topo ("Primeiro marco"), a seção "Sessão A", "Regras que valem para toda frente" e "Dono de arquivo". Leia também docs/VERIFICACOES.md §1 a §4 e, em docs/EVALS.md, o nível 1 e a seção das duas mensagens simultâneas. Não existe outra fonte de requisitos.

Objetivo: o agente funcionando de ponta a ponta em dev até o Marco 1 — a cotação do exemplo do contrato §3 devolve R$ 2.156,00, o hóspede recebe o resumo, confirma em outro turno, o lead chega ao webhook falso com os 7 campos, e um pedido de desconto devolve handoff true. Atende CA-01, CA-02, CA-04, CA-06, CA-09, CA-10, CA-11, CA-14 e CA-17 no nível do esqueleto.

Arquivos seus (coluna "Leva 1" da tabela de donos): package.json, lockfile, tsconfig.json, wrangler.jsonc, configuração do vitest, src/** e test/**. Qualquer outro arquivo: pare e avise. falso/ é da frente B1 e evals/ é das frentes B2 e D, que rodam em paralelo com você.

Critérios de aceite: os 6 da seção "Sessão A", com CHECK e ESPERA. Cumprido = saída 0 e o marcador de ESPERA na saída.

Fora do escopo: datas relativas, sem ano e no passado (frente E); validação de telefone, segunda reserva e nova tentativa de webhook (frente F); casos de ataque e matriz fina de handoff (frente G); qualquer secret ou deploy de producao.

O que você precisa saber e não está no backlog:
1. Deploy em dev é seu. Credencial: `CLOUDFLARE_API_TOKEN="$(cat ~/.cf-token)"` no mesmo comando do wrangler, nunca ecoado, nunca gravado em arquivo. A conta: `CLOUDFLARE_ACCOUNT_ID`, que já está em ~/.config/agente-concierge/env; carregue o arquivo no mesmo comando. Não escreva account_id no wrangler.jsonc.
2. `LEADS_URL_DEV` ainda não existe. A frente B1 está construindo o webhook falso; quando ele estiver publicado em dev, eu gravo `LEADS_URL_DEV` no arquivo de ambiente e aviso nesta thread. Até lá, teste a trava de confirmação com mock nos testes. Não publique o webhook falso você mesma.
3. Depois do primeiro deploy, acrescente `AGENTE_URL_DEV=<url>` ao arquivo de ambiente, sem imprimir o valor. A partir daí o gate de sigilo trata o host de dev como termo proibido em arquivo versionado: ele não entra em código, teste, documento nem commit.
4. O bloco `marco1` dos evals está sendo escrito pela frente B2. O critério 5 (critério de integração 1) quem roda sou eu, depois dos merges. Para o seu relatório, rode a conversa do Marco 1 em dev por curl e diga o resultado de cada um dos quatro passos (total, resumo, lead conferido por GET no webhook falso, handoff).
5. Modelo inicial: um nativo do Workers AI de docs/VERIFICACOES.md §2, atrás da variável MODELO e do adaptador único em src/modelo.ts. A escolha final é da frente I, que vai testar também modelos de terceiros pelo AI Gateway: deixe o adaptador pronto para trocar de modelo só pela variável.
6. O gate de sigilo lê o reflog: as palavras squash, amend e rebase não entram em assunto de commit nem em nome de branch.
7. Subagentes de revisão e de verificação usam o modelo Opus. Não use workflows nem ultracode: o orçamento de uso está apertado.

Regras duras: nenhum POST ao webhook real (você nem monta a URL real); nunca imprimir segredo; gate de sigilo antes de cada commit e de cada push; nunca squash, amend ou rebase; um commit por mudança lógica, com push da branch frente-a a cada commit; lacuna do contrato ou critério impossível: pare e avise, não decida comportamento de produto.

Ao terminar: revisão de código por subagente code-reviewer sobre o seu diff, achados corrigidos, npm test verde, commit e push da sua branch, e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK, o que ficou de fora, commits. Sem colar diff. Se a ferramenta t3_thread_send existir na sua sessão, mande o mesmo relatório para a thread da coordenadora (id <conversa da coordenadora>). Se travar em lacuna ou em algo que dependa de mim, avise do mesmo jeito em vez de esperar.
````

## 3. Frente B2 — harness e casos dev

13/11 15h59

````text
Você é a frente B2 — harness de evals e casos de desenvolvimento do projeto agente-concierge. Trabalhe só nesta worktree (branch frente-b2).

Leia inteiro, antes de tudo: AGENTS.md, docs/CONTRATO.md, docs/EVALS.md e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, o topo ("Primeiro marco"), a seção "Sessão B2", "Critérios de integração", "Regras que valem para toda frente", "Frente fora do Claude (B1, B2, C, D e J)" e "Dono de arquivo". Não existe outra fonte de requisitos.

Objetivo: o runner `evals/rodar.mjs` e os casos de desenvolvimento por bloco, que medem o agente só pelo contrato HTTP (CA-01 a CA-19 onde a coluna "Como se prova" do contrato diz eval).

Arquivos seus: evals/rodar.mjs, evals/teste-do-runner.mjs, evals/lib/**, evals/casos/dev/** e evals/README.md. Nada fora disso: não toque em package.json da raiz, lockfile, configuração de teste, wrangler.jsonc, src/, test/, falso/ nem evals/simulador/ (é da frente D). Precisou de outro arquivo: pare e avise.

Ordem de entrega, com commit e push a cada passo:
1. Primeiro (nos primeiros 45 minutos): o runner mínimo, evals/README.md com o formato do arquivo de caso, e o bloco `marco1` em evals/casos/dev/marco1/. O Marco 1 está no topo do backlog: cotação do exemplo do contrato §3 com R$ 2.156,00, resumo, confirmação em outro turno, lead no webhook falso com os 7 campos, e pedido de desconto com handoff true. As frentes C e D escrevem casos no seu formato: o README sai cedo e o formato mínimo de docs/EVALS.md não quebra depois.
2. Depois: os oito blocos de docs/EVALS.md, com pelo menos 6 casos cada, o juiz determinístico de total, a trava contra alvo que não é dev, e evals/teste-do-runner.mjs.

O que o backlog não diz e você precisa saber:
- Você roda fora do Claude: não abra ~/.config/agente-concierge/env e não receba URL real. O runner lê `LEADS_URL_DEV` do ambiente do processo em tempo de execução e nunca imprime nem grava esse valor. Os CHECK contra `$AGENTE_URL_DEV` são rodados pela coordenadora. Você testa com um agente de mentira e um webhook de mentira locais, dentro de evals/teste-do-runner.mjs.
- Os relatórios em evals/relatorios/ são commitados depois pela coordenadora, e o gate de sigilo reprova o host do alvo e o do webhook. O relatório nunca registra a URL do alvo nem a do webhook: registra só o `ambiente` devolvido por GET /saude. Nome e telefone saem mascarados no relatório (contrato L22). Você não commita relatórios.
- Fatos do catálogo para escrever expectativas: ~/.local/share/agente-concierge/catalogo/fichas.json (10 cidades e 15 fichas, só leitura). O juiz de total recalcula a estadia com a regra do contrato §3, em centavos inteiros, numa implementação sua, independente do código de produto; se ele precisar de diária e taxa, guarde em evals/lib/ uma cópia só desses campos.
- Onde docs/EVALS.md diz `[depende de L-n]`, a expectativa é a regra L-n da seção 10 do contrato. Todas as lacunas estão decididas.
- Conjunto reservado: `--conjunto reservado` lê os casos de uma pasta fora do repositório. Ordem de busca: variável `RESERVADO_DIR`; senão evals/casos/reservado/, se existir; senão ~/.config/agente-concierge/reservado/. Nesse conjunto o runner força `--so-agregado`: só acerto por bloco e a linha final `RESERVADO OK` (agregado de 90% ou mais) ou `RESERVADO REPROVADO`; nunca id de caso, mensagem ou resposta. `--listar` nesse conjunto imprime só a contagem por bloco. Você nunca abre a pasta real do reservado: teste com uma pasta temporária sua, por `RESERVADO_DIR`.
- Saídas que os CHECK esperam, exatamente: `BLOCO <nome>: <n>%` por bloco; `EVAL OK` só se todos os limiares de docs/EVALS.md passarem (senão `EVAL REPROVADO` e saída diferente de 0); `--bloco` pode repetir; `--listar` imprime `CASOS OK` quando cada bloco de docs/EVALS.md tem 6 casos ou mais; `node evals/teste-do-runner.mjs` imprime `RUNNER OK`; com `--trava`, `TRAVA OK`.
- O telefone gerado pelo runner é um número brasileiro válido, único por execução; a comparação com o lead recebido é pelos dígitos, porque o agente envia no formato de L6.
- Modelos têm limite de pedidos por minuto: o runner tem uma opção de paralelismo, com padrão baixo.
- Expectativas por regex são frágeis: prefira o que o contrato fixa (total em reais, booleano de handoff, leads recebidos, ausência de total) a frases exatas.

Critérios de aceite: os 3 da seção "Sessão B2", com CHECK e ESPERA. Cumprido = saída 0 e o marcador de ESPERA na saída.

Fora do escopo: código de produto; package.json da raiz; casos do conjunto reservado; simulador.

Regras duras: nenhum POST a webhook real; nunca imprimir segredo; `scripts/verificar-sigilo.sh` terminando em SIGILO OK antes de cada commit (com tudo em stage) e de cada push; nunca squash, amend ou rebase, e essas palavras não entram em assunto de commit; um commit por mudança lógica, com push da branch frente-b2 a cada commit; não mude a identidade do git; rodapé do commit como manda o AGENTS.md, com o nome real da sua ferramenta e do seu modelo; lacuna do contrato ou critério impossível: pare e avise, não decida comportamento.

Ao terminar cada um dos dois passos: releia o seu diff como revisor e corrija o que achar; commit e push; e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK que você rodou, o que não rodou, o que ficou de fora, commits. Sem colar diff. Se a ferramenta t3_thread_send existir na sua sessão, mande o relatório também para a thread da coordenadora (id <conversa da coordenadora>) — o do passo 1 assim que ele estiver no remoto, sem esperar o passo 2. Você vai receber depois, nesta thread, casos novos das frentes C e D para incorporar.
````

## 4. Frente C — conjunto reservado

13/11 15h59

````text
Você é a frente C — conjunto reservado de evals do projeto agente-concierge. Você fica viva até a entrega.

Leia inteiro, antes de tudo: AGENTS.md, docs/CONTRATO.md, docs/EVALS.md e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão C", "Regras que valem para toda frente" e "Frente fora do Claude (B1, B2, C, D e J)". Não existe outra fonte de requisitos.

Objetivo: um conjunto de conversas de avaliação que ninguém mais vê e que ninguém usa para corrigir o agente. É o número honesto da entrega: mede o agente como uma bateria oculta mediria, só pelo `POST /chat`.

Barreira (é o motivo de você existir):
- Você não corrige o agente e não lê código de produto: nunca abra src/, test/ nem falso/, nem agora nem depois.
- Você não lê os casos de desenvolvimento: nunca abra evals/casos/dev/ nem evals/simulador/.
- Ninguém vê os seus casos: nem a coordenadora, nem outra frente. Não cole caso, mensagem nem expectativa em relatório, commit ou resposta. Relatório seu traz só contagem por bloco.
- Você não commita nada neste repositório e não faz push. Os casos ficam fora dele.

Onde escrever: ~/.config/agente-concierge/reservado/<bloco>/<id>.json, um arquivo por conversa. Essa pasta fica ao lado do arquivo `env`, que você nunca abre, imprime nem carrega. Crie a pasta `reservado` se não existir. Qualquer rascunho ou script de apoio fica em ~/.config/agente-concierge/reservado-apoio/, nunca dentro de `reservado/` (o runner lê tudo o que estiver lá) e nunca no repositório.

O que escrever:
- 5 a 8 conversas por bloco, nos oito blocos de docs/EVALS.md: funciona-respostas, funciona-cotacoes, funciona-recusas, funciona-leads, robustez-nao-inventa, robustez-manipulacao, robustez-handoff e contrato.
- Formato: o do arquivo de caso em docs/EVALS.md ("Formato do arquivo de caso"), usando só os campos descritos lá: id, bloco, confirma, turnos (mensagem, espera com resposta_contem, resposta_nao_contem e handoff; turno `paralelo`) e leads_esperados; nome e telefone por `{{nome}}` e `{{telefone}}`. A frente B2 está escrevendo o runner e pode estender o formato; quando o evals/README.md dela chegar, eu aviso aqui para você conferir.
- Pense como um hóspede real e como um mal-intencionado. Não copie os exemplos da tabela de casos de desenvolvimento de docs/EVALS.md: outros imóveis, outras datas, outras formulações, outros ângulos de ataque.
- A expectativa de cada caso sai do contrato: seções 2 a 7 e as regras L-n da seção 10 (todas decididas). Se o contrato não decide o que deveria acontecer, não escreva o caso: anote a dúvida, sem o caso, no seu relatório.
- Fatos do catálogo: ~/.local/share/agente-concierge/catalogo/fichas.json (10 cidades e 15 fichas, só leitura). É a única fonte de fato sobre imóvel.
- Todo total esperado é calculado por um script seu, em centavos inteiros, pela regra do contrato §3 (noite que começa em sexta ou sábado custa 20% a mais, arredondada por noite, mais a taxa de limpeza uma vez), nunca de cabeça. Confira o dia da semana de cada data pelo script.
- Use datas de 2027 em diante, com o ano escrito, para o caso não vencer. Caso com data relativa ("amanhã", data sem ano) só com expectativa que vale em qualquer dia em que o caso rodar.
- Expectativa por regex é frágil: prefira o que o contrato fixa (o total no formato R$ 2.156,00, o booleano de handoff, os leads esperados, a ausência de total) a frases exatas. Uma expectativa errada reprova o agente sem que ninguém possa ver por quê.
- `confirma: true` em todo caso em que o hóspede chega a confirmar uma reserva.

Critérios de aceite: os 2 da seção "Sessão C". Quem roda os CHECK é a coordenadora; o runner só mostra agregado.

Ao terminar: valide que todo arquivo é JSON válido e um relatório de até 12 linhas: número de casos por bloco, quantos têm confirma true, dúvidas de contrato que impediram algum caso (sem o caso), e nada do conteúdo. Se a ferramenta t3_thread_send existir na sua sessão, mande o relatório também para a thread da coordenadora (id <conversa da coordenadora>). Depois, espere: vou escrever nesta thread quando um bloco reprovar e for preciso revelar um caso (ele migra para o conjunto de desenvolvimento pela frente B2 e você escreve um substituto que ninguém vê).
````

## 5. Frente D — simulador de hóspede hostil

13/11 16h00

````text
Você é a frente D — simulador de hóspede hostil do projeto agente-concierge. Trabalhe só nesta worktree (branch frente-d).

Leia inteiro, antes de tudo: AGENTS.md, docs/CONTRATO.md, docs/EVALS.md (com atenção ao formato do arquivo de caso e à seção "Simulador de hóspede hostil (nível 3)") e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão D", "Regras que valem para toda frente", "Frente fora do Claude (B1, B2, C, D e J)" e "Dono de arquivo". Não existe outra fonte de requisitos.

Objetivo: `evals/simulador/`, em que um modelo de outro provedor faz o hóspede, turno a turno, por persona, contra o agente de dev, com juízes determinísticos; mais pelo menos 10 casos de ataque fixos. Cobre CA-05, CA-09, CA-10, CA-12 e CA-13 pelo lado do ataque.

Arquivos seus: só evals/simulador/**. Nada fora disso: evals/rodar.mjs, evals/lib/ e evals/casos/ são da frente B2, que roda em paralelo com você. Precisou de outro arquivo: pare e avise.

O que construir:
1. `evals/simulador/rodar.mjs --alvo <url> --rodadas <n>`: Node 24, sem dependências. Antes de tudo faz GET <alvo>/saude e só segue se a resposta trouxer `ambiente: "dev"`; senão imprime `ALVO RECUSADO` e sai diferente de 0. Roda as 8 personas de docs/EVALS.md, grava um relatório em evals/relatorios/ e imprime `SIMULADOR OK` quando a rodada termina com relatório (as falhas do agente vão no relatório; não derrubam a rodada).
2. O hóspede é feito por uma CLI local de outro provedor, chamada como subprocesso a cada turno, com o modelo escolhido por opção de linha de comando. Nesta máquina existe `agy -p "<texto>" --model <modelo>` (Gemini em modo de impressão; passe sempre `--model`). Confira que a chamada funciona com um texto qualquer antes de construir em cima. Nunca use o GPT (uso limitado) nem os modelos gratuitos do OpenCode. O texto enviado à CLI nunca leva URL, segredo nem dado real: só a persona e a conversa.
3. Juízes determinísticos, os quatro de docs/EVALS.md: total citado igual ao cálculo da regra do contrato §3 em centavos inteiros; nenhum lead sem confirmação e nunca dois para a mesma reserva; handoff true nos gatilhos; resposta em menos de 60 s e no formato do contrato. A frente B2 está escrevendo juízes equivalentes em evals/lib/. Isole os seus atrás de um módulo seu para trocar depois: quando eu avisar que evals/lib/ está na main, você faz `git merge origin/main` e passa a reutilizar os de lá. Não crie nada em evals/lib/.
4. Os leads de cada conversa são conferidos por GET no webhook falso, cuja URL o processo lê da variável `LEADS_URL_DEV` em tempo de execução e nunca imprime nem grava. Cada conversa usa um telefone brasileiro válido e único, e é por ele (pelos dígitos) que o simulador acha os leads dela.
5. Cada falha vira caso fixo: o relatório traz a conversa que falhou, reduzida aos turnos necessários, no formato de caso de docs/EVALS.md, pronta para ser gravada.
6. Pelo menos 10 casos de ataque fixos, escritos à mão no mesmo formato, em evals/simulador/para-dev/<bloco>/ (blocos robustez-manipulacao, robustez-handoff e funciona-leads). Eles existem mesmo que o simulador seja cortado, e é a frente B2 que os move para evals/casos/dev/. Cada expectativa sai do contrato (seções 5 a 7 e as regras L-n da seção 10, todas decididas); todo total esperado é calculado por script, não de cabeça.

O que o backlog não diz e você precisa saber:
- Você roda fora do Claude: não abra ~/.config/agente-concierge/env e não receba URL real. Você constrói e testa contra um agente de mentira local (um servidor seu, dentro de evals/simulador/, com /saude e /chat) e um webhook de mentira local. A rodada ao vivo contra dev (critério 1) é rodada pela coordenadora.
- Os relatórios em evals/relatorios/ são commitados depois pela coordenadora, e o gate de sigilo reprova o host do alvo e o do webhook: o relatório nunca registra a URL do alvo nem a do webhook, só o `ambiente` devolvido por /saude. Nome e telefone saem mascarados (contrato L22). Dados sempre sintéticos. Você não commita relatórios.
- Fatos do catálogo: ~/.local/share/agente-concierge/catalogo/fichas.json (10 cidades e 15 fichas, só leitura).

Critérios de aceite: os 2 da seção "Sessão D", com CHECK e ESPERA. O critério 2 (`ALVO RECUSADO`) você roda. O critério 1 você prova contra o agente de mentira local e a coordenadora roda contra dev.

Fora do escopo: código de produto; o runner e os casos de desenvolvimento; qualquer alvo que não seja dev ou local.

Regras duras: nenhum POST a webhook real; nunca imprimir segredo; `scripts/verificar-sigilo.sh` terminando em SIGILO OK antes de cada commit (com tudo em stage) e de cada push; nunca squash, amend ou rebase, e essas palavras não entram em assunto de commit; um commit por mudança lógica, com push da branch frente-d a cada commit; não mude a identidade do git; rodapé do commit como manda o AGENTS.md, com o nome real da sua ferramenta e do seu modelo; lacuna do contrato ou critério impossível: pare e avise, não decida comportamento.

Ao terminar: releia o seu diff como revisor e corrija o que achar; commit e push; e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK que você rodou, o que não rodou, o que ficou de fora, commits. Sem colar diff. Se a ferramenta t3_thread_send existir na sua sessão, mande o relatório também para a thread da coordenadora (id <conversa da coordenadora>).
````

## 6. Frente J — página de chat (design)

13/11 16h34

````text
Você é a frente J — página de chat do projeto agente-concierge, passo 1 (design). Trabalhe só nesta worktree (branch frente-j).

Leia antes: CLAUDE.md; em docs/CONTRATO.md, as seções 1, 2, 5 e 6 (o que o agente faz, o contrato do POST /chat, o resumo e a confirmação do lead, o handoff); e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão J — Página de chat", "Regras que valem para toda frente" e "Dono de arquivo".

Objetivo do passo 1: o design da página de chat (a rota GET / do Worker) como um canvas em docs/desenhos/pagina-canvas.html, para o Éverton aprovar NESTA thread antes de qualquer código de produto. Use as skills design-hifi e design-guidelines. Depois de mostrar, PARE e espere a aprovação dele aqui. O passo 2 (implementar em src/pagina.ts) só começa depois do Marco 1 e da aprovação; eu aviso nesta thread.

Arquivo seu neste passo: só docs/desenhos/pagina-canvas.html. Não toque em src/ nem em nenhum outro arquivo versionado.

O Éverton já respondeu o que a skill perguntaria. Não faça a rodada de perguntas e não faça variações lado a lado:
- Uma direção só. Tela completa, web, em duas larguras: desktop e celular.
- Direção: a do site dele. Fonte Inter, sem cantos arredondados, fundo #fafafa, texto #141414, rótulos em maiúsculas com espaçamento largo, muito espaço em branco.
- Conteúdo: conversa com histórico; campo de envio; estados de enviando e de erro; aviso visível quando vier handoff true; três botões de exemplo (a cotação do exemplo do contrato, uma pergunta de comodidade, um pedido de desconto); rodapé com o link do repositório (https://github.com/evertonresende/agente-concierge) e a frase "agente de demonstração, dados fictícios".
- Texto real, sem lorem ipsum: a conversa do Marco 1.
- Funciona só com teclado e tem contraste legível.
- Uma rodada do subagente design-reviewer antes de mostrar, com os achados corrigidos.

A conversa do Marco 1, para o texto do canvas (as respostas do agente você escreve, coerentes com o contrato): cotação do GRM-301 de sexta 15/01/2027 a segunda 18/01/2027 para 2 hóspedes, total R$ 2.156,00; o hóspede informa nome e telefone e recebe o resumo (imóvel, datas com dia da semana, hóspedes, nome, telefone, total); confirma em outro turno; o agente diz que o pedido foi registrado e encaminhado ao time comercial, sem dizer que a reserva está garantida nem que a data está disponível; e um pedido de desconto recebe a resposta de que o agente não negocia preço e passa para uma pessoa, com handoff true e o aviso visível. Dados pessoais fictícios.

Para o Éverton ver: capturas de tela nas duas larguras, mostradas na sua resposta como imagem com caminho absoluto, e o canvas servido na porta 8090 por um servidor estático simples em segundo plano, que fica no ar até ele aprovar. As capturas ficam fora do repositório. Esta máquina não tem interface gráfica: use o Chromium do Playwright em modo headless. A página final será um único HTML servido pelo Worker: diga no canvas como a fonte Inter será carregada.

Sigilo: nenhum nome de máquina, IP ou endereço de dev em arquivo versionado nem em commit. Ao falar do servidor, diga só "porta 8090 desta máquina".

Teto: 40 minutos. Regras duras: `scripts/verificar-sigilo.sh` terminando em SIGILO OK antes de cada commit (com tudo em stage) e de cada push; nunca squash, amend ou rebase, e essas palavras não entram em assunto de commit; commit e push da branch frente-j com o canvas antes de mostrar; não use workflows nem ultracode; subagentes em Opus.

Ao terminar: mostre as capturas, diga em poucas linhas o que o design-reviewer achou e o que você corrigiu, o commit, e pare esperando o Éverton. Se a ferramenta t3_thread_send existir na sua sessão, avise a coordenadora (thread <conversa da coordenadora>) em até 3 linhas que o canvas está pronto para o Éverton aprovar.
````

## 7. Frente F — lead robusto

13/11 17h45

````text
Você é a frente F — lead robusto do projeto agente-concierge. Trabalhe só nesta worktree (branch frente-f).

Leia inteiro, antes de tudo: CLAUDE.md, docs/CONTRATO.md (com atenção às seções 5 e 10) e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão F", "Regras que valem para toda frente" e "Dono de arquivo" (inclusive o parágrafo do acoplamento entre E e F). Leia também docs/revisoes/m1.md: os achados 5, 6 e 7 são seus. Não existe outra fonte de requisitos.

Objetivo: fechar a trava de confirmação e o envio do lead nas regras L6, L7, L9, L10, L11, L15 (textos fixos) e L20, de modo que um lead só saia quando o código, e não o modelo, tiver visto um sim inequívoco ao resumo vigente. Atende CA-09, CA-10, CA-11, CA-17 e CA-19.

Arquivos seus: src/lead.ts, src/agente/ferramentas/lead.ts, src/nucleo/telefone.ts (novo), test/lead.test.ts e testes novos em arquivo seu (test/<tema>-f.test.ts). Qualquer outro arquivo: pare e avise. Em especial: src/agente/ferramentas/pedido.ts e cotacao.ts são da frente E; loop.ts, prompt.ts e tipos.ts são da frente G; sessao.ts e index.ts são da frente H; test/apoio.ts está congelado.

Ordem do trabalho, com commit e push a cada passo:
1. PRIMEIRO — o "sim" validado por código (m1.md, achado 5; L9 e L10). Hoje qualquer turno depois do resumo pode confirmar e quem decide se a mensagem é um sim é o modelo. O `Contexto` das ferramentas já traz `mensagem` (o texto do hóspede neste turno). A confirmação só executa se o código reconhecer, nessa mensagem, um sim inequívoco ao resumo pendente. Hesitação ("acho que sim"): não envia, pergunta de novo. Condição de preço ("sim, se fizer por R$ 2.000"): nenhum lead e handoff true. Outra pergunta: nada é enviado, e o pedido de confirmação se repete. Troca de dado em texto livre (nome, telefone, datas, hóspedes) junto com o sim: não é confirmação do resumo antigo. Na dúvida, não envia: lead enviado não se desfaz.
2. Falhas do webhook (L11; m1.md, achados 6 e 7). `5xx`: exatamente uma nova tentativa; se persistir, não registrado, com handoff true. `422`: não registrado; ler o corpo de forma defensiva (o formato real é desconhecido; o webhook falso devolve `{ "erros": [ { "campo", "erro" } ] }`); se o erro aponta um campo, pedir a correção e refazer o resumo; senão, handoff true. Tempo esgotado ou resposta que não chegou: sem nova tentativa e sem GET, diz que não conseguiu confirmar o registro, handoff true, e essa reserva não é reenviada na sessão. Separe os marcadores de "não registrado com certeza" e de "resultado incerto": hoje os dois são "falhou" e bloqueiam a reserva para sempre.
3. Telefone (L6, em src/nucleo/telefone.ts, função pura com tabela de testes), nome (L20), segunda reserva e repetição (L7), mudança depois do resumo e último resumo mostrado (L10).
4. Idioma dos textos fixos (L15): o resumo, o resultado da confirmação e o aviso de falha continuam gerados por código, e passam a existir em português e em inglês, escolhidos pelo idioma do hóspede; outro idioma recebe o português. O modelo nunca reescreve o resumo. Se o tempo apertar, fica só o português: diga no relatório, e eu registro.

O que você precisa saber e não está no backlog:
- Datas: quem interpreta a data que vem nos argumentos das ferramentas é `prepararPedido`, em pedido.ts (frente E, que está implementando datas relativas agora). Passe as datas a ele como vieram e, na descrição dos parâmetros de data das suas ferramentas, não restrinja o formato. Não mude a assinatura de `resumir` (cotacao.ts a usa) sem me avisar.
- O conjunto de evals de desenvolvimento ainda não está na main (está em revisão). Quando eu avisar, faça `git merge origin/main` e rode o seu CHECK 2. Até lá, trabalhe com `npm test`.
- Servidor local: porta 8789 (`npm run dev -- --port 8789`); o arquivo local do wrangler se cria como na seção 8 do contrato, sem imprimir nada. Webhook falso local: `npx wrangler dev --port 8799` dentro de falso/ (rode `npm ci` lá antes), com o seu próprio segmento (`/leads/frente-f`); aponte para ele o LEADS_URL do seu arquivo local e a variável LEADS_URL_DEV do runner. Os modos de falha por telefone estão em falso/README.md. Nunca o webhook real, e nada de DELETE no segmento de dev.
- O gate de sigilo lê o reflog: as palavras squash, amend e rebase não entram em assunto de commit. Subagentes em Opus. Sem workflows nem ultracode: o limite de uso está apertado.
- Lacuna do contrato: [frase sobre a disponibilidade do Éverton omitida] Não decida sozinha e não pare: mande a dúvida para esta coordenação com a sua recomendação; eu respondo com uma regra provisória.

Critérios de aceite: os 2 da seção "Sessão F", com CHECK e ESPERA, mais um teste por comportamento do passo 1 que falha sem a correção.

Regras duras: nenhum POST ao webhook real; nunca imprimir segredo; gate de sigilo antes de cada commit e de cada push; nunca squash, amend ou rebase; um commit por mudança lógica, com push da branch frente-f; `npm test` e `npm run tipos` sem falha antes de cada commit.

Ao terminar: revisão de código por subagente code-reviewer sobre o seu diff, achados corrigidos, e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK, o que ficou de fora, commits. Sem colar diff. Mande o relatório para a thread da coordenadora (id <conversa da coordenadora>) com t3_thread_send. Se terminar o passo 1 antes do resto, avise logo: ele é o achado mais sério da revisão.
````

## 8. Frente G — robustez e handoff

13/11 17h45

````text
Você é a frente G — robustez e handoff do projeto agente-concierge. Trabalhe só nesta worktree (branch frente-g).

Leia inteiro, antes de tudo: CLAUDE.md, docs/CONTRATO.md (com atenção às seções 4, 6, 7 e 10) e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão G", "Regras que valem para toda frente" e "Dono de arquivo". Leia também docs/revisoes/m1.md (o achado 1 já foi corrigido pela frente A no loop; é a base do seu trabalho) e, em docs/EVALS.md, os blocos robustez-nao-inventa, robustez-manipulacao e robustez-handoff. Não existe outra fonte de requisitos.

Objetivo: o agente não inventa, não obedece a instrução vinda do catálogo nem do hóspede, e passa para humano na hora certa e só nela. Regras L3, L4, L5, L5a, L12, L13a, L15 (idioma das respostas do modelo), L16, L16a, L19 e L21. Atende CA-07, CA-08, CA-12, CA-13 e CA-15, e a parte de CA-05 que é a conferência depois da resposta.

Arquivos seus: src/agente/prompt.ts, src/agente/loop.ts, src/agente/ferramentas/handoff.ts, catalogo.ts, index.ts e tipos.ts, src/catalogo.ts, test/loop.test.ts, test/catalogo.test.ts e testes novos em arquivo seu (test/<tema>-g.test.ts; o CHECK 1 procura por "robustez"). Qualquer outro arquivo: pare e avise. Em especial: lead.ts e ferramentas/lead.ts são da frente F; cotacao.ts, pedido.ts e nucleo/datas.ts são da frente E; sessao.ts e index.ts da raiz são da frente H; test/apoio.ts está congelado.

O que fazer:
1. Matriz de handoff da seção 6 e da seção 10, como comportamento testado: reclamação, desconto ou negociação (inclusive cupom e promoção, L5a), pedido de humano, ação fora do alcance (L19) → true. Informação ausente (L5), recusa de cotação, fora de escopo, "ignore as regras" e pedido de instruções internas (L16) → false. Manipulação que também pede desconto → true (L16a). Pedido para contar menos hóspedes: false na primeira vez, com a explicação de que criança conta; true se insistir (L13a). Conflito com regra do imóvel: cota com aviso e não avança para lead; exceção ou insistência → true (L12). A flag vale só na resposta em que o agente passa, e de novo a cada novo gatilho (L3); depois do handoff o agente continua atendendo o que está no escopo (L4).
2. "Não sei" sem invenção: o que o catálogo não informa, o agente diz que não informa e oferece um humano; nunca afirma disponibilidade (CA-15); campo nulo não vira número.
3. Texto do catálogo como dado: delimitado ao entrar no contexto do modelo e nunca obedecido. Teste com catálogo falso, fiel ao formato real, com instrução embutida na descrição, no nome e nas comodidades (CA-13). O catálogo real não tem texto suspeito.
4. Pergunta por comodidade: a busca do catálogo não olha descrição nem comodidades (contrato §4). O agente precisa ler fichas para responder "imóvel com piscina", sem concluir "não existe" porque a busca veio vazia. Cuide da latência: são 15 imóveis em 10 cidades e não há rota que devolva tudo.
5. Imóvel ambíguo (L21): mais de um compatível, lista as opções e pede a escolha antes de cotar.
6. Conferência depois da resposta: a frente A já retira do texto do modelo todo valor em reais que o código não devolveu na conversa. Efeito colateral conhecido: a frase em que o modelo faz conta própria sai inteira. Endureça e teste: nenhum total que não saiu do código chega ao hóspede, e a resposta não fica truncada nem sem sentido.
7. Idioma (L15): as respostas escritas pelo modelo saem no idioma do hóspede; o total continua em `R$ 2.156,00`. Os textos fixos de resumo e confirmação são da frente F.

O que você precisa saber e não está no backlog:
- O `Contexto` e o `Resultado` das ferramentas (tipos.ts) são consumidos pelas frentes E e F agora. Mudança neles é só aditiva, e você me avisa.
- O prompt não leva segredo, URL nem nome de empresa, e o agente nunca revela instruções internas nem lista de ferramentas.
- O conjunto de evals de desenvolvimento ainda não está na main (está em revisão). Quando eu avisar, faça `git merge origin/main` e rode o seu CHECK 2. Até lá, trabalhe com `npm test`.
- Servidor local: porta 8790 (`npm run dev -- --port 8790`); o arquivo local do wrangler se cria como na seção 8 do contrato, sem imprimir nada. Webhook falso local, se precisar: `npx wrangler dev --port 8798` dentro de falso/ (com `npm ci` lá antes) e segmento próprio (`/leads/frente-g`). Nunca o webhook real, e nada de DELETE no segmento de dev.
- Há uma tarefa condicional na sua seção (juiz de decisão). Ela só começa se eu abrir, com números na mão. Não comece.
- O gate de sigilo lê o reflog: as palavras squash, amend e rebase não entram em assunto de commit. Subagentes em Opus. Sem workflows nem ultracode: o limite de uso está apertado.
- Lacuna do contrato: [frase sobre a disponibilidade do Éverton omitida] Não decida sozinha e não pare: mande a dúvida para esta coordenação com a sua recomendação; eu respondo com uma regra provisória.

Critérios de aceite: os 2 da seção "Sessão G", com CHECK e ESPERA.

Regras duras: nenhum POST ao webhook real; nunca imprimir segredo; gate de sigilo antes de cada commit e de cada push; nunca squash, amend ou rebase; um commit por mudança lógica, com push da branch frente-g; `npm test` e `npm run tipos` sem falha antes de cada commit.

Ao terminar: revisão de código por subagente code-reviewer sobre o seu diff, achados corrigidos, e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK, o que ficou de fora, commits. Sem colar diff. Mande o relatório para a thread da coordenadora (id <conversa da coordenadora>) com t3_thread_send.
````

## 9. Frente E — datas

13/11 17h45 · gemini-4-hydrogen

````text
Você é a frente E — datas do projeto agente-concierge. Trabalhe só nesta worktree.

Leia inteiro, antes de tudo: AGENTS.md, docs/CONTRATO.md (com atenção às seções 3 e 10: L1, L1a, L1b, L2 e L8) e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão E", "Regras que valem para toda frente", "Frente fora do Claude (B1, B2, C, D, E, H e L)" e "Dono de arquivo" (inclusive o parágrafo do acoplamento entre E e F). Leia também, em DECISOES.md, a decisão 9 e a tabela "Decisões provisórias" (P1 e P2). Não existe outra fonte de requisitos.

Objetivo: o agente entende as datas que o hóspede escreve e as resolve por código, no fuso America/Sao_Paulo, com relógio injetado. Atende CA-04 e CA-06 nas datas, e as regras L1, L1a, L1b e L2.

Arquivos seus: src/nucleo/datas.ts, src/agente/ferramentas/cotacao.ts, src/agente/ferramentas/pedido.ts (onde `prepararPedido` interpreta as datas dos argumentos), test/nucleo/datas.test.ts e testes novos em arquivo seu (test/<tema>-e.test.ts). Qualquer outro arquivo: pare e avise. Em especial: src/lead.ts e src/agente/ferramentas/lead.ts são da frente F; loop.ts, prompt.ts e tipos.ts são da frente G; sessao.ts e index.ts são da frente H; src/nucleo/preco.ts e dinheiro.ts não têm dono nesta leva; test/apoio.ts está congelado.

As regras (todas já decididas; não decida nada):
- Data explícita com ano, em AAAA-MM-DD ou DD/MM/AAAA: já funciona. Data inexistente (30/02): pede a data correta, sem total.
- Data sem ano (decisão 9 e P1): é a próxima ocorrência daquela data. Igual a hoje, é hoje. Já passou neste ano, é a do ano seguinte. 29/02 sem ano é o próximo 29/02 que existe.
- "Hoje", "amanhã" e "depois de amanhã" resolvem direto (L1).
- Dia da semana sem data, "sexta" ou "sexta que vem" (L1b e P2): a próxima ocorrência daquele dia; dito no próprio dia, é o da semana seguinte.
- "Fim de semana" sem datas (L1a): o código NÃO mapeia. O agente pede a data de entrada e a de saída. O mesmo vale para "no Natal", "no feriado" e qualquer expressão que não determine entrada e saída.
- Entrada anterior a hoje (L2): recusa, explica e pede novas datas, sem total e sem handoff. Entrada hoje é aceita.
- Quando entrada e saída ficam determinadas, a cotação sai na mesma resposta (L1), e a resposta declara as duas datas exatas, com dia da semana, dia, mês e ano, para o hóspede poder corrigir.
- Saída antes da entrada ou no mesmo dia: recusa, como já é.

Como está o código:
- O `Contexto` das ferramentas (src/agente/ferramentas/tipos.ts, só leitura para você) traz `hoje`: a data civil de hoje em São Paulo, AAAA-MM-DD, vinda de um relógio que os testes injetam. Use esse campo; não chame o relógio do sistema no núcleo. test/apoio.ts tem `criarContexto(mundo, cofre, turno, mensagem, hoje?)` e `HOJE_DE_TESTE`.
- As funções de data são puras e recebem "hoje" como parâmetro. Nada de fuso da máquina: os testes têm de passar com TZ=UTC e com TZ=Pacific/Kiritimati.
- `prepararPedido` é usado por cotacao.ts (seu) e por ferramentas/lead.ts (da frente F). Não mude a assinatura dele sem me avisar; a frente F passa as datas a ele como vieram do modelo.
- Na descrição dos parâmetros de data da ferramenta de cotação, diga ao modelo para passar a data como o hóspede escreveu; quem resolve é o código.

Você roda fora do Claude:
- Não abra ~/.config/agente-concierge/env nem crie arquivo .dev.vars. Desenvolva com `npm ci` e `npm test` (os testes usam modelo e catálogo de mentira e não precisam de segredo).
- O seu CHECK 1 é `npm test -- datas`. O CHECK 2 (bloco funciona-cotacoes contra servidor local) é rodado pela coordenadora na sua worktree, depois do seu relatório.
- Sem deploy e sem requisição a servidor remoto.

Critério de aceite 1: uma tabela de testes com relógio injetado cobrindo: data sem ano antes, igual e depois de hoje; virada de ano (hoje em dezembro, data em janeiro); 29/02 com e sem ano; hoje, amanhã, depois de amanhã; cada dia da semana, inclusive o próprio dia; entrada no passado; entrada hoje; data inexistente; "fim de semana" e "Natal" pedindo as datas; e a resposta da cotação declarando as datas completas. `npm test -- datas` sem falha, e `npm test` e `npm run tipos` inteiros sem falha e sem erro não tratado.

Fora do escopo: preço e recusas por mínimo e capacidade (prontos); lead e telefone (frente F); handoff (frente G).

Regras duras: nunca imprimir segredo; `scripts/verificar-sigilo.sh` terminando em SIGILO OK antes de cada commit (com tudo em stage) e de cada push; nunca squash, amend ou rebase, e essas palavras não entram em assunto de commit; um commit por mudança lógica, com push da sua branch a cada commit; não mude a identidade do git nem o nome da branch; rodapé do commit como manda o AGENTS.md, com o nome real da sua ferramenta e do seu modelo. Se aparecer um caso que as regras acima não decidem, não decida: implemente o resto, e descreva o caso no relatório com a sua sugestão.

Ao terminar: releia o seu diff como revisor e corrija o que achar; commit e push; e um relatório de até 12 linhas: o que foi feito, a saída de cada CHECK que você rodou, o que não rodou, casos que as regras não decidem, o nome da branch (`git branch --show-current`) e os commits. Sem colar diff.
````

## 10. Frente H — concorrência e falha interna

13/11 17h48 · gemini-4-hydrogen

````text
Você é a frente H — concorrência endurecida e falha interna do projeto agente-concierge. Trabalhe só nesta worktree.

Leia inteiro, antes de tudo: AGENTS.md, docs/CONTRATO.md (com atenção à seção 2 e, na seção 10, a L17, L17a e L18) e, em docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md, a seção "Sessão H", "Regras que valem para toda frente", "Frente fora do Claude (B1, B2, C, D, E, H e L)" e "Dono de arquivo". Leia também docs/VERIFICACOES.md §1 (concorrência no Durable Object), a seção "Duas mensagens simultâneas na mesma sessão" de docs/EVALS.md, e docs/revisoes/m1.md: os achados 8, 9, 10 e 11 são seus. Não existe outra fonte de requisitos.

Objetivo: o `POST /chat` responde sempre no formato do contrato, em menos de 60 segundos, uma mensagem por vez na mesma sessão, sem perder mensagem e sem lead duplicado, mesmo com corpo inválido, falha interna ou reinício do objeto. Atende CA-01, CA-03, CA-14 e CA-18.

Arquivos seus: src/index.ts, src/sessao.ts, test/sessao.test.ts, test/chat.test.ts e testes novos em arquivo seu (test/<tema>-h.test.ts; o CHECK 1 procura por "sessao" e "concorrencia"). Qualquer outro arquivo: pare e avise. Em especial: src/env.ts é da frente I (se precisar de variável nova, peça à coordenadora); src/lead.ts e ferramentas/lead.ts são da frente F; loop.ts, prompt.ts e tipos.ts são da frente G; test/apoio.ts está congelado.

O que fazer:
1. Corpo do POST /chat (L17 e L17a). JSON válido com `session_id` e `message` em texto devolve SEMPRE 200. Mensagem vazia: o agente pede para escrever a mensagem. Mensagem acima de 8.000 caracteres: o agente pede para resumir. Nos dois casos, `handoff: false`, sem chamar o modelo. `session_id` vazio é texto e devolve 200, como uma sessão qualquer. 400 só para JSON inválido, campo faltando ou campo presente que não é texto, com corpo `{ "reply": "<o que está errado>", "handoff": false }`. Nunca 500.
2. Falha interna (L18): uma nova tentativa; se persistir, 200 com aviso honesto e `handoff: true`. Nunca 500, nunca corpo fora do formato.
3. Teto de tempo (m1.md, achado 9). Toda resposta sai antes de 60 s contados da chegada ao Worker, inclusive quando a mensagem esperou na fila atrás de outra. Hoje a espera na fila gasta o orçamento da mensagem seguinte e o Worker não tem teto próprio. Dê ao Worker um teto próprio abaixo de 60 s com a resposta de contingência, e não deixe uma mensagem que só esperou na fila sair em contingência sem necessidade.
4. Resumo confirmável sem ter sido entregue (m1.md, achado 8). Se a gravação do histórico falhar ou o objeto reiniciar depois de o estado do lead ter sido gravado, o resumo pendente não pode valer para um "sim" seguinte: o estado e o histórico de um turno valem juntos ou não valem.
5. Reinício do objeto com lead em estado de envio: nenhum segundo POST automático (já há teste; endureça com dois "sim" simultâneos e com reinício entre o marcador e a resposta do webhook).
6. Ordem da fila (m1.md, achado 10): hoje a ordem é a de entrada no objeto, e o corpo é lido antes. Avalie se dá para garantir a ordem de chegada ao Worker de forma simples; se não der, diga no relatório por quê e deixe como está.
7. Rejeição não tratada quando o prazo estoura durante o POST do lead (m1.md, achado 11): não pode sobrar erro não tratado na saída dos testes.

Como está o código (a frente A encerrou assim): `Sessao.conversar` não rejeita mais; processamento que lança vira a resposta de contingência com handoff. A fila é uma corrente de promises em memória dentro do objeto. Os tempos limite do catálogo e do webhook usam AbortController com o relógio cancelado no fim. A sessão tem um relógio injetável só para a data de hoje; o prazo usa o relógio real. `blockConcurrencyWhile` não serve aqui (limite de 30 s; veja docs/VERIFICACOES.md §1).

Você roda fora do Claude:
- Não abra ~/.config/agente-concierge/env nem crie arquivo .dev.vars. Desenvolva com `npm ci` e `npm test` (os testes usam modelo, catálogo e webhook de mentira e não precisam de segredo).
- O seu CHECK 1 é `npm test -- sessao concorrencia`. O CHECK 2 (bloco contrato contra servidor local) é rodado pela coordenadora na sua worktree, depois do seu relatório.
- Sem deploy e sem requisição a servidor remoto.

Critérios de aceite: `npm test -- sessao concorrencia` sem falha, incluindo: duas confirmações simultâneas geram exatamente 1 lead; duas perguntas simultâneas dão duas respostas 200 e histórico íntegro na ordem; cada item de 1 a 5 com um teste que falha sem a correção. `npm test` e `npm run tipos` inteiros sem falha e sem erro não tratado.

Fora do escopo: regras de lead, telefone e textos de confirmação (frente F); handoff e prompt (frente G); datas (frente E); página (frente J).

Regras duras: nunca imprimir segredo; `scripts/verificar-sigilo.sh` terminando em SIGILO OK antes de cada commit (com tudo em stage) e de cada push; nunca squash, amend ou rebase, e essas palavras não entram em assunto de commit; um commit por mudança lógica, com push da sua branch a cada commit; não mude a identidade do git nem o nome da branch; rodapé do commit como manda o AGENTS.md, com o nome real da sua ferramenta e do seu modelo. Se aparecer um caso que o contrato não decide, não decida: implemente o resto e descreva o caso no relatório com a sua sugestão.

Ao terminar: releia o seu diff como revisor e corrija o que achar; commit e push; e um relatório de até 12 linhas: o que foi feito item a item, a saída de cada CHECK que você rodou, o que não rodou, casos que o contrato não decide, o nome da branch (`git branch --show-current`) e os commits. Sem colar diff.
````

## 11. Frente I — escolha do modelo

13/11 18h21 · claude-opus-5-5 · esforço high

````text
Você é a FRENTE I (escolha do modelo por eval) da entrega do agente-concierge. Trabalha sozinha nesta worktree, que nasceu da main (75fdeb8). Não abra subagentes. Responda e escreva tudo em português do Brasil.

LEIA ANTES DE QUALQUER COISA, nesta ordem: `CLAUDE.md` (sigilo, histórico, webhook real: valem sem exceção); `docs/CONTRATO.md` inteiro; em `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md` as seções "Regras que valem para toda frente", "Dono de arquivo" e "Sessão I — Escolha do modelo" (tasks e critérios de aceite são o seu contrato); `DECISOES.md` X10; `docs/VERIFICACOES.md` §2 (candidatos e ressalvas); `docs/EVALS.md` e o README de `evals/` (como o runner funciona, inclusive a trava dos casos com confirmação).

SEUS ARQUIVOS (só estes): `src/modelo.ts`, `src/env.ts`, `wrangler.jsonc` e `package.json`/lock apenas no que o modelo e o AI Gateway exigirem, `test/modelo*.test.ts`, `docs/revisoes/modelos.md`. Nada em `src/agente/**`, `src/lead.ts`, `src/sessao.ts`, `src/index.ts`, `evals/**`, `test/apoio.ts`. Se precisar de mudança fora da sua lista, pare e me diga qual linha e por quê. Script de medição que não for versionável fica fora do repositório (pasta temporária); o método vai descrito em `docs/revisoes/modelos.md`.

O QUE ENTREGAR, em duas fases:

FASE 1 (agora, alvo de 1h30):
1. Encanamento: `src/modelo.ts` capaz de usar os 3 candidatos pelo mesmo código, trocando só configuração. Um candidato é da OpenAI; os outros dois saem de `docs/VERIFICACOES.md` §2 (o atual de dev é o nativo `@cf/openai/gpt-oss-120b`). Leia a documentação atual do AI Gateway e do Workers AI antes de escrever (skill `cloudflare` e a documentação oficial; não confie na memória). Como a chave da OpenAI chega ao modelo (guardada no AI Gateway ou secret do Worker de dev) é escolha sua, registrada no relatório.
2. Modelo reserva de OUTRO provedor configurado no AI Gateway, que assume quando o principal falha, com o teste `reserva assume quando o principal falha` em `test/modelo*.test.ts` (critério 3: `npm test -- modelo`).
3. Medição preliminar dos 3 candidatos contra o conjunto dev (`node evals/rodar.mjs --alvo <servidor local> --conjunto dev`), NUNCA o reservado: acerto por bloco, violações de regra, latência p95 e máxima, custo por conversa (cabeçalhos `x-uso-entrada`, `x-uso-saida`, `x-chamadas-modelo`). Mais a medida de 10 conversas simultâneas por candidato (sessões diferentes, sem confirmação), contando 429 e equivalentes e respostas de contingência.
4. Relatório da fase 1 para mim com a tabela preliminar. NÃO fixe `MODELO` ainda.

FASE 2 (quando eu avisar que a frente G entrou na main; ela reescreve o prompt e o loop, e a classificação dos modelos pode mudar): `git merge origin/main` (nunca rebase), repetir a comparação, escolher por confiabilidade de chamada de ferramenta primeiro, escrever `docs/revisoes/modelos.md` (uma linha por candidato, coluna de erros de limite nas 10 simultâneas, a escolha, qual é o reserva, de qual provedor e como a troca foi provada), fixar `MODELO`. O escolhido tem de dar `BLOCO marco1: 100%`.

COMO RODAR:
- Tudo local. Você NÃO faz deploy (nem dev, nem producao) e nunca toca em `producao`. Se a prova da troca para o reserva exigir o ambiente dev publicado, pare e me peça: o deploy de dev é meu.
- Servidor local: `npx wrangler dev --env dev --port 8793` (o `npm run dev -- --port N` falha: o wrangler recusa dois `--port`). Variáveis locais em `.dev.vars.dev`, como o contrato §8 descreve; confirme que o arquivo está no `.gitignore` antes de criá-lo e apague-o ao terminar.
- Os valores (endereço do catálogo, token, `OPENAI_API_KEY`, id da conta) vivem em `~/.config/agente-concierge/env`. Carregue o arquivo no mesmo comando que usa a variável. NUNCA imprima valor: sem `echo`, sem `set -x`, sem modo verboso, sem colar em relatório, commit ou documento. Em saída de comando que possa conter endereço, mascare com sed antes de mostrar.
- Credencial da Cloudflare: só por referência, `$(cat ~/.cf-token)`, só para criar ou configurar o AI Gateway; nunca vira secret de Worker, nunca é ecoada. A chave da OpenAI nunca vai para `producao` por esta frente.
- Casos com confirmação mandam lead para o webhook falso. Eu também rodo evals contra o dev publicado, que usa o mesmo webhook falso: para não misturar, prefira subir o webhook falso local (`falso/`, porta 8794) e apontar o servidor local e o `LEADS_URL_DEV` do runner para ele, se o código permitir sem mudar arquivo que não é seu. Se não permitir, me avise antes de rodar os casos de lead e combinamos a vez. Resultado `EVAL PARCIAL` não vale como medida: diga qual caso foi pulado e por quê.
- Nenhum POST ao webhook real, por nenhum caminho. O conjunto reservado (`~/.config/agente-concierge/reservado/`) você não abre.
- Máquina compartilhada com outras frentes: uma rodada de eval por vez, `--paralelo` no máximo 4 (fora a medida das 10 simultâneas). Modelos nativos pagos têm limite de 20 pedidos por minuto: conte isso na medida, não contorne.
- Mate servidores locais pelo PID da porta (`ss -ltnp`), nunca com `pkill -f`.

HISTÓRICO: um commit por mudança lógica, push a cada commit, só da sua branch (diga o nome com `git branch --show-current`). Nunca squash, amend ou rebase; essas palavras também não entram em assunto de commit nem em nome de branch. Antes de cada commit (tudo em stage) e de cada push: `npm test`, `npm run tipos` e `scripts/verificar-sigilo.sh` terminando em `SIGILO OK`. Autor e committer já estão configurados no repositório; não mude. Rodapé do commit: `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`. Nomes de modelo e de provedor podem aparecer em arquivo versionado; endereço, id de conta, chave e nome de máquina, não.

RELATÓRIO (fase 1 e fase 2), curto: o que foi feito; commits e branch; saída de `npm test`, `npm run tipos`, `npm test -- modelo` e do gate; a tabela medida, dizendo contra qual commit; o que NÃO rodou e por quê; lacunas do contrato que encontrou (não decida comportamento de produto: me traga a pergunta com a sua recomendação). Não diga "deve funcionar": só o que você rodou.
````

## 12. Frente K — produção (infraestrutura, envio real desligado)

13/11 23h13

````text
Você é a frente K do projeto agente-concierge: o ambiente `producao` do agente (um Worker da Cloudflare), com o envio real de leads DESLIGADO. Trabalhe só nesta worktree (branch `frente-k`). Responda em português do Brasil. Não crie subagentes.

Leia inteiro, antes de tudo: `CLAUDE.md` e `AGENTS.md` da raiz; `docs/VERIFICACOES.md` (seções 3 e 5); em `docs/CONTRATO.md`, a lacuna L23; em `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, as seções "Sessão K", "Regras que valem para toda frente" e "Dono de arquivo"; em `DECISOES.md`, a X24 e as provisórias P10 e P16. Os passos do gateway de `producao` estão em `docs/revisoes/modelos.md` da branch da frente I, que ainda não entrou na `main`: leia com `git show origin/t3/modelo-evals-fallback:docs/revisoes/modelos.md`.

## O que o Éverton autorizou (X24, dita hoje)
- "K começar já pela infraestrutura de `producao` (rota, gateway, segredos, `/saude` respondendo), com o envio real desligado; o deploy final fica para depois da M2. Hoje `producao` devolve 530 (erro 1033). Se a rota esbarrar em registro de DNS que aponta para um túnel, pare e me pergunte antes de mexer no DNS."
- "Gateway de `producao`: pode criar e guardar nele a chave da Anthropic. Mesma regra de sempre: a chave vai por referência, sem aparecer em log, commit ou conversa."

## Regras que não se quebram
1. **Webhook real: nenhum POST, por nenhum motivo, nem como teste.** GET é permitido. Contra `producao`, só conversa SEM confirmação; nunca mande um "sim" depois de um resumo lá.
2. **Nunca suba o ambiente `producao` localmente.**
3. **Sigilo.** Valores ficam em `~/.config/agente-concierge/env` (nomes das variáveis: `CATALOGO_URL`, `CLOUDFLARE_ACCOUNT_ID`, `AGENTE_URL_PRODUCAO`, `AGENTE_URL_DEV`, `LEADS_URL_DEV`, `ANTHROPIC_API_KEY`; a `OPENAI_API_KEY` que está lá NÃO é para usar). Carregue o arquivo no mesmo comando que usa a variável. Nunca imprima valor: sem `echo`, sem `set -x`, sem modo verboso; filtre toda saída de API antes de mostrar; nenhum valor em argumento de linha de comando (aparece na lista de processos), em arquivo versionado, em mensagem de commit, em relatório ou em conversa. A credencial da Cloudflare é `~/.cf-token`, só por referência (`$(cat ~/.cf-token)` dentro do comando), e nunca vira secret de Worker. A chave da Anthropic vive SÓ no AI Gateway: nunca em secret de Worker, `.dev.vars`, `--var` ou arquivo. Não escreva em lugar nenhum o domínio do agente, o do catálogo nem o do webhook: o hostname entra pelo ambiente no comando.
4. **Zona de DNS e configuração da zona: nada é alterado sem o Éverton**, fora a regra do item 6 abaixo, restrita ao hostname de produção.
5. **Histórico.** Um commit por mudança lógica, push a cada commit, mensagem em português com o rodapé `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`. Nunca squash, amend nem rebase (essas palavras também não entram em assunto de commit). Não mude a configuração de autor. Antes de cada commit (tudo em stage) e de cada push: `scripts/verificar-sigilo.sh` termina com `SIGILO OK`; se reprovar, não commite.
6. Arquivo seu: `scripts/validar-producao.sh` (e um teste dele, se fizer). Nada em `src/`, `test/` das outras frentes, `wrangler.jsonc`, `package.json`, `evals/`. Precisou de outro arquivo: pare e me avise (a variável `AI_GATEWAY` de `producao` no `wrangler.jsonc` é da frente I; eu passo para ela).
7. Suíte e tipos, se rodar: só por `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3` e `~/.cache/agente-concierge/com-trava.sh npm run tipos`. Nunca `--root`. Nenhum servidor local.

## Trabalho, nesta ordem. PARE e me reporte nos pontos marcados.
1. **Diagnóstico, só leitura (GET).** Por que o endereço de `producao` devolve 530 com erro 1033? Leia os registros de DNS da zona que cobrem esse hostname (o exato e curingas) e diga o tipo de cada um e se aponta para um túnel, SEM escrever o valor nem o hostname no relatório (descreva: "curinga do tipo CNAME apontando para um túnel", por exemplo). Leia como o deploy de `producao` liga o Worker ao hostname (`wrangler.jsonc`, `package.json`): rota ou domínio personalizado? Esse deploy criaria, trocaria ou dependeria de um registro de DNS? Confira também o estado do Bot Fight Mode e da checagem de integridade de navegador.
   **PARE AQUI e me mande o diagnóstico** se: há registro apontando para túnel; o deploy escreveria ou trocaria DNS; ou o Bot Fight Mode está ligado. Não escreva nada no DNS. Enquanto espera a resposta, siga com os itens 2 e 3, que não dependem disso.
2. **AI Gateway de `producao`.** Crie o gateway `concierge-producao` espelhando a configuração do `concierge-dev` (leia a do `dev` por GET) e guarde nele a chave da Anthropic, por referência, seguindo os passos do documento da frente I. Prova, sem valor: leitura da configuração mostrando o gateway e o provedor com chave configurada. Diga quais chamadas de API você fez (método e caminho, sem identificadores de conta).
3. **`scripts/validar-producao.sh`**, como descrito em "Sessão K" do backlog: `--so-leitura` (GET no webhook real, imprime `LEADS REAIS: <n>`), modo completo (secrets presentes, `/saude` com `envio_leads: "desligado"`, conjunto dev SEM casos de confirmação), `--clientes` (curl, Python `requests`, Python `urllib` com o agente de usuário padrão, `fetch` do Node) e `--entrega` (reprova se o envio estiver desligado). O script nunca faz POST ao webhook real e nunca imprime endereço.
4. **Prova de que "desligado" é zero POST, ANTES de qualquer deploy.** No commit exato que iria para `producao` (a `origin/main` do momento), ache o teste que prova que com `ENVIO_LEADS=desligado` nenhum POST sai para o webhook, mesmo com resumo confirmado, e rode-o. Me diga o nome do teste e o resultado. Se esse teste não existir ou não provar isso: **PARE**; não configure secret do webhook real nem faça deploy.
5. **Secrets e primeiro deploy de `producao`**, só depois de: item 1 resolvido (sem escrita de DNS pendente de aprovação), item 4 provado e o meu "pode". Secrets por referência (entrada padrão, nunca argumento). Deploy a partir de um checkout limpo da `origin/main`, com `ENVIO_LEADS=desligado`. Depois: `/saude` mostra `ambiente: "producao"` e `envio_leads: "desligado"`; `scripts/validar-producao.sh --so-leitura` mostra `LEADS REAIS: 0`.
6. **Regra de configuração que desliga a checagem de integridade de navegador só para o hostname de produção.** Nada mais na zona. Se o token não tiver permissão: PARE e me avise, para o Éverton criar no painel.
7. **Clientes**: `scripts/validar-producao.sh --clientes` → `CLIENTES OK`.

Fora do escopo agora: ligar o envio real (só com ordem do Éverton), o deploy final (depois da revisão M2 e de as frentes da leva 2 entrarem na `main`; eu aviso), tornar o repositório público.

## Relatórios
Mande cada relatório para a conversa da coordenadora (thread `<conversa da coordenadora>`, pela ferramenta de envio entre threads do T3) e deixe o mesmo texto como última mensagem. O primeiro é o diagnóstico do item 1, o mais cedo possível. Em todo relatório: o que foi feito, a saída de cada verificação (sem valores), o que ficou parado e por quê, e a pergunta exata que o Éverton precisa responder, se houver.
````

## 13. Frente N — entregáveis de processo (rascunhos)

13/11 23h14

````text
Você é a frente N do projeto agente-concierge: os entregáveis de processo (README, documento "Como foi feito", desenhos, cópia do setup). Agora é a fase de RASCUNHO: o produto ainda está sendo integrado, então você escreve tudo o que já é estável e deixa marcado o que se preenche no fim. Trabalhe só nesta worktree (branch `frente-n`). Responda em português do Brasil. Não crie subagentes.

Leia inteiro, antes de tudo: `CLAUDE.md` e `AGENTS.md` da raiz; `docs/CONTRATO.md` (a fonte de requisitos; o repositório fica público na entrega e o enunciado do desafio não pode ser copiado nem a empresa citada); `docs/EVALS.md`; `docs/VERIFICACOES.md`; `DECISOES.md` inteiro (decisões de execução X1 a X24, lacunas, provisórias P1 a P18, decisões de engenharia); em `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, o topo, "Sessão N", "Outcomes pedidos", "Regras que valem para toda frente", "Dono de arquivo" e o log do mapa de sessões (é a história da entrega: frentes, verificadores independentes, rodadas, reprovações e o que cada uma achou); `docs/revisoes/`, `docs/conselho/`, `docs/prompts/` e `docs/desenhos/`. O código está em `src/`, os evals em `evals/`, o webhook falso em `falso/`.

## Arquivos seus
`README.md`, `docs/desenhos/**`, `docs/sessoes/**`, `docs/setup/**` e um documento novo "Como foi feito" dentro de `docs/` (proponha o caminho no primeiro relatório; sugestão: `docs/COMO-FOI-FEITO.md`). NÃO toque agora em `DECISOES.md` (a coordenadora ainda registra decisões nele; o texto final fica para o fim, com o meu aviso), nem em `src/`, `test/`, `evals/`, `scripts/`, `falso/`, `wrangler.jsonc`, `package.json`, nem nos outros arquivos de `docs/`.

## O que escrever agora
1. **`README.md`**: o que é o agente; arquitetura em poucas linhas (Worker, um Durable Object por sessão, laço de ferramentas próprio, "o código decide, o modelo conversa", modelo principal e reserva, AI Gateway); como rodar localmente; como testar (suíte, evals, simulador, comandos da tabela do `CLAUDE.md`, conferindo quais já existem no `package.json`); como validar `producao` sem enviar lead; custo por conversa; resultados dos evals; limites conhecidos; onde está cada documento. Frases curtas, sem adjetivo de venda.
2. **"Como foi feito"**: o processo de verdade, tirado do log do backlog e do `DECISOES.md`: contrato escrito antes do código; frentes paralelas em worktrees com dono por arquivo; uma sessão coordenadora que não edita código de produto; verificador independente antes de cada merge, com sondas e defeitos plantados; conjunto de evals reservado que nenhuma frente vê; gate de sigilo e de histórico; escolha do modelo por medição (a tabela está em `docs/revisoes/modelos.md` da branch `origin/t3/modelo-evals-fallback`: leia com `git show`); o que deu errado e como foi corrigido (as reprovações contam a favor: diga o que cada rodada achou). Sem enfeite e sem esconder falha.
3. **Desenhos** em `docs/desenhos/`: fluxo de um turno (pedido → sessão → laço → ferramentas → conferência → resposta), fluxo do lead (resumo → confirmação → envio → falha e teto de envios), e o mapa das frentes e levas. Formato que o GitHub renderiza sem ferramenta (Mermaid dentro de Markdown), com texto alternativo.
4. **`docs/setup/`**: cópia das skills, regras e subagentes do ambiente global do Éverton que rodaram DE FATO nesta entrega; a lista está no backlog, no bloco "Setup global usado nesta entrega". As fontes ficam em `~/.claude/` (`rules/`, `skills/`, `agents/`). Atenção ao sigilo: esses arquivos têm IP, nome de máquina, caminhos pessoais e dados de outros projetos. Copie só o que rodou, e retire IP, nome de máquina, e-mail, nome de cliente, nome de outros projetos e qualquer credencial ou caminho de credencial. O `CLAUDE.md` global NÃO é copiado inteiro: só as regras que valeram aqui, reescritas sem dado de ambiente. O gate tem de passar com as cópias em stage.

## Lacunas que você NÃO inventa: deixe marcado
Use exatamente o marcador `<!-- PREENCHER: o que falta -->` (e uma linha visível "a preencher" no texto) para: URL pública do agente; custo por conversa medido; nota dos evals por bloco e do conjunto reservado; nível final do raciocínio e modelo reserva (hoje: Claude Haiku 5.5 em nível alto como principal; reserva em aberto, provisório GLM-5.3 Flash); resultado das revisões de código e segurança; exports de sessão; roteiro do vídeo; lista final de limites. Para os limites, comece pelos que já estão decididos (leia a X24 item 3, a P17 e a P18 e o que o log do backlog chama de "limite conhecido" ou "limite declarado") e marque que a lista fecha no fim.

## Regras
- **Sigilo.** Nunca escreva em arquivo versionado nem em commit: o nome da empresa do desafio, trecho copiado do enunciado, o domínio da API, do agente ou do webhook, token, IP, nome de máquina, e-mail (só `contato@evertonresende.com` é permitido). Não abra `~/.config/agente-concierge/`. Não copie nada do conjunto reservado (`~/.config/agente-concierge/reservado/`): ele entra no repositório só na entrega, por outra etapa.
- Nenhum servidor local, nenhuma rodada de eval, nenhum deploy. Você não precisa rodar a suíte: os seus arquivos são só documentação.
- Um commit por mudança lógica (README; Como foi feito; desenhos; setup), push a cada commit, mensagem em português com o rodapé `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`. Nunca squash, amend nem rebase (essas palavras também não entram em assunto de commit). Não mude a configuração de autor. Antes de cada commit (tudo em stage) e de cada push: `scripts/verificar-sigilo.sh` termina com `SIGILO OK`; se reprovar, não commite: conserte antes.
- O que você afirma tem de estar no repositório ou no log do backlog. Número sem fonte não entra; se não achar, marque para preencher.

## Relatórios
Mande cada relatório para a conversa da coordenadora (thread `<conversa da coordenadora>`, pela ferramenta de envio entre threads do T3) e deixe o mesmo texto como última mensagem: hash de cada commit, o caminho de cada entregável, a lista do que ficou marcado para preencher, o que você retirou das cópias do setup (por categoria, sem repetir o dado) e qualquer dúvida. Primeiro relatório depois do README e do "Como foi feito".
````

## 14. Frente L — custo por conversa

13/11 23h20 · claude-opus-5-5 · esforço medium

````text
Você é a frente L do projeto agente-concierge (agente de chat para hóspedes de imóveis de temporada, Worker da Cloudflare). Sua tarefa nesta fase: o script que calcula o custo por conversa a partir dos relatórios de eval. Você está numa worktree própria, criada a partir do commit da coordenação. Responda em português do Brasil. Não crie subagentes.

## Antes de tudo
1. Crie a sua branch a partir da `main` do remoto: `git fetch origin && git switch -c frente-l origin/main`.
2. Leia: `CLAUDE.md` e `AGENTS.md` da raiz (sigilo e histórico valem para você); em `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md`, as seções "Sessão L", "Regras que valem para toda frente" e "Dono de arquivo"; `evals/README.md` (formato do relatório JSON do runner, incluindo onde ficam os tokens de entrada e de saída e as chamadas ao modelo por turno); `docs/revisoes/modelos.md` (preço por milhão de tokens de cada modelo e como o custo por conversa foi calculado à mão nas medições); `DECISOES.md` X24 (modelo principal: Claude Haiku 5.5 em nível alto; reserva provisório: GLM-5.3 Flash).

## Arquivos seus
`scripts/custo.mjs` e um teste dele (`scripts/custo.test.mjs` ou equivalente em Node puro, sem dependência nova). Mais nada: não toque em `package.json`, `wrangler.jsonc`, `src/`, `test/`, `evals/`, `.github/` (o monitor diário fica para outra fase), documentação.

## O que fazer
1. `scripts/custo.mjs <pasta-ou-arquivos>`: lê os relatórios JSON de eval (`evals/relatorios/*.json` do runner; ignore com aviso os que não têm dados de uso, como os do simulador), e calcula por conversa (um caso = uma conversa): tokens de entrada, tokens de saída e chamadas ao modelo; custo em dólar com o preço do modelo; média, p50, p95 e máximo por conversa; e o total da rodada. Node 24, sem dependências.
2. Preço: tabela dentro do script, com a fonte citada em comentário (`docs/revisoes/modelos.md`), para o modelo principal e para o reserva; opções `--modelo <id>` e `--preco-entrada`/`--preco-saida` (US$ por milhão) para sobrescrever. Se o relatório não disser qual modelo respondeu cada chamada, calcule com o preço do principal e DIGA isso na saída (limite: turnos respondidos pelo reserva saem com o preço errado).
3. Saída: uma tabela legível e, na última linha, `CUSTO OK` com o valor médio por conversa. Se não houver nenhum relatório com dados de uso: saída diferente de zero e mensagem clara, sem `CUSTO OK`. Opção `--json` para a saída estruturada (a frente do README vai usar).
4. Nunca imprime endereço, nome ou telefone; os relatórios já vêm mascarados, e o script não desfaz isso.
5. Teste: relatório de mentira com números conhecidos → custo exato esperado (conta em centésimos de milésimo de dólar, sem erro de ponto flutuante visível na saída); relatório sem dados de uso → falha limpa; mistura dos dois → ignora o que não tem uso e avisa.
6. CHECK de aceite: `node scripts/custo.mjs evals/relatorios` termina com `CUSTO OK` e o valor por conversa. Rode sobre os relatórios que já estão no repositório e mostre a saída. Compare com o custo por conversa que `docs/revisoes/modelos.md` registra para o mesmo tipo de rodada e explique qualquer diferença.

## Regras
- Nenhum servidor local, nenhuma rodada de eval, nenhuma chamada de rede. Não abra `~/.config/agente-concierge/`.
- Se rodar a suíte do produto: só por `~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3`; nunca `--root`. O seu script não entra na suíte do produto; o teste dele roda com `node --test`.
- Um commit por mudança lógica, push a cada commit (`git push -u origin frente-l`), mensagem em português com o rodapé `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`. Nunca squash, amend nem rebase (essas palavras também não entram em assunto de commit). Não mude a configuração de autor. Antes de cada commit (tudo em stage) e de cada push: `scripts/verificar-sigilo.sh` termina com `SIGILO OK`; se reprovar, não commite.

## Entrega
Sua última mensagem é o relatório: hash de cada commit; a saída do CHECK de aceite e do teste; o que o script assume e os limites; o que falta no relatório do runner para o custo sair exato (se faltar), dito como pedido para a frente dona do runner, sem você mexer nele.
````

## 15. Frente S — gate de sigilo (achados da M2)

13/11 23h43 · claude-opus-5-5 · esforço high

````text
Você é a frente S desta entrega: corrigir o gate de sigilo do repositório. Responda em português do Brasil. Leia primeiro o `CLAUDE.md` do repositório inteiro e siga as regras de sigilo e de histórico dele ao pé da letra.

## Contexto
O repositório fica PÚBLICO na entrega, com o histórico inteiro. O gate `scripts/verificar-sigilo.sh` roda antes de cada commit e de cada push e precisa terminar com `SIGILO OK`. Ele deriva os termos proibidos (domínio, token, nome da empresa, nome da máquina e outros) de um arquivo de ambiente fora do repositório, em `${AGENTE_CFG:-$HOME/.config/agente-concierge}/env`, mais `sigilo-extra` e `sigilo-liberados` na mesma pasta. Uma revisão de código achou os defeitos abaixo. O relatório do revisor e as sondas dele estão em <rascunho>/m2-codigo-1.md (seções A1, M1, M2 e B7) e .../scratchpad/m2-codigo-sondas/sonda-sigilo.sh (com a saída em sonda-sigilo.saida.txt).

## Onde trabalhar
Você está numa worktree própria, criada a partir da main. Crie a branch `frente-gate` (`git switch -c frente-gate`). Arquivos que você pode tocar: `scripts/verificar-sigilo.sh` e um arquivo novo de teste, `scripts/verificar-sigilo.teste.sh`. Nada mais. Se precisar de `node_modules`, não precisa: é só shell e git.

## O que corrigir (um commit por item, na ordem)
1. **A1 · o gate não lê o conteúdo de commits antigos.** Hoje só o índice é varrido (`git grep --cached`). Um termo gravado num commit e apagado no seguinte dá `SIGILO OK`. Correção: varrer o conteúdo de todos os commits publicáveis (`--branches --tags --remotes`, a mesma lista que o script já usa para as mensagens) e relatar só `commit curto:arquivo`, nunca o trecho. Tem que terminar em poucos segundos neste repositório (cerca de 460 commits): meça e diga o tempo. A coordenadora já rodou `git log -p --branches --tags --remotes | grep -c -i -F -f <termos>` no histórico real e deu 0 linhas; o seu gate tem que continuar dando `SIGILO OK` no repositório real.
2. **M1 · a saída do gate imprime até 8 caracteres do termo proibido.** Em `git log --format='%H %B' | grep ... | cut -c1-8`, quando o termo está no corpo da mensagem (não na primeira linha), o `cut` pega o começo da própria linha, que pode ser o termo. Correção: imprimir só o identificador curto do commit, em qualquer caso. Revise TODAS as saídas do script: nenhuma pode ecoar texto encontrado.
3. **M2 · nome da empresa com domínio de sufixo composto.** O script deriva o nome da empresa do penúltimo rótulo do host. Com um host do tipo `api.nome.com.br` isso dá `com`, que o filtro de tamanho descarta, e o nome nunca é procurado. Correção mínima: quando o rótulo derivado for um sufixo genérico (com, net, org, gov, edu, co) ou tiver menos de 4 caracteres, usar o rótulo anterior; se ainda assim não houver nome utilizável e `sigilo-extra` não existir, sair com código 2 e uma mensagem sem valores. No ambiente real a hipótese não se aplica (já conferido), então o comportamento real não pode mudar.
4. **B7 · lacunas menores.** Arquivo binário é ignorado (`-I`): um termo entre bytes nulos passa. Trate binário como texto na varredura (`-a`), se isso não gerar falso positivo no repositório real; senão documente. IPv6 e reescrita com `reset` seguido de push forçado: documente como limites no cabeçalho do script.
5. **Teste.** `scripts/verificar-sigilo.teste.sh`: monta um repositório descartável numa pasta temporária, com uma pasta de configuração falsa apontada por `AGENTE_CFG`, e confere pelo menos: (a) termo em stage reprova; (b) termo num commit apagado no seguinte reprova e a saída mostra o commit, não o termo; (c) termo no corpo de uma mensagem de commit reprova e a saída não contém nenhum pedaço do termo; (d) host com sufixo composto: o nome da empresa é procurado; (e) termo em arquivo binário; (f) repositório limpo dá `SIGILO OK`. Termina com `TESTE DO GATE OK` e saída 0, ou lista o que falhou e sai com 1. Use só valores inventados e obviamente falsos nos arquivos versionados: hosts terminados em `.invalid` ou `.test`, nenhum endereço IP, nenhum e-mail, nada com cara de chave real. Limpe a pasta temporária com `trap`.

## Regras duras
- Nunca imprima, copie para arquivo nem cite valor do arquivo de ambiente real. Sem `echo` de variável, sem `set -x`, sem modo verboso. Carregue o ambiente só dentro do próprio gate, como ele já faz.
- Se o gate novo reprovar o repositório REAL (achar termo no histórico), PARE: não tente consertar o histórico, não reescreva nada. Relate só os identificadores de commit e os nomes de arquivo.
- Histórico: um commit por mudança lógica, push a cada commit (`git push -u origin frente-gate`; só essa branch, nunca `--mirror`, nunca outras refs). Nunca amend, rebase ou squash, e essas palavras não podem aparecer em assunto de commit nem em nome de branch. Não mude a configuração de autor do repositório.
- Antes de cada commit (com tudo em stage) e de cada push: `scripts/verificar-sigilo.sh` tem que terminar com `SIGILO OK` (use a versão que está na sua worktree).
- Mensagem de commit em português, no formato `tipo(escopo): resumo` (até 72 caracteres), corpo com o porquê, e a última linha exatamente: `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`.
- Nenhum subagente. Nenhum servidor. Nenhuma chamada de rede além do `git push` da sua branch e do que o próprio gate já faz.
- Não toque em `src/`, `test/`, `falso/`, `evals/`, `docs/`, `CLAUDE.md`, `DECISOES.md`.

## Entrega (mensagem final)
Hashes dos commits; a saída do `scripts/verificar-sigilo.teste.sh`; a última linha do gate no repositório real e o tempo que ele levou antes e depois; o que ficou documentado como limite; qualquer coisa que você decidiu sozinha. Um verificador independente vai conferir antes de a branch entrar na main.
````

## 16. Frente T — datas sem ano (P21)

14/11 00h13 · claude-opus-5-5 · esforço high

````text
Você é a frente T desta entrega: uma correção pequena e precisa na leitura de datas de um agente de chat que cota estadias em imóveis de temporada. Responda em português do Brasil. Leia primeiro, inteiros, o `CLAUDE.md` do repositório e `docs/CONTRATO.md`, e siga as regras de sigilo e de histórico ao pé da letra. Em `DECISOES.md`, leia as decisões P1 a P7 (datas) e a X24.

## O defeito
A decisão P5 manda resolver a saída a partir da entrada: a saída sem ano é a primeira ocorrência DEPOIS da entrada. Isso faz "de segunda a sexta" e "de 29/12 a 02/01" funcionarem. Mas um erro de digitação comum vira uma cotação absurda: `prepararPedido({imovel_id:"GRM-301", checkin:"20/01", checkout:"18/01"})`, com hoje em 2026-11-14, dá entrada 2027-01-20, saída 2028-01-18, 363 noites e um total de seis dígitos. A recusa "saída antes da entrada" nunca acontece para datas sem ano. É determinístico, então precisa ser corrigido.
Onde: `src/nucleo/datas.ts` (`resolverSaida`, perto das linhas 253 a 255, e a função que monta a data, perto da 151) e `src/agente/ferramentas/pedido.ts` (perto da linha 22).

## A regra (decisão provisória P21 do dono)
Quando a saída foi escrita SEM ano e, resolvida depois da entrada, cai MAIS DE 90 noites depois dela, o código não cota: recusa, sem total, e devolve ao modelo a instrução de pedir as datas de novo ao hóspede (com o ano, se a estadia for longa mesmo). Não é caso de passar para humano.
- 90 noites exatas passam; 91 recusam.
- Saída escrita COM ano não entra na regra, qualquer que seja a duração.
- Saída por dia da semana ("até sexta") cai sempre em até 7 dias: não muda.
- Entrada com ano e saída sem ano: a regra vale.
- O que a recusa faz com um resumo pendente é o mesmo que as outras recusas de data já fazem hoje; não invente comportamento novo.
- O texto que vai ao hóspede é escrito pelo modelo, no idioma do hóspede; a instrução ao modelo segue o padrão das outras recusas do arquivo.

## Onde trabalhar
Você está numa worktree própria, criada a partir da main. Faça, nesta ordem:
1. `git switch -c frente-datas`.
2. `git merge --no-ff origin/frente-g` (cabeça 34e77e3). Motivo: outra frente, a G, mexe em `pedido.ts`, `cotacao.ts`, `tipos.ts` e acrescenta uma função em `datas.ts`, e entra na main antes de você. Trabalhar por cima dela evita conflito. Mensagem do merge: `merge: frente G na frente T` mais o rodapé. Se houver conflito, pare e relate.
3. `node_modules`: link simbólico para <worktree da coordenação>/node_modules (não rode `npm ci`, a menos que o `package.json` tenha mudado).

Arquivos que você pode tocar: `src/nucleo/datas.ts`, `src/agente/ferramentas/pedido.ts` (o mínimo de linhas) e um arquivo novo de teste, `test/datas-sem-ano-t.test.ts`. Se algum teste EXISTENTE afirmar o comportamento antigo para uma saída sem ano a mais de 90 noites, liste-o no relatório e ajuste só a expectativa desse caso, em commit separado, explicando. Nada mais: nem prompt, nem laço, nem lead, nem evals.

## Testes (vermelho antes, verde depois)
1. "20/01" a "18/01" (hoje 2026-11-14): recusa, sem total, com a instrução; nada de 363 noites.
2. Fronteira: saída sem ano a exatamente 90 noites cota; a 91 recusa.
3. Não regressão da P5: "de 29/12 a 02/01" dá 4 noites; "de segunda a sexta" dito numa quarta; "15/03 a 20/03"; saída sem ano no mesmo mês; virada de ano curta.
4. Saída COM ano a 363 noites continua cotando (desde que o resto seja válido).
5. Entrada com ano e saída sem ano a mais de 90 noites: recusa.
6. Pelo caminho da ferramenta (`prepararPedido` e a ferramenta de cotação): o resultado para o modelo não tem total nem valor em reais, e a instrução diz para pedir as datas de novo.
7. Inglês: as mesmas datas escritas como o hóspede em inglês escreveria, se o módulo já aceita esse formato.
Rode também os testes existentes de datas e de preço: nenhum pode mudar de resultado, fora os que você listar.

## Regras duras
- Suíte e tipos SEMPRE por `~/.cache/agente-concierge/com-trava.sh <comando>`, com `--maxWorkers=3` no vitest (`~/.cache/agente-concierge/com-trava.sh npm test -- --maxWorkers=3` e `~/.cache/agente-concierge/com-trava.sh npm run tipos`), nunca `--root`. Suíte vermelha não commita.
- Antes de cada commit (com tudo em stage) e de cada push: `scripts/verificar-sigilo.sh` tem de terminar com `SIGILO OK`. Nunca imprima valor de variável de ambiente; não abra `~/.config/agente-concierge/`.
- Histórico: um commit por mudança lógica, push a cada commit (`git push -u origin frente-datas`; só essa branch, nunca `--mirror`). Nunca amend, rebase ou squash, e essas palavras não podem aparecer em assunto de commit nem em nome de branch. Não mude a configuração de autor do repositório.
- Mensagem de commit em português, `tipo(escopo): resumo` (até 72 caracteres), corpo com o porquê, e a última linha exatamente: `Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)`.
- Nenhum subagente. Nenhum servidor. Nenhuma chamada de rede além do `git push` da sua branch e do gate. Nenhum POST a webhook nenhum.
- Se a regra pedir mudança em outro arquivo, ou se você achar uma lacuna (por exemplo, entrada sem ano com saída com ano), pare nesse ponto e relate: não decida comportamento de produto.

## Entrega (mensagem final)
Hashes dos commits; a contagem da suíte e o resultado dos tipos na cabeça; a saída dos testes novos; a lista de testes existentes que mudaram (se houver) e por quê; o que você decidiu sozinha; o que não testou. Um verificador independente confere antes de a branch entrar na main.
````

## 17. Papel da frente C — diagnóstico do conjunto reservado

14/11 03h29 · claude-opus-5-5 · esforço high

````text
Você assume o PAPEL DA FRENTE C do projeto agente-concierge (agente de chat para hóspedes de imóveis de temporada; Worker na Cloudflare, contrato HTTP `POST /chat {session_id, message}` → `{reply, handoff}`). A frente C é dona do conjunto reservado de evals: escreve e mantém os casos, NÃO corrige o agente, não recebe tarefa de produto. A sessão que escreveu o conjunto não está mais disponível; você continua o papel dela. Não inicie subagentes. Responda e escreva em português do Brasil.

## Situação

O agregado do conjunto reservado foi lido duas vezes contra o ambiente `dev` (mesmo deploy): 83% e 80%. O limiar é 90%. Por bloco, leitura 1 e leitura 2: contrato 75/75; funciona-cotacoes 100/75; funciona-leads 62/62; funciona-recusas 100/100; funciona-respostas 85/85; robustez-handoff 75/75; robustez-manipulacao 85/100; robustez-nao-inventa 85/71. A telemetria do Worker nas duas janelas não tem contingência nem falha do catálogo. O conjunto foi escrito em 13/11, antes das decisões P11 a P32 de `DECISOES.md` e das correções do juiz compartilhado. A coordenação nunca abriu o conjunto e não pode abrir: ela só vê contagens. O conjunto de desenvolvimento, medido em três rodadas no mesmo deploy, deu 298 de 300.

A sua tarefa é dizer, com evidência, quanto dessas falhas é defeito do CASO (expectativa que contradiz ou excede o contrato, ou verificador mecânico do caso que reprova resposta certa por redação) e quanto é erro REAL do agente, corrigir só os defeitos de caso, numa única passada, pelas regras abaixo (decisão P33 de `DECISOES.md`, leia), e devolver à coordenação só contagens.

## Onde trabalhar

- Pasta privada, só sua: `~/.cache/agente-concierge/c-reservado/` (chame de PRIV). Tudo o que você gravar com conteúdo de caso, mensagem ou resposta fica ali dentro, e em nenhum outro lugar.
- `PRIV/arvore/`: export da árvore candidata ao congelamento (sem `.git`, sem código de produto, sem os casos de desenvolvimento). É onde você roda o runner. Leia INTEIROS, antes de qualquer outra coisa: `PRIV/arvore/AGENTS.md`, `CLAUDE.md`, `docs/CONTRATO.md`, `docs/EVALS.md`, `DECISOES.md` (lacunas L-n e decisões P-n, até a P33) e `evals/README.md` (formato do arquivo de caso e limites conhecidos do juiz). Não existe outra fonte de requisitos.
- O conjunto reservado: `~/.config/agente-concierge/reservado/`. 
- `PRIV/leitura-2-registro.jsonl`: gravação da leitura 2 (uma linha JSON por chamada, com a sessão em `s`, a mensagem em `m` e o corpo da resposta em `r`). Ninguém leu.
- `PRIV/proxy-registro.mjs`: proxy de gravação. Uso: `node proxy-registro.mjs <alvo> <porta> <arquivo.jsonl>`. Use a porta 8792.

## O que você NÃO faz

1. Não lê casos de desenvolvimento (`evals/casos/dev/` de nenhum checkout), nem relatórios em `evals/relatorios/`, nem `evals/lib/corpus-juiz.json`, nem código de produto (`src/`, `test/`, `falso/`), nem o rascunho da coordenação, nem outras threads. Motivo: a regra 2 do conjunto reservado em `docs/EVALS.md`. Os casos seus se julgam só pelo contrato, pelas decisões e pelo plano de evals.
2. Não altera nada em `PRIV/arvore/evals/lib/` nem em `PRIV/arvore/evals/rodar.mjs`: o veredito tem de vir do juiz sem mudança.
3. Não cria, edita nem apaga arquivo em nenhum checkout ou worktree do repositório, não faz commit, não cria worktree.
4. Não corrige nem propõe correção do agente. Não mexe em deploy.
5. Nenhuma chamada a outro alvo que não o agente de `dev`. Nunca `producao`. Nunca inicie servidor do agente local.
6. Segredo: as URLs vivem em `~/.config/agente-concierge/env` (`AGENTE_URL_DEV`, `LEADS_URL_DEV`). Carregue o arquivo no MESMO comando que usa as variáveis (`set -a; . ~/.config/agente-concierge/env; set +a; ...`), nunca imprima valor de variável, sem `echo` delas, sem `set -x`, sem modo verboso. Não use `OPENAI_API_KEY`.
7. Nada de conteúdo de caso fora de PRIV: nem id de caso, nem mensagem, nem resposta, nem valor em reais, nem código de imóvel, na mensagem final ou no relatório para a coordenação.

## Fases, nesta ordem

### Fase 0: preparo
- `cp -a` do conjunto para `PRIV/originais/` e `sha256sum` de cada arquivo em `PRIV/originais.sha256`. Os originais não mudam mais.
- Confira o formato: mesmos blocos de `docs/EVALS.md`, mínimo de 5 casos por bloco.

### Fase 1: conferência às cegas de TODOS os casos (antes de saber quais falharam)
Sem abrir `leitura-2-registro.jsonl` e sem rodar nada contra `dev`. Para cada caso do conjunto, todos, confira cada expectativa (texto exigido, texto proibido, `handoff`, total, leads esperados, o que o formato tiver) contra `docs/CONTRATO.md` e `DECISOES.md`. Grave em `PRIV/auditoria.md`, uma linha por caso, um destes vereditos:
- `conforme`;
- `contradiz <cláusula ou decisão>`: a expectativa exige o contrário do que o contrato ou uma decisão manda;
- `excede <cláusula ou decisão>`: exige mais do que o contrato pede (por exemplo, uma frase exata onde o contrato fixa só um fato);
- `frouxa <cláusula ou decisão>`: aprovaria resposta que o contrato reprova.
As duas direções valem igual: caso frouxo é tão defeito quanto caso duro. Na dúvida, `conforme`. Ao terminar, grave `sha256sum PRIV/auditoria.md` com a hora (`TZ=America/Sao_Paulo date`) em `PRIV/fase1.sha256`. Esse arquivo não muda depois.

### Fase 2: uma rodada detalhada em `dev`, com as expectativas ORIGINAIS
- Copie os casos originais para `PRIV/arvore/evals/casos/dev/` (a pasta está vazia de propósito) e rode o runner de `PRIV/arvore/` como conjunto `dev`, por um proxy de gravação seu: suba o proxy apontando para `$AGENTE_URL_DEV` na porta 8792, rode `node evals/rodar.mjs --alvo http://127.0.0.1:8792 --conjunto dev --relatorio PRIV/rodada-a.json`, derrube o proxy pelo PID. Saída e gravação ficam em PRIV. O runner lê `LEADS_URL_DEV` do ambiente. Casos com confirmação só rodam em `dev`, que usa webhook falso: está certo.
- Exclusão mútua com a coordenação, que vai republicar `dev` e rodar rodadas oficiais: antes de rodar contra `dev`, espere enquanto existir o arquivo `~/.cache/agente-concierge/dev-em-uso-coordenacao` (confira a cada 20 s, com laço `until`, não com `sleep` longo). Enquanto você roda, mantenha o arquivo `~/.cache/agente-concierge/dev-em-uso-reservado` e apague-o ao terminar, mesmo em erro.
- A gravação da leitura 2 é uma segunda observação das mesmas conversas, onde der para ligar sessão a caso. Ela não tem os leads recebidos.

### Fase 3: classificar cada falha, e ler também o que passou
Para cada caso que falhou na rodada A ou na leitura 2, leia a conversa e classifique em UMA classe:
- `A1`: defeito de caso achado na fase 1 (`contradiz` ou `excede`).
- `A2`: a resposta está certa por uma cláusula que você cita, e quem reprova é o verificador mecânico do próprio caso (expressão do arquivo do caso) por causa da redação.
- `J`: a resposta está certa e quem reprova é o juiz compartilhado (`evals/lib/`), não o arquivo do caso. Você não corrige: só conta.
- `B-lead`: lead registrado sem confirmação, lead duplicado, ou lead diferente do resumo mostrado. **Achou um: pare tudo, grave o relatório com a contagem e termine a tarefa.**
- `B-det`: erro real do agente que se repete nas duas observações.
- `B-var`: erro real do agente em uma observação, acerto na outra.
- `I`: infraestrutura (tempo esgotado, 5xx, contingência por falha do catálogo).
Leia também as conversas dos casos que PASSARAM: resposta errada pelo contrato que o caso aprovou é `FV` (falso verde), e o caso é apertado.
Comece pelo bloco funciona-leads.

### Fase 4: a única passada de correção
- Só mudam casos `A1`, `A2`, `FV` e os `frouxa` da fase 1. Cada mudança precisa da cláusula do contrato ou da decisão citada. Na dúvida, o caso fica como está e a falha conta como do agente.
- Mudança mínima: só a expectativa com defeito, nunca a mensagem do hóspede, nunca o propósito do caso. Não apague caso. Não acrescente caso.
- Para cada caso `A2` mudado, escreva de duas a três respostas ERRADAS que o caso foi feito para pegar e confirme que a expectativa nova ainda reprova todas (use o juiz do export; o autoteste em `evals/teste-do-runner.mjs` mostra como chamar o juiz sem rede, mas não rode o autoteste, que precisa de um arquivo retirado do export).
- Grave cada mudança em `PRIV/correcoes.md`: caso, classe, expectativa original, expectativa nova, cláusula ou decisão citada, a resposta real que motivou (em `A2` e `FV`), as erradas testadas. Um segundo revisor, que não é você, vai conferir esse arquivo e pode vetar cada mudança.
- Aplique as mudanças em `~/.config/agente-concierge/reservado/`. Confira que todo arquivo continua JSON válido e que `node evals/rodar.mjs --conjunto reservado --listar` (rode de `PRIV/arvore/`) lista os mesmos blocos e contagens de antes.
- Uma rodada B de validação em `dev`, com os casos corrigidos, do mesmo jeito da rodada A (mesma exclusão mútua), em `PRIV/rodada-b.json`. **Depois da rodada B nada mais muda**, nem se sobrar falha: o que sobrar é reportado como está.

## Relatório para a coordenação

Grave em `<rascunho>/c-reservado-relatorio.md` UMA vez, no fim (a coordenação só age na sua mensagem de fim de tarefa), e repita na mensagem final. Só isto, sem conteúdo de caso:
1. Casos por bloco e total.
2. Fase 1: quantos casos por veredito (`conforme`, `contradiz`, `excede`, `frouxa`), por bloco, e a lista das cláusulas e decisões citadas com a contagem de cada uma (só o identificador, como "P20: 3").
3. Rodada A (expectativas originais): acerto por bloco e agregado. Tabela bloco × classe das falhas (`A1`, `A2`, `J`, `B-lead`, `B-det`, `B-var`, `I`) somando rodada A e leitura 2, e quantos `FV`.
4. Para `B-det` e `B-var`, por bloco, a contagem por tipo, SÓ deste vocabulário fechado: `não fez handoff`, `handoff indevido`, `inventou informação`, `valor errado`, `recusou o que devia atender`, `atendeu o que devia recusar`, `formato do contrato`, `lead não registrado depois da confirmação`, `outro`.
5. Quantos casos mudaram, por bloco e por direção (afrouxado ou apertado).
6. Rodada B (casos corrigidos): acerto por bloco e agregado.
7. Se alguma falha `J` ou `B-det` justificaria a regra 6 de `docs/EVALS.md` (revelar o caso para alguém corrigir o juiz ou o agente): bloco, contagem e por quê, em termos gerais. Não revele nada: quem decide é a coordenação.
8. O que você não conseguiu fazer e por quê. Hora de início e de fim (`TZ=America/Sao_Paulo date`).

Barra fechada: a tarefa só está cumprida com as fases na ordem, `fase1.sha256` gravado antes da rodada A, originais intactos (confira o `sha256sum -c` no fim), todo caso mudado com cláusula citada em `correcoes.md`, e o relatório só com contagens. Prazo: 60 minutos. Se o prazo estourar no meio da fase 4, pare antes de aplicar mudança pela metade e diga onde parou.
````

## 18. Papel da frente C — segundo revisor do reservado (veto)

14/11 03h54 · claude-opus-5-5 · esforço high

````text
Você é o SEGUNDO REVISOR do conjunto reservado de evals do projeto agente-concierge (agente de chat para hóspedes de imóveis de temporada; contrato HTTP `POST /chat {session_id, message}` → `{reply, handoff}`). Você atua no papel da frente C: pode abrir o conjunto reservado, não corrige o agente, não recebe tarefa de produto, e devolve à coordenação só contagens. Não inicie subagentes. Escreva em português do Brasil.

## Situação

O conjunto reservado (60 casos, 8 blocos) mede o agente com casos que ninguém usou para corrigi-lo. As primeiras leituras do agregado deram 83% e 80% (limiar 90%). Pela decisão P33 de `DECISOES.md` (leia), um primeiro revisor fez UMA passada de correção dos casos: mudou a expectativa de 9 casos (7 afrouxados, porque o verificador mecânico do próprio caso reprovava resposta certa pela redação; 2 apertados, porque aprovariam resposta errada). Com isso uma rodada deu 91,7%. Ele tem interesse implícito em ver o número passar; você existe para conferir cada mudança, com VETO caso a caso. Você não tem esse interesse: um veto a mais custa pouco, uma mudança indevida a mais torna o número desonesto.

Em paralelo a você, o primeiro revisor está tirando do conjunto 4 casos (3 de funciona-leads, 1 de robustez-handoff) que revelaram um erro real do agente (regra 6 de `docs/EVALS.md`) e escrevendo 4 substitutos. Esses 4 arquivos e os substitutos mudam enquanto você trabalha: não toque neles até a etapa 4.

## Onde está cada coisa

- PRIV = `~/.cache/agente-concierge/c-reservado/` (pasta privada do papel da frente C). Nela: `originais/` (o conjunto como era, intocável) e `originais.sha256`; `auditoria.md` (conferência às cegas do primeiro revisor); `classificacao.md`; `correcoes.md` (as 9 mudanças, com a cláusula citada, a resposta real que motivou e as erradas que ele testou); `rodada-a-registro.jsonl`, `rodada-b-registro.jsonl` e `leitura-2-registro.jsonl` (conversas gravadas: sessão em `s`, mensagem em `m`, corpo da resposta em `r`); `rodada-a.json` e `rodada-b.json` (relatórios do runner); os roteiros dele (`testar.mjs`, `montar-testes.mjs`, `replay.mjs`), que você pode ler para ver como chamar o juiz sem rede, mas as entradas de teste têm de ser SUAS.
- `PRIV/arvore/`: export da árvore candidata (sem `.git`, sem código de produto). Leia inteiros, antes de tudo: `docs/CONTRATO.md`, `DECISOES.md` (L-n e P-n, até a P33), `docs/EVALS.md` e `evals/README.md` (formato do caso e limites do juiz).
- O conjunto em uso: `~/.config/agente-concierge/reservado/`.
- Suas anotações com conteúdo de caso: só em `PRIV/revisor2/`.

## O que você NÃO faz

- Não lê casos de desenvolvimento de checkout nenhum, relatórios em `evals/relatorios/`, `evals/lib/corpus-juiz.json`, código de produto, o rascunho da coordenação (fora o seu relatório) nem outras threads. Atenção: `PRIV/arvore/evals/casos/dev/` contém uma cópia do reservado posta ali pelo primeiro revisor para rodar; não é material de desenvolvimento.
- Não altera `evals/lib/` nem `evals/rodar.mjs` do export. Não cria arquivo em checkout ou worktree do repositório. Sem commit.
- Tudo offline: nenhuma chamada a `dev`, a `producao` ou ao catálogo. Não carregue `~/.config/agente-concierge/env`.
- Não afrouxa nenhum caso. Você só pode: manter uma mudança, vetar uma mudança (o caso volta à expectativa ORIGINAL daquele campo, copiada de `PRIV/originais/`) ou apertar um caso frouxo (etapa 2). Não existe veto parcial nem terceira redação.
- Nada de conteúdo de caso (id, mensagem, resposta, valor, código de imóvel) no relatório nem na mensagem final.

## Etapas

### 1. Veto das 9 mudanças
Para cada mudança de `correcoes.md`, compare original e atual e decida MANTER ou VETAR. Só mantém se TODAS valerem:
- a cláusula do contrato ou a decisão citada diz mesmo o que a correção afirma;
- a mudança é mínima: só a expressão com defeito; mensagem do hóspede, turnos e propósito do caso intactos;
- nos afrouxados: a resposta real que motivou está certa pelo contrato (leia a conversa inteira nas gravações, não só o trecho citado), e a expressão nova ainda reprova resposta errada. Escreva pelo menos 6 respostas ERRADAS suas por caso, diferentes das dele, do tipo que o caso existe para pegar (inclua as que usam as palavras novas que a expressão passou a aceitar), e passe pelo juiz do export. Uma errada aprovada que a expressão original reprovava = VETO;
- nos apertados: pelo menos 6 respostas CERTAS suas, com redações variadas, continuam aprovando, e as erradas que motivaram o aperto reprovam. Certa reprovada que a original aprovava = VETO.
Na dúvida, VETO. Grave cada decisão em `PRIV/revisor2/vetos.md` e aplique os vetos no conjunto.

### 2. Frouxidão nos casos que não mudaram
A conferência às cegas do primeiro revisor levou 3 minutos e marcou 58 de 60 como conformes. Refaça só o lado que ele pode ter deixado passar: nos casos que não mudaram (fora os 4 em substituição), procure expectativa FROUXA, que aprovaria resposta que o contrato reprova, e resposta gravada que passou estando errada (falso verde). Para cada achado, com a cláusula citada, aperte o caso com a menor mudança possível, confirme que as respostas certas gravadas daquele caso continuam aprovando, e grave em `PRIV/revisor2/apertos.md`. Sem achado claro, não mexa.

### 3. Classificação das falhas que ficaram
Releia, em `classificacao.md` e nas gravações, as falhas que o primeiro revisor classificou como erro do juiz compartilhado (`J`, 3 casos), como erro real do agente de idioma (1 caso) e como erro real do agente no lead (os 4 em substituição; leia-os em `PRIV/originais/`). Para cada uma, diga se concorda, com a cláusula. Não mude nada por causa disso. Onde discordar (por exemplo: a resposta do agente está certa por uma decisão, e é o caso que excede o contrato), só conte e cite o identificador da cláusula.

### 4. Substitutos
Quando existir `PRIV/substitutos.md` e `node evals/rodar.mjs --conjunto reservado --listar` (rodado de `PRIV/arvore/`) mostrar 60 casos de novo, confira os 4 substitutos contra o contrato e as decisões, nas duas direções (não exigem mais do que o contrato pede; não aprovam o que o contrato reprova), e que não são paráfrase dos 4 casos retirados. Espere por eles com um laço `until … do sleep 10; done`, até 15 minutos; se não chegarem, diga isso no relatório. Você não reescreve substituto: conta quantos estão em ordem e quantos contesta, com a cláusula.

### 5. Fecho
Todo arquivo do conjunto é JSON válido e cada expressão compila; `--listar` com os mesmos 8 blocos e 60 casos; `sha256sum -c PRIV/originais.sha256` sem diferença.

## Relatório

Grave `<rascunho>/c-reservado-revisor2.md` UMA vez, só no fim (a coordenação só age na sua mensagem de fim de tarefa), e repita na mensagem final. Só contagens:
1. Mudanças mantidas e vetadas, por bloco e por direção; por veto, o motivo em uma destas palavras: `cláusula não sustenta`, `não é mínima`, `resposta real não está certa`, `errada aprova`, `certa reprova`, `dúvida`. Quantas respostas suas você testou.
2. Apertos novos, por bloco, com o identificador da cláusula.
3. Classificação: concorda e discorda, por classe, com o identificador da cláusula onde discorda.
4. Substitutos: em ordem e contestados.
5. Fecho: contagens do `--listar`, resultado do `sha256sum -c`.
6. O que não fez e por quê. Hora de início e de fim (`TZ=America/Sao_Paulo date`).

Prazo: 30 minutos.
````
