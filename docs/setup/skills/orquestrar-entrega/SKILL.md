---
name: orquestrar-entrega
description: Playbook para entrega grande em DUAS sessões separadas — (1) Discovery, que explora e escreve o backlog coordenado e termina emitindo o prompt da coordenadora; (2) Coordenadora, que assume o backlog pronto, gera prompts por frente, paraleliza em worktrees, mergeia com disciplina e confere cada entrega. Use quando o usuário pedir um discovery, um backlog coordenado ou a coordenação de sessões paralelas.
---

<!--
  Cópia reduzida para docs/setup/ (entrega do agente concierge).

  A skill original foi escrita para outro orquestrador de sessões. Nesta entrega valeram
  só o formato do backlog e a disciplina da coordenadora (docs/prompts/01-planejamento.md
  e 02-coordenadora.md dizem isso); os comandos daquele orquestrador e os scripts da skill
  não rodaram. Saíram: os comandos e scripts do outro orquestrador (abrir e fechar abas,
  watchdog, sucessão automática, ajuste da janela de contexto), as medições de outros
  projetos e nomes de outras entregas. As frentes desta entrega rodaram como threads do
  T3 Code ou como subagentes em worktree.
-->
<!-- PREENCHER: revisão do Éverton desta cópia -->

> Cópia reduzida da skill do ambiente do autor. Revisão do Éverton: a preencher.

# Orquestrar entrega grande

Siga este playbook literalmente — os templates existem para você NÃO improvisar.

## Duas sessões distintas (NÃO junte)

- **Discovery** é read-heavy: enche o contexto de código, grep e excerto. Produz o backlog.
- **Coordenação** exige contexto LIMPO: só o mapa, para durar muitas levas.

Como o backlog é um **arquivo auto-contido**, uma coordenadora nova o lê frio sem perder
nada (e isso prova que o backlog ficou bom). A Discovery termina escrevendo o backlog,
commitando e emitindo o prompt da coordenadora; não segue coordenando.

## Regra-zero da coordenadora (nunca quebrar)

**A coordenadora NUNCA edita código de produto e NUNCA faz deploy fora de ordem
explícita.** Só edita o backlog (`docs/exploracoes/BACKLOG-{{SLUG}}-{{AAAA-MM}}.md`) e docs
de coordenação, e faz git (merge, tag). Prestes a abrir arquivo de código para editar →
**PARE**: é trabalho de frente, gere o prompt dela.

Quatro julgamentos que a coordenadora não negocia:

- **Confira a sobreposição de arquivos antes de despachar uma leva.** Sem isso, conflito de
  merge é certo.
- **Sessão paralela exige worktree por frente** — o mesmo checkout se sobrescreve.
- **Nunca mergeie confiando no relatório da frente**; verifique antes.
- **Modo autônomo:** a sessão decide o simples, registra e nunca trava; merge e deploy
  seguem gated.

## Subagente ou sessão? (decida por frente)

| A frente… | Vai de |
|:---|:---|
| edita código, é bounded, cabe num passe | **subagente com worktree própria** (sem isso ele escreve no checkout da coordenadora) |
| é read-only: auditoria, mapa, busca ampla | **subagente normal** |
| é longa, precisa de servidor local ou vai sobreviver a compactação | **sessão própria** |
| precisa ficar viva para outras dependerem dela | **sessão própria** |

O overlap de arquivos é checado do mesmo jeito: duas worktrees não colidem no disco, mas
colidem no merge. Peça veredito e caminho, nunca o diff inteiro. Subagente é braço, não
licença: o prompt dele tem o mesmo rigor do prompt de frente.

## Não leia diff — delegue a verificação

O diff entra inteiro no contexto da coordenadora e fica lá até a próxima compactação.
**Faça assim:** subagente de verificação por frente, com o critério de aceite no prompt,
que devolve só `VEREDITO: ok|falhou`, o que provou e o caminho de qualquer coisa que não
bateu. A coordenadora roda com as próprias mãos o que é barato e decisivo: `git log
--oneline`, `git diff --stat` e a suíte. Exceção: merge com conflito, que é decisão dela.

## Fase 1 — Discovery

**Antes de fatiar em frentes, inventarie os outcomes omitíveis.** Releia o pedido e liste
cada resultado pedido que poderia ficar de fora sem quebrar nada visível. Cada item sai da
Fase 1 como **critério de aceite de alguma frente** ou como linha de não-escopo com motivo.
Grave o inventário no backlog (`## Outcomes pedidos`).

