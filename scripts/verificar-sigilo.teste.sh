#!/usr/bin/env bash
# Teste do gate de sigilo. Cada caso monta um repositório descartável numa pasta
# temporária, com uma configuração FALSA apontada por AGENTE_CFG. Todos os valores
# abaixo são inventados (hosts .invalid e .test). Não lê a configuração real, não usa
# rede e ignora a configuração global do git.
#
# Uso: scripts/verificar-sigilo.teste.sh [caminho do gate]
# Sai 0 com "TESTE DO GATE OK", ou lista o que falhou e sai 1.
set -u
GATE=$(realpath "${1:-$(dirname "$0")/verificar-sigilo.sh}")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
AUTOR=$(sed -n 's/^AUTOR="\(.*\)"$/\1/p' "$GATE")   # o único autor que o gate aceita
[ -n "$AUTOR" ] || { echo "FALHOU: não achei AUTOR no gate"; exit 1; }

HOST=api.zqxwkorp.invalid
TOKEN=tokzqxwvyk
EMPRESA=zqxwkorp
falhas=()

novo_repo() { # $1 = caso; $2 = host da CATALOGO_URL (opcional). Entra no repositório.
  local base="$TMP/$1"
  mkdir -p "$base/cfg" "$base/repo"
  printf 'CATALOGO_URL=https://%s/catalogo/%s\n' "${2:-$HOST}" "$TOKEN" > "$base/cfg/env"
  export AGENTE_CFG="$base/cfg"
  cd "$base/repo" || exit 1
  git init -q -b main
  git config user.name Teste
  git config user.email "$AUTOR"
  echo base > a.txt; git add a.txt; git commit -q -m "inicio"
}
rodar() { saida=$(env "$@" bash "$GATE" 2>&1); cod=$?; } # $@ = variáveis extras

# git falso: sai com 128 quando um argumento é igual a FALHA_GIT; senão chama o real.
mkdir -p "$TMP/bin"
printf '#!/bin/sh\nfor a in "$@"; do [ "$a" = "$FALHA_GIT" ] && exit 128; done\nexec %s "$@"\n' \
  "$(command -v git)" > "$TMP/bin/git"
