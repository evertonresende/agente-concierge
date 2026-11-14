# CLAUDE.md

## Idioma

Respostas, commits, documentos e comentários em português do Brasil. Regras pessoais de idioma do meu ambiente global não valem neste repositório.

## O que é

Agente de chat (concierge) para hóspedes de imóveis de temporada: tira dúvidas pelo
catálogo, cota estadias, registra lead após confirmação e passa para humano. Worker em
TypeScript na Cloudflare, um Durable Object por sessão, loop de ferramentas próprio.

## Onde está cada coisa

| Arquivo | Para quê |
|---|---|
| `docs/CONTRATO.md` | fonte única de requisitos; leia inteiro antes de qualquer tarefa |
| `docs/exploracoes/BACKLOG-CONCIERGE-2026-11.md` | frentes, donos de arquivo, critérios de aceite, estado |
| `docs/EVALS.md` | plano de evals, blocos, conjunto reservado, limiares |
| `docs/VERIFICACOES.md` | fatos de plataforma verificados, com fonte |
| `DECISOES.md` | decisões e motivos |
| `docs/prompts/`, `docs/conselho/`, `docs/desenhos/` | prompts usados, segunda opinião de outros modelos, desenhos |

## Sigilo (o repositório fica público na entrega)

- Nunca escrever em arquivo versionado nem em mensagem de commit: o nome da empresa do
  desafio, trechos copiados do enunciado, o domínio da API, o token, IPs, nomes de
  máquina ou e-mails (exceto contato@evertonresende.com).
- Domínio e token vivem só em variáveis de ambiente. Na máquina de desenvolvimento
  ficam em `~/.config/agente-concierge/env`; carregue o arquivo no mesmo comando em
  que usa a variável.
- Nunca imprimir o valor de um secret: sem `echo`, sem `set -x`, sem modo verboso.
- A credencial da Cloudflare é usada só por referência e nunca vira secret de Worker.
- `.privado/` e arquivos de ambiente não são versionados.

## Histórico

- Autor e committer: Éverton Resende, contato@evertonresende.com (configuração local
  do repositório; não mudar).
- Um commit por mudança lógica, push a cada commit.
- **Nunca squash, amend ou rebase.** Merge de frente é sempre `--no-ff`.
- Push só de branches e tags. **Nunca `git push --mirror`** nem push de outras refs: a
  ferramenta de orquestração cria refs locais de checkpoint com outra identidade, e
  elas não podem chegar ao remoto.
- Antes de cada commit (com tudo em stage) e de cada push:
  `scripts/verificar-sigilo.sh` precisa terminar com `SIGILO OK`.

## Webhook real

- **Nenhum POST ao webhook real**, por nenhuma sessão, nem como teste. GET é permitido.
  A única exceção foi o lead de teste que o Éverton autorizou em 14/11 (X36 em
  `DECISOES.md`). Ele já foi feito, e a proibição vale inteira de novo.
- Fluxo completo de lead, evals com confirmação e gravação de vídeo: só em `dev`, que
  usa o webhook falso. Contra `producao`, só conversas sem confirmação.
- A lista real parte de 1 lead, o de teste; o que passar disso vem da avaliação. O
  modo completo e o `--so-leitura` do
  `scripts/validar-producao.sh` exigem zero lead real e por isso reprovam; use
  `--entrega` e `--clientes`.

## Papéis

- A sessão coordenadora não edita código de produto. Cada frente trabalha na própria
  worktree e só nos arquivos da sua linha na tabela de donos do backlog.
- Lacuna do enunciado é decisão do Éverton. Frente que encontra lacuna aberta para e
  avisa.
- Deploy de `producao` pode sair com o envio real de leads desligado
  (`ENVIO_LEADS=desligado`). Ligar o envio real e tornar o repositório público: só com
  ordem explícita do Éverton.

## Comandos previstos

| Para | Comando |
|---|---|
| Gate de sigilo e histórico | `scripts/verificar-sigilo.sh` |
| Testes unitários e de integração local | `npm test` |
| Servidor local | `npm run dev` (ambiente `dev`, porta 8787) |
| Evals de desenvolvimento | `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto dev` |
| Um bloco | acrescente `--bloco <nome>` |
| Conjunto reservado (só agregado) | `node evals/rodar.mjs --alvo "$AGENTE_URL_DEV" --conjunto reservado --so-agregado` |
| Simulador hostil (só `dev`) | `node evals/simulador/rodar.mjs --alvo "$AGENTE_URL_DEV"` |
| Custo por conversa (de um relatório de eval) | `node scripts/custo.mjs <relatório.json>` |
| Deploy de `dev` | `npm run deploy:dev` |
| Validar `producao` sem enviar lead | `scripts/validar-producao.sh --entrega` e `scripts/validar-producao.sh --clientes` |
| Deploy de `producao` (envio real desligado até a ordem do Éverton) | `npm run deploy:producao` |

Os comandos de `npm`, `evals/` e `scripts/validar-producao.sh` passam a existir
conforme as frentes do backlog forem entregues.