Explore com scouts em paralelo (subagentes read-only) e escreva o backlog com o esqueleto
abaixo. O nome do arquivo é específico (`BACKLOG-{{SLUG}}-{{AAAA-MM}}.md`), nunca
`BACKLOG.md` genérico, e todo prompt cita o caminho completo.

```markdown
# Backlog — {{título da entrega}}

## Mapa de sessões (mantido pela coordenadora)

| Sessão | Repo | Escopo resumido | Depende de | Prioridade | Status | Worktree/Thread |
|---|---|---|---|---|---|---|
| A | {{repo}} | {{...}} | — | alta | pendente | — |

Status é enumerado: `pendente` · `pronta` · `rodando` · `concluída` · `bloqueada` ·
`falhou`. Só vira `concluída` com evidência conferida pela coordenadora.

**Log de execução** (data · sessão · resultado · commits):
- _(vazio)_

## Outcomes pedidos (nenhum fica sem dono)

| # | Outcome pedido | Coberto por | Como se prova |
|---|---|---|---|

## Critérios de integração (rodam na branch de integração, não nas frentes)

1. {{outcome que só existe com o trabalho composto}}
   CHECK: {{comando exato}}
   ESPERA: {{marcador de sucesso}}

## Configuração de execução (respondida na Discovery — NÃO reperguntar)

| Decisão | Resposta |
|---|---|

---

## Sessão A — {{nome}}
### Contexto (verificado)
{{fatos com arquivo:linha — não "acho que"}}
### Tasks
- [ ] {{task verificável}}
### Critérios de aceite (sim/não — cada um com seu comando)
1. {{outcome observável}}
   CHECK: {{comando exato, rodável da raiz do repo da frente}}
   ESPERA: {{marcador que só aparece se tudo passou}}
2. {{outcome que nenhum comando decide}}
   MANUAL: {{o fato mínimo registrado como prova}}
### Não-escopo
- {{o que NÃO fazer}}
### Dependências
{{o que precisa estar mergeado antes}}
```

**Estado nunca vive em spec separada.** Status, log, dependências e configuração ficam no
backlog, fonte única.

### Tamanho de frente — pequena por padrão

- **1 outcome verificável por frente**, até 3 tasks, diff esperado de até ~10 arquivos.
- Maior que isso → A1 → A2 com dependência explícita e o contrato entre elas escrito.
- Fatie por **outcome**, não por arquivo: duas frentes no mesmo arquivo em sequência é
  normal; em paralelo é overlap.

### Critério que pode falhar (senão o registro vira teatro)

- **Observe o artefato que o critério nomeia.** Rodar a suíte inteira prova que a suíte
  passa, não que o comportamento novo existe.
- **Marcador só de sucesso, impresso depois de todos os asserts.** Cumprido = saída 0 **e**
  `ESPERA` casando na saída.
- **Ausência exige controle positivo.** Antes de confiar em "não existe mais X", rode o
  mesmo comando contra um caso onde X existe e confirme que ele reprova.
- **Número do briefing nunca vira o próprio `ESPERA`.** O comando mede do dado-fonte.
- **Comando determinístico e portável:** a coordenadora vai re-rodar noutra worktree.
- **`MANUAL:` é exceção.** Critério de dinheiro, auth, webhook ou dado de cliente que virou
  manual "porque é difícil automatizar" é o que mais precisa do comando.

🔴 **Os critérios de integração rodam desde a leva 1, vermelhos — não no fim.** Eles são a
única coisa que prova a junta entre frentes: cada peça pode passar isolada e a junta
falhar. Rodando cedo, cada defeito aparece enquanto a frente dona do arquivo ainda está
aberta.

### Fechamento da Discovery

Commite **e pushe** o backlog. Depois emita o prompt da coordenadora (auto-contido: caminho
absoluto do backlog, configuração já decidida, ciclo da coordenação) e **PARE**.

## Ciclo da coordenadora

Proponha a próxima leva (dependências, prioridade, checagem de overlap) → gere os prompts
prontos → despache → ingira os relatórios → verifique (CHECKs do backlog e verificador
independente) → atualize o backlog → mergeie `--no-ff` → rode as suítes → repita. Toda
decisão e todo resultado vira uma linha no log do backlog.
