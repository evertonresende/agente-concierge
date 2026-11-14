#!/usr/bin/env bash
# Valida o ambiente `producao` sem nenhum POST ao webhook real (docs/VERIFICACOES.md §5).
#
# Uso: scripts/validar-producao.sh [modo] [--paralelo N] [--pausa-ms N] [--timeout-ms N]
#   (sem modo)    /saude (secrets presentes, ambiente producao, destino real, envio
#                 desligado), LEADS REAIS antes e depois, e o conjunto dev inteiro sem os
#                 casos de confirmação (a trava do runner os recusa fora de dev) → PRODUCAO OK
#                 só com o veredito do runner e um mínimo de casos executados. Os extras
#                 aceitos são só os três acima, repassados ao runner.
#   --so-leitura  só o GET no webhook real → LEADS REAIS: <n>
#                 Exige zero lead real antes e depois: depois da entrega, use --entrega.
#   --clientes    um turno sem confirmação no POST /chat com curl, Python requests,
#                 Python urllib e fetch do Node, cada um com o agente de usuário padrão
#                 → CLIENTES OK (cada resposta com x-chamadas-modelo > 0). Confere só ambiente=producao, não o envio: a mensagem é
#                 fixa e não confirma nada, então não gera lead.
#   --entrega     /saude com o envio ligado e LEADS REAIS; reprova se o envio estiver
#                 desligado. Não manda nenhuma conversa.
#   --autoteste   confere as funções do script, sem rede → AUTOTESTE OK
#
# Os endereços vêm de ~/.config/agente-concierge/env (ou do arquivo em $AGENTE_ENV) e
# nunca aparecem na saída nem em argumento de linha de comando de processo filho.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 -I - "$@" <<'PY'
import json, os, re, shutil, socket, subprocess, threading, sys, tempfile, urllib.error, urllib.parse, urllib.request, uuid

MODOS = {"--so-leitura", "--clientes", "--entrega", "--autoteste"}
MENSAGEM = "Olá! Em quais cidades vocês têm imóveis?"
VARIAVEIS = ("CATALOGO_URL", "LEADS_URL", "AMBIENTE", "MODELO", "ENVIO_LEADS")
CONHECIDOS = {"producao", "dev", "real", "falso", "ligado", "desligado", None}
TEMPO_S = 60
TEMPO_DO_RUNNER_S = 2 * 3600
EXTRAS_ACEITOS = {"--paralelo", "--pausa-ms", "--timeout-ms"}
# Em 14/11, 69 dos 98 casos do conjunto dev rodam fora de dev (os outros 29 a trava recusa).
# ponytail: piso fixo; se a B2 remarcar muitos casos como só-dev, ajustar aqui.
MINIMO_DE_CASOS = 60


class Falha(Exception):
    pass


def ler_env(caminho):
    valores = {}
    with open(caminho, encoding="utf-8") as arquivo:
        for linha in arquivo:
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                nome, valor = linha.split("=", 1)
                valores[nome.removeprefix("export ").strip()] = valor.strip().strip("'\"")
    return valores


def url_leads(catalogo_url):
    """Contrato §8: a URL real de leads é a do catálogo trocando o segmento `catalogo` por `leads`."""
    partes = urllib.parse.urlsplit(catalogo_url)
    segmentos = partes.path.split("/")
    if partes.scheme != "https" or segmentos.count("catalogo") != 1:
        raise Falha("CATALOGO_URL fora do formato esperado")
    segmentos[segmentos.index("catalogo")] = "leads"
    return urllib.parse.urlunsplit(partes._replace(path="/".join(segmentos)))


def enderecos_ip(host):
    try:
        return {info[4][0] for info in socket.getaddrinfo(host, None)}
    except OSError:
        return set()


def exigir_ferramentas(*nomes):
    faltando = [nome for nome in nomes if shutil.which(nome) is None]
    if faltando:
        raise Falha("falta a ferramenta: " + ", ".join(faltando))


