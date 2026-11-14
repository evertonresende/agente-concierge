# Sincronização Git (Multi-Máquina)

Mesmo ambiente roda em mais de uma máquina — código stale = conflito garantido.

## Automação

Hook `SessionStart` (script `git-sync.sh` da pasta de hooks do ambiente) roda em startup/resume/clear/compact, em repo git com remote:

1. `git fetch origin --prune` (aborta em rede lenta em vez de travar startup)
2. Linha de tracking do `git status -sb` (`## branch...ahead/behind`) injetada no contexto
3. Atrás do remoto (contagem via `rev-list`, não grep textual) + working tree limpa → `git pull --ff-only` automático
4. Divergência (ahead+behind) ou mudanças locais → alerta injetado, sem pull
5. Scan de branches não mergeadas na base (origin/HEAD → main → master; sem base = skip avisado)
6. Últimas deploy tags + `SESSION_INTENT` de worktrees irmãs (gitdir real via `rev-parse`)

## O que Claude ainda faz manualmente

- **Interpretar alertas do hook:** divergência real → PARAR, avisar usuário, NUNCA mergear sozinho.
- **Fallback sem hook:** nenhuma linha `[git-sync]` no contexto → rodar manual `git fetch origin --prune && git status -sb`, pull `--ff-only` se atrás e limpo.
- **Auditoria de branch órfã:** branch não mergeada + deploy tag apontando pra dentro dela = código em produção fora da main (caso real de outro projeto: duas branches 5 dias divergidas, worker publicado ausente da main). Avisar antes de iniciar task:
  > "Branch `X`: N commits fora da main (último <data>[, deployado em <tag>]). Consolidar antes de seguir? Risco de perder/duplicar trabalho."
- **Re-sync antes de commit/push** em task longa: `git fetch origin && git status -sb`, puxar se preciso.
- **Troca de contexto** (mudou de pasta/projeto no meio da sessão): rodar fluxo manual — hook não dispara em cd.

## Comandos de auditoria (quando hook alertar)

```bash
git log --oneline main..<branch>            # o que falta
git diff main...<branch> --shortstat        # tamanho
git rev-list --left-right --count main...<branch>  # divergiu ou só atrás?
git merge-base --is-ancestor <branch> main && echo contido || echo DIVERGIU
git tag --sort=-creatordate | grep '^deploy-' | head # cruzar com deploys
```

## Regras duras

- Nunca `git pull` sem `--ff-only` — evita merge commit acidental.
- Conflito ou divergência → decisão é do usuário.
- Repo sem remote (ex: `~`) → hook sai silencioso; não tentar sync.