chmod +x "$TMP/bin/git"
falhando() { rodar PATH="$TMP/bin:$PATH" FALHA_GIT="$1"; }
curto() { git rev-parse HEAD | cut -c1-8; }
falha() { falhas+=("$caso: $1"); }
espera_codigo() { [ "$cod" -eq "$1" ] || falha "saída $cod, esperava $1"; }
espera_texto() { grep -q -F -e "$1" <<<"$saida" || falha "faltou na saída: $1"; }
sem_pedaco() { # nenhum trecho de 4 caracteres do termo aparece na saída
  local i
  for ((i = 0; i + 4 <= ${#1}; i++)); do
    grep -q -i -F -e "${1:i:4}" <<<"$saida" && { falha "a saída mostra um pedaço do termo"; return; }
  done
}

caso="a) termo em stage"
novo_repo a
echo "token $TOKEN aqui" > b.txt; git add b.txt
rodar; espera_codigo 1; espera_texto "b.txt:1"; sem_pedaco "$TOKEN"

caso="b) termo num commit apagado no seguinte"
novo_repo b
echo "token $TOKEN" > b.txt; git add b.txt; git commit -q -m "adiciona b"; c=$(curto)
git rm -q b.txt; git commit -q -m "remove b"
rodar; espera_codigo 1; espera_texto "conteúdo de commit"; espera_texto "$c:b.txt"; sem_pedaco "$TOKEN"

caso="c) termo no início de uma linha do corpo da mensagem"
novo_repo c
git commit -q --allow-empty -m "docs: ajuste" -m "$HOST aparece no corpo"; c=$(curto)
rodar; espera_codigo 1; espera_texto "mensagem de commit"; espera_texto "$c"; sem_pedaco "$HOST"

caso="c2) byte 0x1E na mensagem antes do termo"
novo_repo c2
git commit -q --allow-empty -m "docs: ajuste" -m "$(printf '\036 %s' "$HOST")"; c=$(curto)
rodar; espera_codigo 1; espera_texto "$c"; sem_pedaco "$HOST"

caso="d) host com sufixo composto"
novo_repo d "api.$EMPRESA.com.test"
echo "desafio da ZqxwKorp" > c.txt; git add c.txt
rodar; espera_codigo 1; espera_texto "c.txt:1"; sem_pedaco "$EMPRESA"

caso="d) host sem nome de empresa utilizável e sem sigilo-extra"
novo_repo d2 "api.qz.com.test"
rodar; espera_codigo 2; sem_pedaco "api.qz.com.test"
: > "$AGENTE_CFG/sigilo-extra"
rodar; espera_codigo 2
echo zqxwfirma > "$AGENTE_CFG/sigilo-extra"
rodar; espera_codigo 0

caso="i) linha inválida no arquivo de ambiente"
for ruim in "TOKEN_X=$TOKEN)" "X=(\$TOKEN" "DEV_URL = https://$TOKEN.invalid" "X=\$(echo $TOKEN)"; do
  novo_repo i
  printf '%s\n' "$ruim" >> "$AGENTE_CFG/env"
  rodar; espera_codigo 2; sem_pedaco "$TOKEN"
  cd "$TMP" && rm -rf "$TMP/i"
done

caso="i2) export, aspas e comentário no arquivo de ambiente"
novo_repo i2
printf '# comentário\n\nexport FALSO_URL=https://zqxwfalso.invalid/lead\nB_URL="https://zqxwaspas.test/x"  # nota\n' >> "$AGENTE_CFG/env"
echo "zqxwfalso.invalid" > c.txt; git add c.txt
rodar; espera_codigo 1; espera_texto "c.txt:1"
git rm -q --cached c.txt; echo "zqxwaspas.test" > c.txt; git add c.txt
rodar; espera_codigo 1; espera_texto "c.txt:1"

caso="l) leitura do git que falha sai com 2"
novo_repo l1; echo "$EMPRESA" > c.txt; git add c.txt
falhando grep; espera_codigo 2
novo_repo l2; git commit -q --allow-empty -m "$HOST"
falhando log; espera_codigo 2
novo_repo l3; mkdir "d-$EMPRESA"; echo x > "d-$EMPRESA/x"; git add -A
falhando ls-files; espera_codigo 2
novo_repo l4; echo "$TOKEN" > b.txt; git add b.txt; git commit -q -m b; git rm -q b.txt; git commit -q -m rm
falhando --batch=; espera_codigo 2

caso="s) pasta temporária que não pode ser criada"
novo_repo s; git switch -q --orphan vazia; echo "$TOKEN" > b.txt; git add b.txt
rodar TMPDIR="$TMP/nao-existe"; espera_codigo 2

caso="k) branch órfã, sem commit no HEAD"
novo_repo k; echo "$TOKEN" > b.txt; git add b.txt; git commit -q -m b; git rm -q b.txt; git commit -q -m rm
git commit -q --allow-empty -m "$HOST"
git switch -q --orphan nova
rodar; espera_codigo 1; espera_texto "conteúdo de commit"; espera_texto "mensagem de commit"

caso="j) nome de branch, de tag e de autor, e mensagem de tag anotada"
novo_repo j1; git branch "frente-$EMPRESA"
rodar; espera_codigo 1; espera_texto "nome de branch ou tag"; sem_pedaco "$EMPRESA"
novo_repo j2; git tag "v1-$EMPRESA"
rodar; espera_codigo 1; espera_texto "nome de branch ou tag"; sem_pedaco "$EMPRESA"
novo_repo j3; git -c user.name="Ana $EMPRESA" commit -q --allow-empty -m "vazio"
rodar; espera_codigo 1; espera_texto "nome de autor ou committer"; sem_pedaco "$EMPRESA"
novo_repo j4; git tag -a v1 -m "$HOST"
rodar; espera_codigo 1; espera_texto "tag anotada"; sem_pedaco "$HOST"

caso="r) clone raso"
novo_repo r; git commit -q --allow-empty -m "segundo"
git clone -q --depth 1 "file://$PWD" "$TMP/r-raso" && cd "$TMP/r-raso"
rodar; espera_codigo 2

caso="e) termo em arquivo binário"
novo_repo e
printf 'PNG\0\0%s\0' "$TOKEN" > d.bin; git add d.bin
rodar; espera_codigo 1; espera_texto "d.bin"; sem_pedaco "$TOKEN"
git commit -q -m "adiciona d"; c=$(curto); git rm -q d.bin; git commit -q -m "remove d"
rodar; espera_codigo 1; espera_texto "$c:d.bin"

caso="g) termo no nome de um arquivo"
novo_repo g
echo "$TOKEN" > "notas-$EMPRESA.txt"; git add -A; git commit -q -m "notas"
rodar; espera_codigo 1; espera_texto "nome de arquivo"; espera_texto "localização omitida"; sem_pedaco "$EMPRESA"

caso="u) nome com quebra de linha, termo depois dela, só no histórico"
novo_repo u; n=$(printf 'a\nb-%s.txt' "$EMPRESA"); echo x > "$n"; git add -A; git commit -q -m n
git rm -q -- "$n"; git commit -q -m rm
rodar; espera_codigo 1; espera_texto "nome de arquivo"; sem_pedaco "$EMPRESA"

caso="v) termo não ASCII no nome de um arquivo"
novo_repo v; echo "zqxwøæå" > "$AGENTE_CFG/sigilo-extra"
echo "zqxwøæå" > "zqxwøæå.txt"; git add -A
rodar; espera_codigo 1; espera_texto "localização omitida"; sem_pedaco "zqxwøæå"

caso="w) linha enorme sem quebra"
novo_repo w; head -c 30000000 /dev/zero | tr '\0' a > g.txt; git add g.txt
inicio=$SECONDS
rodar SIGILO_TEMPO=20 timeout 60; espera_codigo 0
[ $((SECONDS - inicio)) -le 15 ] || falha "30 MB sem @ levou $((SECONDS - inicio)) s"
git rm -q --cached g.txt; { head -c 60000 /dev/zero | tr '\0' a; echo @; } > g.txt; git add g.txt
rodar SIGILO_TEMPO=2 timeout 60; espera_codigo 2

caso="f) repositório limpo"
novo_repo f
rodar; espera_codigo 0; [ "$(tail -n 1 <<<"$saida")" = "SIGILO OK" ] || falha "a última linha não é SIGILO OK"

if [ ${#falhas[@]} -eq 0 ]; then echo "TESTE DO GATE OK"; exit 0; fi
printf 'FALHOU: %s\n' "${falhas[@]}"; exit 1