class Limpador:
    """Tira da saída qualquer endereço, inclusive os que vêm em texto de terceiros."""

    def __init__(self, valores):
        segredos = set()
        for valor in valores:
            if valor:
                segredos.add(valor)
                host = urllib.parse.urlsplit(valor).hostname
                if host:
                    segredos.add(host)
                    segredos.update(enderecos_ip(host))
        self.segredos = sorted(segredos, key=len, reverse=True)

    def __call__(self, texto):
        for segredo in self.segredos:
            texto = re.sub(re.escape(segredo), "<oculto>", texto, flags=re.IGNORECASE)
        return re.sub(r"https?://\S+", "<url>", texto)


class SemRedirecionar(urllib.request.HTTPRedirectHandler):
    """Nenhum 3xx é seguido: a resposta de redirecionamento volta como erro HTTP."""

    def redirect_request(self, *args, **kwargs):
        return None


ABRIR = urllib.request.build_opener(SemRedirecionar).open


def obter(url):
    """Só GET: a função não aceita corpo nem método, então não tem como fazer POST."""
    pedido = urllib.request.Request(url, method="GET", headers={"User-Agent": "validar-producao/1"})
    try:
        with ABRIR(pedido, timeout=TEMPO_S) as resposta:
            return resposta.status, resposta.headers.get("content-type", ""), resposta.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as erro:
        return erro.code, erro.headers.get("content-type", ""), erro.read().decode("utf-8", "replace")
    except Exception as erro:  # o texto do erro pode trazer o host: só a classe sai
        raise Falha(f"sem resposta ({type(erro).__name__})") from None


def contar_leads(status, tipo, corpo):
    """Falha fechada: só um 200 com {"leads": [...]} vira número; o resto reprova."""
    if status != 200 or "json" not in tipo:
        raise Falha(f"GET no webhook real: HTTP {status}, tipo {tipo or 'nenhum'}")
    try:
        dado = json.loads(corpo)
    except ValueError:
        raise Falha("GET no webhook real: corpo não é JSON") from None
    if not isinstance(dado, dict) or not isinstance(dado.get("leads"), list):
        raise Falha("GET no webhook real: resposta sem a lista leads")
    return len(dado["leads"])


def mostrar(valor):
    return repr(valor) if valor in CONHECIDOS else "<outro>"


def problemas_da_saude(dado, envio_esperado):
    if not isinstance(dado, dict):
        return ["/saude não devolveu um objeto JSON"]
    problemas = []
    variaveis = dado.get("variaveis") if isinstance(dado.get("variaveis"), dict) else {}
    ausentes = [nome for nome in VARIAVEIS if variaveis.get(nome) is not True]
    if ausentes or dado.get("ok") is not True:
        problemas.append("variáveis ausentes: " + (", ".join(ausentes) or "ok diferente de true"))
    for campo, esperado in (("ambiente", "producao"), ("leads_destino", "real"), ("envio_leads", envio_esperado)):
        if dado.get(campo) != esperado:
            problemas.append(f"{campo}={mostrar(dado.get(campo))}, esperado {esperado!r}")
    return problemas


def ler_saude(agente):
    status, tipo, corpo = obter(agente + "/saude")
    if status != 200 or "json" not in tipo:
        raise Falha(f"/saude: HTTP {status}, tipo {tipo or 'nenhum'}")
    try:
        return json.loads(corpo)
    except ValueError:
        raise Falha("/saude: corpo não é JSON") from None


def exigir_saude(agente, envio_esperado):
    dado = ler_saude(agente)
    problemas = problemas_da_saude(dado, envio_esperado)
    if problemas:
        raise Falha("/saude: " + "; ".join(problemas))
    print("SECRETS: CATALOGO_URL e LEADS_URL presentes")
    print("SAUDE: ambiente=producao, leads_destino=real")
    return dado


