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
rodar() { saida=$(bash "$GATE" 2>&1); cod=$?; }
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
echo zqxwfirma > "$AGENTE_CFG/sigilo-extra"
rodar; espera_codigo 0

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

caso="f) repositório limpo"
novo_repo f
rodar; espera_codigo 0; [ "$(tail -n 1 <<<"$saida")" = "SIGILO OK" ] || falha "a última linha não é SIGILO OK"

if [ ${#falhas[@]} -eq 0 ]; then echo "TESTE DO GATE OK"; exit 0; fi
printf 'FALHOU: %s\n' "${falhas[@]}"; exit 1
