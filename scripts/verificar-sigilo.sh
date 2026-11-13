#!/usr/bin/env bash
# Gate de sigilo e de histórico. Roda antes de CADA commit (com tudo já em stage)
# e antes de CADA push. Sai 0 e imprime "SIGILO OK" só se nada foi encontrado.
#
# Os termos proibidos (domínio da API, token, nome da empresa) não ficam neste
# arquivo: são derivados em tempo de execução da variável CATALOGO_URL, que vive
# fora do repositório. Termos extras (apelidos de máquina etc.) podem ser postos,
# um por linha, em ~/.config/agente-concierge/sigilo-extra.
#
# A saída mostra só arquivo:linha, nunca o trecho encontrado.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2

AUTOR="contato@evertonresende.com"
DIR_CFG="${AGENTE_CFG:-$HOME/.config/agente-concierge}"
marca=$(mktemp -u)   # arquivo-flag: relata() roda em subshell de pipe, variável não sobrevive

[ -f "$DIR_CFG/env" ] || { echo "SIGILO: sem $DIR_CFG/env não dá para derivar os termos proibidos"; exit 2; }
set -a; . "$DIR_CFG/env"; set +a
url="${CATALOGO_URL:-}"
[ -n "$url" ] || { echo "SIGILO: CATALOGO_URL vazia"; exit 2; }

host=$(printf '%s' "$url" | sed -E 's#^[a-z]+://([^/:]+).*#\1#')
token=$(printf '%s' "$url" | sed -E 's#.*/catalogo/([^/?]+).*#\1#')
empresa=$(printf '%s' "$host" | awk -F. '{print $(NF-1)}')

fixos=$(mktemp); trap 'rm -f "$fixos" "$marca"' EXIT
{
  printf '%s\n' "$host" "$token" "$empresa"
  hostname; hostname -s
  [ -f "$DIR_CFG/sigilo-extra" ] && grep -v '^[[:space:]]*$' "$DIR_CFG/sigilo-extra"
} | awk 'length($0) >= 4' | sort -u > "$fixos"

relata() { # $1 = rótulo; stdin = linhas arquivo:linha
  local linhas; linhas=$(sort -u)
  [ -z "$linhas" ] && return 0
  echo "SIGILO: $1 em:"; printf '%s\n' "$linhas" | sed 's/^/  /'; : > "$marca"
}

# 1. Conteúdo do índice (o que já está versionado + o que está em stage).
git grep --cached -I -n -i -F -f "$fixos" -- . 2>/dev/null | cut -d: -f1,2 \
  | relata "termo proibido (domínio, token, empresa ou nome de máquina)"

git grep --cached -I -n -o -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' -- . 2>/dev/null \
  | grep -v -E ':(127\.0\.0\.1|0\.0\.0\.0)$' | cut -d: -f1,2 \
  | relata "endereço IP"

git grep --cached -I -n -o -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' -- . 2>/dev/null \
  | grep -v -F ":$AUTOR" | cut -d: -f1,2 \
  | relata "e-mail que não é o do autor"

git ls-files --cached | grep -E '(^|/)(\.privado/|\.env($|\.)|\.dev\.vars)' | grep -v -F '.env.example' \
  | relata "arquivo local ou de ambiente versionado"

# 2. Histórico publicável: branches, tags e o que já está no remoto. Ferramentas de
#    orquestração criam refs locais de checkpoint (fora de refs/heads e refs/tags) com
#    outra identidade; elas não são publicadas por `git push` e ficam fora desta
#    checagem, mas o item 3 garante que nenhuma chegou ao remoto.
PUBLICAVEL="--branches --tags --remotes"
if git rev-parse -q --verify HEAD >/dev/null; then
  git log $PUBLICAVEL --format='%H %B' | grep -i -F -f "$fixos" | cut -c1-8 \
    | relata "termo proibido em mensagem de commit"
  git log $PUBLICAVEL --format='%ae%n%ce' | sort -u | grep -v -x -F "$AUTOR" | sed 's/.*/(e-mail fora do padrão no histórico)/' \
    | relata "autor ou committer diferente de $AUTOR"
  git reflog | grep -E -i 'amend|rebase|squash' | cut -d' ' -f1 \
    | relata "amend, rebase ou squash no reflog"
fi

# 3. Remoto: só branches e tags. Nunca `git push --mirror` nem push de outras refs.
if git remote get-url origin >/dev/null 2>&1; then
  if refs_remotas=$(git ls-remote origin 2>/dev/null); then
    printf '%s\n' "$refs_remotas" | awk '{print $2}' | grep -v -E '^(HEAD|refs/heads/|refs/tags/)' \
      | relata "ref fora de branches e tags no remoto"
  else
    echo "SIGILO: aviso: não consegui listar as refs do remoto (sem rede?)"
  fi
fi

locais=$(git for-each-ref --format='%(refname)' | grep -v -c -E '^refs/(heads|tags|remotes)/')
[ "$locais" -eq 0 ] || echo "SIGILO: aviso: $locais ref(s) local(is) de ferramenta fora de branches e tags; não são publicadas por git push"

[ ! -e "$marca" ] || exit 1
echo "SIGILO OK"