def avaliar_chat(status, tipo, corpo, chamadas=""):
    """None quando é a resposta do agente; senão o motivo, sem conteúdo da página."""
    codigo = re.search(r"[Ee]rror(?: code:)? (1\d{3})", corpo or "")
    if codigo:
        return f"página de bloqueio da Cloudflare (HTTP {status}, erro {codigo.group(1)})"
    if 300 <= status < 400:
        return f"redirecionamento HTTP {status}, recusado"
    if status != 200:
        return f"HTTP {status}"
    if "json" not in (tipo or ""):
        return f"HTTP 200 sem JSON (tipo {tipo or 'nenhum'}), provável página de bloqueio"
    try:
        dado = json.loads(corpo)
    except ValueError:
        return "HTTP 200 com corpo que não é JSON"
    if not isinstance(dado, dict) or not isinstance(dado.get("reply"), str) or not isinstance(dado.get("handoff"), bool):
        return "JSON sem reply e handoff"
    if not (chamadas or "").strip().isdigit() or int(chamadas) < 1:
        return "cabeçalho x-chamadas-modelo ausente ou zero (o modelo não respondeu)"
    return None


def corpo_do_chat(cliente):
    return {"session_id": f"validar-producao-{cliente}-{uuid.uuid4().hex[:8]}", "message": MENSAGEM}


def chat_curl(url):
    with tempfile.TemporaryDirectory() as pasta:
        config, saida = os.path.join(pasta, "config"), os.path.join(pasta, "corpo")
        with open(os.open(config, os.O_WRONLY | os.O_CREAT, 0o600), "w") as arquivo:
            arquivo.write(f'url = "{url}"\n')
        processo = subprocess.run(
            ["curl", "-q", "-sS", "--max-time", str(TEMPO_S), "--config", config, "-H", "Content-Type: application/json",
             "--data-binary", "@-", "-o", saida, "-w", "%{http_code}\\n%{content_type}\\n%header{x-chamadas-modelo}"],
            input=json.dumps(corpo_do_chat("curl")).encode(), capture_output=True)
        if processo.returncode != 0:
            raise Falha(f"curl saiu com código {processo.returncode}")
        status, tipo, chamadas = (processo.stdout.decode().split("\n") + ["", ""])[:3]
        with open(saida, encoding="utf-8", errors="replace") as arquivo:
            return int(status), tipo, arquivo.read(), chamadas


def chat_requests(url):
    try:
        import requests
    except ImportError:
        raise Falha("falta a ferramenta: requests (Python)") from None
    try:
        resposta = requests.post(url, json=corpo_do_chat("requests"), timeout=TEMPO_S, allow_redirects=False)
    except Exception as erro:
        raise Falha(f"sem resposta ({type(erro).__name__})") from None
    return (resposta.status_code, resposta.headers.get("content-type", ""), resposta.text,
            resposta.headers.get("x-chamadas-modelo", ""))


def chat_urllib(url):
    pedido = urllib.request.Request(url, data=json.dumps(corpo_do_chat("urllib")).encode(),
                                    headers={"Content-Type": "application/json"})
    try:
        with ABRIR(pedido, timeout=TEMPO_S) as resposta:
            return (resposta.status, resposta.headers.get("content-type", ""), resposta.read().decode("utf-8", "replace"),
                    resposta.headers.get("x-chamadas-modelo", ""))
    except urllib.error.HTTPError as erro:
        return erro.code, erro.headers.get("content-type", ""), erro.read().decode("utf-8", "replace"), ""
    except Exception as erro:
        raise Falha(f"sem resposta ({type(erro).__name__})") from None


NODE_FETCH = """
try {
  const r = await fetch(process.env.ALVO_CHAT, { method: "POST", headers: { "content-type": "application/json" }, body: process.env.CORPO_CHAT, redirect: "manual" });
  process.stdout.write(JSON.stringify({ status: r.status, tipo: r.headers.get("content-type") ?? "", corpo: await r.text(), chamadas: r.headers.get("x-chamadas-modelo") ?? "" }));
} catch (e) {
  process.stdout.write(JSON.stringify({ erro: e?.name ?? "Error" }));
}
"""


