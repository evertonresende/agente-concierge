#!/usr/bin/env bash
# Gate de sigilo e de histórico. Roda antes de CADA commit (com tudo já em stage)
# e antes de CADA push. Sai 0 e imprime "SIGILO OK" só se nada foi encontrado.
#
# Os termos proibidos (domínio da API, token, nome da empresa) não ficam neste
# arquivo: são derivados em tempo de execução da variável CATALOGO_URL, que vive
# fora do repositório, e do host de toda variável terminada em _URL definida no mesmo
# arquivo (agente de dev, webhook falso, produção). Termos extras (apelidos de máquina
# etc.) podem ser postos, um por linha, em ~/.config/agente-concierge/sigilo-extra.
# Termo que o Éverton mandar liberar (por exemplo, a URL pública no README) vai, um
# por linha, em ~/.config/agente-concierge/sigilo-liberados.
#
# A saída mostra só arquivo:linha, commit ou commit:arquivo, nunca o trecho encontrado.
# Arquivo binário é lido como texto (-a). Teste: scripts/verificar-sigilo.teste.sh.
#
# Limites conhecidos (o que este gate NÃO pega):
# - IPv6: só endereços IPv4 são procurados.
# - IP e e-mail só no índice, não no conteúdo de commits antigos. Com -a, um binário
#   novo pode dar falso positivo nessas duas varreduras (falha do lado seguro).
# - Reescrita de histórico com `git reset` seguido de `git push --force`: o reflog só
#   registra amend, rebase e squash pelo nome, e só o HEAD desta worktree.
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
# Nome da empresa = penúltimo rótulo do host. Se ele for curto demais (< 4, o que inclui
# os sufixos com, net, org, gov, edu e co de hosts como api.nome.com.br), usa o anterior.
empresa=$(printf '%s' "$host" | awk -F. '{ e = $(NF-1); if (length(e) < 4 && NF > 2) e = $(NF-2); if (length(e) >= 4) print e }')
[ -n "$empresa" ] || [ -f "$DIR_CFG/sigilo-extra" ] \
  || { echo "SIGILO: não deu para derivar o nome da empresa do host; ponha-o em sigilo-extra"; exit 2; }

fixos=$(mktemp); trap 'rm -f "$fixos" "$marca"' EXIT
{
  printf '%s\n' "$host" "$token" "$empresa"
  hostname; hostname -s
  for nome in $(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*_URL[A-Za-z0-9_]*\)=.*/\1/p' "$DIR_CFG/env"); do
    printf '%s\n' "${!nome}" | sed -E 's#^[a-z]+://([^/:]+).*#\1#'
  done
  [ -f "$DIR_CFG/sigilo-extra" ] && grep -v '^[[:space:]]*$' "$DIR_CFG/sigilo-extra"
} | awk 'length($0) >= 4' | sort -u \
  | { if [ -f "$DIR_CFG/sigilo-liberados" ]; then grep -v -x -F -f "$DIR_CFG/sigilo-liberados"; else cat; fi; } > "$fixos"

relata() { # $1 = rótulo; stdin = localizações (arquivo:linha, commit ou commit:arquivo)
  local linhas n
  # Rede de segurança: localização que contém um termo (nome de arquivo, ref) não é
  # impressa; vira uma linha genérica.
  linhas=$(awk -v F="$fixos" '
    BEGIN { while ((getline t < F) > 0) T[tolower(t)] }
    { l = tolower($0); for (t in T) if (index(l, t)) { print "(localização omitida: contém termo proibido)"; next } print }' \
    | sort -u)
  [ -z "$linhas" ] && return 0
  n=$(printf '%s\n' "$linhas" | wc -l)
  echo "SIGILO: $1 em:"; printf '%s\n' "$linhas" | head -n 20 | sed 's/^/  /'
  [ "$n" -le 20 ] || echo "  (e mais $((n - 20)))"
  : > "$marca"
}

# 1. Conteúdo do índice (o que já está versionado + o que está em stage).
git grep --cached -a -n -i -F -f "$fixos" -- . 2>/dev/null | cut -d: -f1,2 \
  | relata "termo proibido (domínio, token, empresa ou nome de máquina)"

git grep --cached -a -n -o -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' -- . 2>/dev/null \
  | grep -v -E ':(127\.0\.0\.1|0\.0\.0\.0)$' | cut -d: -f1,2 \
  | relata "endereço IP"

git grep --cached -a -n -o -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' -- . 2>/dev/null \
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
  # Conteúdo de todos os commits publicáveis: o repositório fica público com o histórico
  # inteiro, então um termo apagado num commit posterior continua publicado. Varre cada
  # blob uma vez (rápido); só quando acha algo localiza commit:arquivo, blob a blob.
  objetos=$(set -o pipefail; git rev-list --objects $PUBLICAVEL \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(rest)') \
    || { echo "SIGILO: falha ao listar os objetos do histórico"; exit 2; }
  printf '%s\n' "$objetos" | awk '$1 == "blob" { print $2 }' | git cat-file --batch='' \
    | grep -a -q -i -F -f "$fixos"
  st=("${PIPESTATUS[@]}")
  if [ "${st[3]}" -eq 0 ]; then
    # Commit que introduziu cada versão com o termo (o mais antigo que a toca).
    loc=$(printf '%s\n' "$objetos" | awk '$1 == "blob"' | while read -r _ obj caminho; do
      git cat-file blob "$obj" | grep -a -q -i -F -f "$fixos" || continue
      c=$(git log $PUBLICAVEL --format=%H --find-object="$obj" | tail -n 1 | cut -c1-8)
      echo "${c:-?}:$caminho"
    done)
    printf '%s\n' "${loc:-(não localizado)}" | relata "termo proibido no conteúdo de commit"
  elif [ "${st[3]}" -ne 1 ] || [ "${st[2]}" -ne 0 ]; then
    echo "SIGILO: falha ao ler o conteúdo do histórico"; exit 2
  fi

  # Um registro por commit, separado por NUL (que não cabe numa mensagem): hash, \037 e
  # a mensagem. Procura só na mensagem e imprime só o identificador curto. Registro fora
  # desse formato reprova como ilegível, em vez de ser pulado.
  git log -z $PUBLICAVEL --format='%H%x1f%B' | awk -v F="$fixos" '
    BEGIN { while ((getline t < F) > 0) T[tolower(t)]; RS = "\0" }
    { i = index($0, "\037"); h = substr($0, 1, i - 1)
      if (i == 0 || h !~ /^[0-9a-f]+$/) { print "(mensagem ilegível)"; next }
      corpo = tolower(substr($0, i + 1))
      for (t in T) if (index(corpo, t)) { print substr(h, 1, 8); next } }' \
    | relata "termo proibido em mensagem de commit"
  git log $PUBLICAVEL --format='%ae%n%ce' | sort -u | grep -v -x -F "$AUTOR" | sed 's/.*/(e-mail fora do padrão no histórico)/' \
    | relata "autor ou committer diferente de $AUTOR"
  git reflog | grep -E -i 'amend|rebase|squash' | cut -d' ' -f1 \
    | relata "amend, rebase ou squash no reflog"
fi

# Nomes de arquivo e de pasta, no índice e no histórico: só a contagem, nunca o nome.
n=$({ printf '%s\n' "${objetos:-}" | cut -s -d' ' -f3-; git ls-files --cached; } | grep -c -i -F -f "$fixos")
[ "$n" -eq 0 ] || echo "($n caminho(s))" | relata "termo proibido em nome de arquivo ou pasta"

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
