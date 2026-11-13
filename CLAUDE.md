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
- Antes de cada commit (com tudo em stage) e de cada push:
  `scripts/verificar-sigilo.sh` precisa terminar com `SIGILO OK`.

## Webhook real

- **Nenhum POST ao webhook real antes da entrega**, por nenhuma sessão, nem como
  teste. GET é permitido.
- Fluxo completo de lead, evals com confirmação e gravação de vídeo: só em `dev`, que
  usa o webhook falso. Contra `producao`, só conversas sem confirmação.

## Papéis

- A sessão coordenadora não edita código de produto. Cada frente trabalha na própria
  worktree e só nos arquivos da sua linha na tabela de donos do backlog.
- Lacuna do enunciado é decisão do Éverton. Frente que encontra lacuna aberta para e
  avisa.
- Deploy de `producao` só com ordem explícita do Éverton.

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
| Deploy de `dev` | `npm run deploy:dev` |
| Validar `producao` sem enviar lead | `scripts/validar-producao.sh` |
| Deploy de `producao` (só com ordem do Éverton) | `npm run deploy:producao` |

Os comandos de `npm`, `evals/` e `scripts/validar-producao.sh` passam a existir
conforme as frentes do backlog forem entregues.
