// Página mínima de chat: conversa pelo POST /chat. A versão com acabamento é de outra frente.
export const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Concierge</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 42rem; margin: 0 auto; padding: 1rem; }
  #conversa { display: flex; flex-direction: column; gap: .5rem; min-height: 60vh; }
  .msg { padding: .5rem .75rem; border-radius: .5rem; white-space: pre-wrap; max-width: 85%; }
  .hospede { align-self: flex-end; background: #dbeafe; }
  .agente { align-self: flex-start; background: #f1f5f9; }
  .handoff { border-left: 4px solid #b45309; }
  form { display: flex; gap: .5rem; margin-top: 1rem; }
  input { flex: 1; padding: .5rem; font: inherit; }
  button { padding: .5rem 1rem; font: inherit; }
</style>
</head>
<body>
<h1>Concierge</h1>
<div id="conversa" aria-live="polite"></div>
<form id="form">
  <label for="texto" hidden>Mensagem</label>
  <input id="texto" autocomplete="off" placeholder="Escreva sua mensagem" required>
  <button>Enviar</button>
</form>
<script>
  const sessao = crypto.randomUUID();
  const conversa = document.getElementById("conversa");
  const campo = document.getElementById("texto");
  function mostrar(texto, classe) {
    const div = document.createElement("div");
    div.className = "msg " + classe;
    div.textContent = texto;
    conversa.appendChild(div);
    div.scrollIntoView();
  }
  document.getElementById("form").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const message = campo.value;
    campo.value = "";
    mostrar(message, "hospede");
    try {
      const resposta = await fetch("/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessao, message }),
      });
      const dado = await resposta.json();
      mostrar(dado.reply + (dado.handoff ? "\\n[conversa passada para uma pessoa do time]" : ""), "agente" + (dado.handoff ? " handoff" : ""));
    } catch {
      mostrar("Não consegui falar com o servidor. Tente de novo.", "agente");
    }
  });
</script>
</body>
</html>`;
