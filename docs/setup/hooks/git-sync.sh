#!/usr/bin/env bash
# SessionStart hook: sync git + auditoria de divergência (automatiza o fluxo
# manual que vivia no CLAUDE.md). Saída no stdout vira contexto da sessão.
# Regra de interpretação: docs/setup/rules/git-sync.md (cópia da regra do ambiente)
set -uo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
git remote get-url origin >/dev/null 2>&1 || exit 0

# lowSpeed*: aborta em rede lenta/pendurada em vez de travar o startup até o timeout do hook
if ! git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=5 fetch origin --prune --quiet 2>/dev/null; then
  echo "[git-sync] fetch falhou (offline/rede lenta?) — estado remoto pode estar stale"
  exit 0
fi

echo "[git-sync] $(git status -sb | head -1)"

# contagem numérica: grep textual em 'behind/ahead' casaria nome de branch tipo my-look-behind;
# detached HEAD ou sem upstream → rev-list falha → 0/0 → skip natural
behind=$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)
ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
if [ "$behind" -gt 0 ]; then
  if [ "$ahead" -eq 0 ] && [ -z "$(git status --porcelain)" ]; then
    if git pull --ff-only --quiet 2>/dev/null; then
      echo "[git-sync] atrás do remoto + working tree limpa → pull --ff-only executado"
    else
      echo "[git-sync] ALERTA: pull --ff-only falhou — resolver manual antes de editar"
    fi
  else
    echo "[git-sync] ALERTA: divergência (ahead=$ahead behind=$behind) ou mudanças locais — NÃO puxei. Parar e avisar usuário antes de mergear."
  fi
fi

# base branch: origin/HEAD → main → master; sem base = skip VISÍVEL (não silencioso)
MAIN=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | cut -d/ -f2-)
if [ -z "$MAIN" ]; then
  for c in main master; do
    git show-ref --verify --quiet "refs/heads/$c" && { MAIN=$c; break; }
  done
fi
BASE="$MAIN"
if [ -n "$MAIN" ] && ! git rev-parse --verify --quiet "refs/heads/$MAIN" >/dev/null; then
  BASE="origin/$MAIN"
  git rev-parse --verify --quiet "$BASE" >/dev/null || BASE=""
fi
if [ -n "$BASE" ]; then
  UNMERGED=$(git branch -a --no-merged "$BASE" 2>/dev/null | grep -v 'HEAD' | sed 's/^[* +]*//' | grep -vx "$MAIN" | head -10 || true)
  if [ -n "$UNMERGED" ]; then
    echo "[git-sync] branches não mergeadas em $BASE (auditar antes de editar — cruzar com deploy tags):"
    printf '%s\n' "$UNMERGED" | sed 's/^/  /'
  fi
else
  echo "[git-sync] base branch não identificada (sem main/master/origin HEAD) — auditoria de branches PULADA"
fi

DEPLOYS=$(git tag --sort=-creatordate 2>/dev/null | grep '^deploy-' | head -3 || true)
if [ -n "$DEPLOYS" ]; then
  echo "[git-sync] últimos deploys:"
  printf '%s\n' "$DEPLOYS" | sed 's/^/  /'
fi

# SESSION_INTENT de worktrees irmãs: em linked worktree .git é ARQUIVO, então
# resolver o gitdir real via rev-parse; sed preserva paths com espaço
CWD=$(pwd)
git worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | while IFS= read -r wt; do
  [ "$wt" = "$CWD" ] && continue
  gd=$(git -C "$wt" rev-parse --absolute-git-dir 2>/dev/null) || continue
  if [ -f "$gd/SESSION_INTENT" ]; then
    echo "[git-sync] sessão paralela declarada em $wt:"
    sed 's/^/  /' "$gd/SESSION_INTENT"
  fi
done

exit 0