def chat_node(url):
    ambiente = {"PATH": os.environ.get("PATH", ""), "ALVO_CHAT": url, "CORPO_CHAT": json.dumps(corpo_do_chat("node"))}
    try:
        processo = subprocess.run(["node", "--input-type=module", "-e", NODE_FETCH], env=ambiente,
                                  capture_output=True, timeout=TEMPO_S + 10)
    except subprocess.TimeoutExpired:
        raise Falha("sem resposta (tempo esgotado)") from None
    try:
        dado = json.loads(processo.stdout)
    except ValueError:
        raise Falha(f"node saiu com código {processo.returncode}") from None
    if "erro" in dado:
        raise Falha(f"sem resposta ({dado['erro']})")
    return dado["status"], dado["tipo"], dado["corpo"], dado["chamadas"]


# O runner só aceita o alvo por argumento; aqui ele entra pelo ambiente, fora da lista de processos.
NODE_RUNNER = """
import { pathToFileURL } from "node:url";
process.argv = [process.argv[0], process.env.RUNNER_EVAL, "--alvo", process.env.ALVO_EVAL, ...JSON.parse(process.env.ARGS_EVAL)];
await import(pathToFileURL(process.env.RUNNER_EVAL).href);
"""


def validar_extras(extras):
    """Só opções que não trocam o alvo, o conjunto nem os casos, cada uma com valor inteiro."""
    if len(extras) % 2:
        raise Falha("argumentos extras incompletos (cada opção leva um valor)")
    for opcao, valor in zip(extras[::2], extras[1::2]):
        if opcao not in EXTRAS_ACEITOS or not valor.isdigit():
            raise Falha(f"argumento extra não aceito: {opcao} (aceitos: {', '.join(sorted(EXTRAS_ACEITOS))})")


def veredito_das_evals(codigo, linhas):
    """None quando o runner rodou o conjunto dev sem reprovar; senão o motivo."""
    executados = sum(1 for linha in linhas if linha.startswith(("[PASSOU] ", "[FALHOU] ")))
    if codigo not in (0, 2) or not any(linha in ("EVAL OK", "EVAL PARCIAL") for linha in linhas):
        return f"evals do conjunto dev reprovaram (runner saiu com {codigo})"
    if executados < MINIMO_DE_CASOS:
        return f"só {executados} caso(s) executado(s); o mínimo é {MINIMO_DE_CASOS}"
    return None


