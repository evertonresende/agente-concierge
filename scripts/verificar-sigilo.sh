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

[ -f "$DIR_CFG/env" ] || { echo "SIGILO: sem $DIR_CFG/env não dá para derivar os termos proibidos"; exit 2; }
# O arquivo de ambiente é lido como dado, nunca executado: o shell não ecoa nenhuma
# linha dele num erro. Cada linha é vazia, comentário ou [export ]NOME=valor, com valor
# sem aspas (sem espaço nem caractere especial do shell), entre "" (sem $, ` nem \) ou
# entre ''. Linha fora disso sai com 2, sem mostrar o conteúdo.
declare -A CFG
re_valor="(\"[^\"\$\`\\\\]*\"|'[^']*'|[^[:space:]\"'\$\`\\\\;&|<>()~]*)"
re_linha="^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=$re_valor([[:space:]]+(#.*)?)?\$"
nl=0
while IFS= read -r linha || [ -n "$linha" ]; do
  nl=$((nl + 1))
  [[ $linha =~ ^[[:space:]]*(#.*)?$ ]] && continue
  [[ $linha =~ $re_linha ]] || { echo "SIGILO: linha $nl do arquivo de ambiente fora do formato NOME=valor"; exit 2; }
  v=${BASH_REMATCH[3]}
  case $v in \"*|\'*) v=${v:1:${#v}-2} ;; esac
  CFG[${BASH_REMATCH[2]}]=$v
done < "$DIR_CFG/env"
url="${CFG[CATALOGO_URL]:-}"
[ -n "$url" ] || { echo "SIGILO: CATALOGO_URL vazia"; exit 2; }
[[ $url =~ ^[a-z]+://[^/:]+.*/catalogo/[^/?]+ ]] || { echo "SIGILO: CATALOGO_URL fora do formato esperado"; exit 2; }

host=$(printf '%s' "$url" | sed -E 's#^[a-z]+://([^/:]+).*#\1#')
token=$(printf '%s' "$url" | sed -E 's#.*/catalogo/([^/?]+).*#\1#')
# Nome da empresa = penúltimo rótulo do host. Se ele for curto demais (< 4, o que inclui
# os sufixos com, net, org, gov, edu e co de hosts como api.nome.com.br), usa o anterior.
empresa=$(printf '%s' "$host" | awk -F. '{ e = $(NF-1); if (length(e) < 4 && NF > 2) e = $(NF-2); if (length(e) >= 4) print e }')
[ -n "$empresa" ] || grep -q '[^[:space:]]' "$DIR_CFG/sigilo-extra" 2>/dev/null \
  || { echo "SIGILO: não deu para derivar o nome da empresa do host; ponha-o em sigilo-extra"; exit 2; }

tmpd=$(mktemp -d) || { echo "SIGILO: não consegui criar a pasta temporária"; exit 2; }
trap 'rm -rf "$tmpd"' EXIT
fixos="$tmpd/termos"
marca="$tmpd/achou"   # arquivo-flag: relata() roda em subshell de pipe, variável não sobrevive
{
  printf '%s\n' "$host" "$token" "$empresa"
  hostname; hostname -s
  for nome in "${!CFG[@]}"; do
    [[ $nome == *_URL* ]] && printf '%s\n' "${CFG[$nome]}" | sed -E 's#^[a-z]+://([^/:]+).*#\1#'
  done
  [ -f "$DIR_CFG/sigilo-extra" ] && grep -v '^[[:space:]]*$' "$DIR_CFG/sigilo-extra"
} | awk 'length($0) >= 4' | sort -u \
  | { if [ -f "$DIR_CFG/sigilo-liberados" ]; then grep -v -x -F -f "$DIR_CFG/sigilo-liberados"; else cat; fi; } > "$fixos"
[ -f "$fixos" ] || { echo "SIGILO: não consegui gravar a lista de termos"; exit 2; }

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

# Lê do git para $tmpd/<arquivo>. Qualquer falha de leitura sai com 2, nunca com
# SIGILO OK; o código 1 só é aceito do git grep, que o usa para "nada achado".
# core.quotePath=false: nome não ASCII sai cru, e não em octal, para a máscara casar.
le() { # $1 = arquivo de saída; o resto = subcomando do git e argumentos
  local arq="$tmpd/$1" st; shift
  git -c core.quotePath=false "$@" > "$arq" 2>/dev/null; st=$?
  [ "$st" -eq 0 ] || { [ "$st" -eq 1 ] && [ "$1" = grep ]; } \
    || { echo "SIGILO: falha ao ler o repositório (git $1)"; exit 2; }
}

# 1. Conteúdo do índice (o que já está versionado + o que está em stage).
le indice grep --cached -a -n -i -F -f "$fixos" -- .
cut -d: -f1,2 "$tmpd/indice" | relata "termo proibido (domínio, token, empresa ou nome de máquina)"

le ips grep --cached -a -n -o -E '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' -- .
grep -v -E ':(127\.0\.0\.1|0\.0\.0\.0)$' "$tmpd/ips" | cut -d: -f1,2 | relata "endereço IP"

le emails grep --cached -a -n -o -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' -- .
grep -v -F ":$AUTOR" "$tmpd/emails" | cut -d: -f1,2 | relata "e-mail que não é o do autor"

le arquivos ls-files --cached
grep -E '(^|/)(\.privado/|\.env($|\.)|\.dev\.vars)' "$tmpd/arquivos" | grep -v -F '.env.example' \
  | relata "arquivo local ou de ambiente versionado"

# 2. Histórico publicável: branches, tags e o que já está no remoto. Ferramentas de
#    orquestração criam refs locais de checkpoint (fora de refs/heads e refs/tags) com
#    outra identidade; elas não são publicadas por `git push` e ficam fora desta
#    checagem, mas o item 3 garante que nenhuma chegou ao remoto.
PUBLICAVEL="--branches --tags --remotes"
[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = false ] \
  || { echo "SIGILO: clone raso: o histórico está incompleto e não dá para varrê-lo"; exit 2; }
: > "$tmpd/tipos"; : > "$tmpd/nomes_hist"
# Vale com ou sem commit no HEAD (branch órfã): o que conta é haver ref publicável.
le publicaveis for-each-ref --count=1 refs/heads refs/tags refs/remotes
if [ -s "$tmpd/publicaveis" ]; then
  # Conteúdo de todos os commits publicáveis: o repositório fica público com o histórico
  # inteiro, então um termo apagado num commit posterior continua publicado. Varre cada
  # blob uma vez (rápido); só quando acha algo localiza commit:arquivo, blob a blob.
  le objetos rev-list --objects $PUBLICAVEL
  le tipos cat-file --batch-check='%(objecttype) %(objectname) %(rest)' < "$tmpd/objetos"
  awk '$1 == "blob" { print $2 }' "$tmpd/tipos" | git cat-file --batch='' 2>/dev/null \
    | grep -a -q -i -F -f "$fixos"
  st=("${PIPESTATUS[@]}")
  if [ "${st[2]}" -eq 0 ]; then
    # Commit que introduziu cada versão com o termo (o mais antigo que a toca).
    loc=$(awk '$1 == "blob"' "$tmpd/tipos" | while read -r _ obj caminho; do
      git cat-file blob "$obj" | grep -a -q -i -F -f "$fixos" || continue
      c=$(git log $PUBLICAVEL --format=%H --find-object="$obj" | tail -n 1 | cut -c1-8)
      echo "${c:-?}:$caminho"
    done)
    printf '%s\n' "${loc:-(não localizado)}" | relata "termo proibido no conteúdo de commit"
  elif [ "${st[2]}" -ne 1 ] || [ "${st[1]}" -ne 0 ] || [ "${st[0]}" -ne 0 ]; then
    echo "SIGILO: falha ao ler o conteúdo do histórico"; exit 2
  fi

  # Todo caminho que algum commit publicável toca (merges incluídos), separado por NUL.
  le nomes_hist log -z -m --format= --name-only $PUBLICAVEL

  # Um registro por commit, separado por NUL (que não cabe numa mensagem): hash, \037 e
  # a mensagem. Procura só na mensagem e imprime só o identificador curto. Registro fora
  # desse formato reprova como ilegível, em vez de ser pulado.
  le mensagens log -z $PUBLICAVEL --format='%H%x1f%B'
  awk -v F="$fixos" '
    BEGIN { while ((getline t < F) > 0) T[tolower(t)]; RS = "\0" }
    { i = index($0, "\037"); h = substr($0, 1, i - 1)
      if (i == 0 || h !~ /^[0-9a-f]+$/) { print "(mensagem ilegível)"; next }
      corpo = tolower(substr($0, i + 1))
      for (t in T) if (index(corpo, t)) { print substr(h, 1, 8); next } }' "$tmpd/mensagens" \
    | relata "termo proibido em mensagem de commit"
  # Nomes de branch, tag e ref remota, e quem assina e a mensagem de tag anotada; nomes
  # de autor e committer. Só a contagem, nunca o texto.
  le refs_pub for-each-ref refs/heads refs/tags refs/remotes \
    --format='%(refname)%0a%(if:equals=tag)%(objecttype)%(then)%(taggername)%0a%(contents)%(end)%00'
  n=$(grep -z -c -i -F -f "$fixos" "$tmpd/refs_pub")
  [ "$n" -eq 0 ] || echo "($n ref(s))" | relata "termo proibido em nome de branch ou tag, ou em tag anotada"
  le nomes log $PUBLICAVEL --format='%an%n%cn'
  n=$(sort -u "$tmpd/nomes" | grep -c -i -F -f "$fixos")
  [ "$n" -eq 0 ] || echo "($n nome(s))" | relata "termo proibido em nome de autor ou committer"

  le autores log $PUBLICAVEL --format='%ae%n%ce'
  sort -u "$tmpd/autores" | grep -v -x -F "$AUTOR" | sed 's/.*/(e-mail fora do padrão no histórico)/' \
    | relata "autor ou committer diferente de $AUTOR"
fi
if git rev-parse -q --verify HEAD >/dev/null; then
  le reflog reflog
  grep -E -i 'amend|rebase|squash' "$tmpd/reflog" | cut -d' ' -f1 \
    | relata "amend, rebase ou squash no reflog"
fi

# Nomes de arquivo e de pasta, no índice e no histórico: só a contagem, nunca o nome.
# Separados por NUL, para que um nome com quebra de linha não se parta.
le nomes_indice ls-files -z --cached
n=$(cat "$tmpd/nomes_hist" "$tmpd/nomes_indice" | grep -z -c -i -F -f "$fixos")
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

le refs for-each-ref --format='%(refname)'
locais=$(grep -v -c -E '^refs/(heads|tags|remotes)/' "$tmpd/refs")
[ "$locais" -eq 0 ] || echo "SIGILO: aviso: $locais ref(s) local(is) de ferramenta fora de branches e tags; não são publicadas por git push"

[ ! -e "$marca" ] || exit 1
echo "SIGILO OK"