def rodar_evals(agente, extras, limpar):
    ambiente = {chave: os.environ[chave] for chave in ("PATH", "HOME", "LANG") if chave in os.environ}
    ambiente.update(ALVO_EVAL=agente, RUNNER_EVAL=os.path.abspath("evals/rodar.mjs"),
                    ARGS_EVAL=json.dumps(["--conjunto", "dev", "--sem-relatorio", *extras]))
    processo = subprocess.Popen(["node", "--input-type=module", "-e", NODE_RUNNER], env=ambiente,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace")
    relogio = threading.Timer(TEMPO_DO_RUNNER_S, processo.kill)  # morto, sai com código negativo e reprova
    relogio.start()
    linhas = []
    try:
        for linha in processo.stdout:
            linhas.append(linha.rstrip("\n"))
            print(limpar(linhas[-1]), flush=True)
        return processo.wait(), linhas
    finally:
        relogio.cancel()


def leads_reais(url):
    total = contar_leads(*obter(url))
    print(f"LEADS REAIS: {total}", flush=True)
    return total


def modo_completo(agente, leads, extras, limpar):
    exigir_ferramentas("node")
    exigir_saude(agente, "desligado")
    print("ENVIO: desligado")
    if leads_reais(leads) != 0:
        raise Falha("já existe lead no webhook real antes das evals")
    motivo = veredito_das_evals(*rodar_evals(agente, extras, limpar))
    depois = leads_reais(leads)
    if motivo:
        raise Falha(motivo)
    if depois != 0:
        raise Falha("as evals deixaram lead no webhook real")
    print("PRODUCAO OK")


def modo_clientes(agente):
    exigir_ferramentas("curl", "node")
    dado = ler_saude(agente)
    if not isinstance(dado, dict) or dado.get("ambiente") != "producao":
        raise Falha("/saude não mostra ambiente producao; nenhuma conversa enviada")
    falhas = []
    for nome, cliente in (("curl", chat_curl), ("python-requests", chat_requests),
                          ("python-urllib", chat_urllib), ("node-fetch", chat_node)):
        try:
            motivo = avaliar_chat(*cliente(agente + "/chat"))
        except Falha as erro:
            motivo = str(erro)
        print(f"CLIENTE {nome}: {'200 OK' if motivo is None else 'FALHOU, ' + motivo}", flush=True)
        if motivo is not None:
            falhas.append(nome)
    if falhas:
        raise Falha("clientes com falha: " + ", ".join(falhas))
    print("CLIENTES OK")


def modo_entrega(agente, leads):
    dado = ler_saude(agente)
    if isinstance(dado, dict) and dado.get("envio_leads") == "desligado":
        print("ENVIO: desligado")
        raise Falha("o envio real de leads está desligado")
    exigir_saude(agente, "ligado")
    print("ENVIO: ligado")
    leads_reais(leads)
    print("ENTREGA OK")


def autoteste():
    catalogo = "https://api.exemplo.invalid/catalogo/tok123"
    assert url_leads(catalogo) == "https://api.exemplo.invalid/leads/tok123"
    for invalida in ("https://api.exemplo.invalid/tok123", "http://api.exemplo.invalid/catalogo/x",
                     "https://a.invalid/catalogo/catalogo"):
        try:
            url_leads(invalida)
            raise AssertionError(invalida)
        except Falha:
            pass
    assert contar_leads(200, "application/json; charset=utf-8", '{"leads": []}') == 0
    assert contar_leads(200, "application/json", '{"leads": [{}, {}]}') == 2
    for resposta in ((403, "text/html", "<html>"), (200, "text/html", "<html>"), (200, "application/json", "{}"),
                     (200, "application/json", "[]"), (200, "application/json", "x")):
        try:
            contar_leads(*resposta)
            raise AssertionError(resposta)
        except Falha:
            pass
    boa = {"ok": True, "ambiente": "producao", "leads_destino": "real", "envio_leads": "desligado",
           "variaveis": dict.fromkeys(VARIAVEIS, True)}
    assert problemas_da_saude(boa, "desligado") == []
    assert len(problemas_da_saude(boa, "ligado")) == 1
    assert problemas_da_saude({**boa, "ambiente": "dev", "leads_destino": "falso"}, "desligado") == [
        "ambiente='dev', esperado 'producao'", "leads_destino='falso', esperado 'real'"]
    sem_leads = {**boa, "ok": False, "variaveis": {**boa["variaveis"], "LEADS_URL": False}}
    assert problemas_da_saude(sem_leads, "desligado") == ["variáveis ausentes: LEADS_URL"]
    assert "<outro>" in problemas_da_saude({**boa, "ambiente": "segredo.exemplo.invalid"}, "desligado")[0]
    assert problemas_da_saude([], "desligado") == ["/saude não devolveu um objeto JSON"]
    limpar = Limpador(["https://agente.exemplo.invalid", catalogo])
    assert limpar("falhou em agente.exemplo.invalid e api.exemplo.invalid") == "falhou em <oculto> e <oculto>"
    assert limpar("veja http://qualquer.invalid/x") == "veja <url>"
    assert limpar("HOST=AGENTE.EXEMPLO.INVALID") == "HOST=<oculto>"
    assert Limpador(["http://127.0.0.1:1"])("ip 127.0.0.1") == "ip <oculto>"
    assert avaliar_chat(200, "application/json", '{"reply": "Oi", "handoff": false}', "2") is None
    for chamadas in ("", "0", "x"):
        assert "x-chamadas-modelo" in avaliar_chat(200, "application/json", '{"reply": "Oi", "handoff": false}', chamadas)
    assert "1010" in avaliar_chat(403, "text/html", "<html>error code: 1010</html>")
    assert "bloqueio" in avaliar_chat(200, "text/html", "<html>desafio</html>")
    assert avaliar_chat(200, "application/json", '{"reply": 1}') == "JSON sem reply e handoff"
    assert avaliar_chat(530, "text/html", "x") == "HTTP 530"
    assert "redirecionamento" in avaliar_chat(307, "application/json", "{}")
    validar_extras(["--paralelo", "2", "--pausa-ms", "0"])
    for extras in (["--alvo", "x"], ["-h"], ["--listar"], ["--bloco", "marco1"], ["--conjunto", "dev"],
                   ["--paralelo"], ["--paralelo", "x"], ["--relatorio", "1"]):
        try:
            validar_extras(extras)
            raise AssertionError(extras)
        except Falha:
            pass
    passou = ["[PASSOU] b/c"] * MINIMO_DE_CASOS
    assert veredito_das_evals(2, passou + ["EVAL PARCIAL"]) is None
    assert veredito_das_evals(0, passou[:-1] + ["[FALHOU] b/d — x", "EVAL OK"]) is None
    assert veredito_das_evals(1, passou + ["EVAL REPROVADO"])
    assert veredito_das_evals(2, ["TRAVA: nenhum caso elegível", "EVAL PARCIAL"])
    assert veredito_das_evals(0, ["CASOS OK"])
    assert veredito_das_evals(2, passou[:-1] + ["EVAL PARCIAL"])
    assert veredito_das_evals(3, passou + ["EVAL PARCIAL"])
    print("AUTOTESTE OK")


def principal(argumentos):
    modo = argumentos[0] if argumentos and argumentos[0] in MODOS else None
    extras = argumentos[1:] if modo else argumentos
    if modo == "--autoteste":
        return autoteste()
    if modo and extras:
        raise Falha(f"{modo} não aceita argumentos extras")
    validar_extras(extras)
    ambiente = ler_env(os.environ.get("AGENTE_ENV") or os.path.expanduser("~/.config/agente-concierge/env"))
    faltando = [nome for nome in ("AGENTE_URL_PRODUCAO", "CATALOGO_URL") if not ambiente.get(nome)]
    if faltando:
        raise Falha("arquivo de ambiente sem " + ", ".join(faltando))
    agente = ambiente["AGENTE_URL_PRODUCAO"].rstrip("/")
    leads = url_leads(ambiente["CATALOGO_URL"])
    limpar = Limpador([agente, ambiente["CATALOGO_URL"], leads])
    try:
        if modo == "--so-leitura":
            leads_reais(leads)
        elif modo == "--clientes":
            modo_clientes(agente)
        elif modo == "--entrega":
            modo_entrega(agente, leads)
        else:
            modo_completo(agente, leads, extras, limpar)
    except Falha as erro:
        raise Falha(limpar(str(erro))) from None


try:
    principal(sys.argv[1:])
except Falha as erro:
    print(f"REPROVADO: {erro}")
    sys.exit(1)
except AssertionError as erro:
    print(f"AUTOTESTE FALHOU: {erro}")
    sys.exit(1)
except Exception as erro:  # nenhum traceback: ele pode carregar endereço
    print(f"REPROVADO: erro inesperado ({type(erro).__name__})")
    sys.exit(1)
PY
