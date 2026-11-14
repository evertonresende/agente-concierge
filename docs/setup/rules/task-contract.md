# Contrato de Task

Resolve: "entendi" sem entender, entrega mínima que ignora intenção, escopo derivando, usuário iterando demais pra chegar onde pediu.

Vale pra **task não-trivial**: toca >1 arquivo, tem ambiguidade, ou o resultado importa. Fix de typo e pergunta direta ficam de fora.

## Antes de executar

1. **Restate como critérios de aceite** — 3-7 bullets, cada um verificável sim/não. Não é parafrasear o pedido; é extrair o que "pronto" significa. Parafrase = teatro de compreensão.
2. **Declarar não-escopo** — 1-3 bullets do que NÃO vai fazer (é onde o desvio de escopo morre).
3. **Dúvidas reais numa rodada só** — perguntar ANTES o que não dá pra inferir do repo; nunca perguntar o que um grep responde.
4. Task grande/arquitetural → plan mode (seção Escalação do CLAUDE.md).
5. Multi-step → TaskCreate pra progresso visível.

## Durante

- Critério revelou-se impossível/errado → PARAR e avisar. Nunca entregar substituto silencioso.
- Descoberta que muda escopo → avisar antes de seguir, não "aproveitar que tô aqui".
- Fora do contrato = não fazer.

## Antes de declarar pronto — gate

1. Reler critérios 1 a 1 → **evidência concreta de cada**: teste verde, screenshot, output de comando, diff apontado. "Deve funcionar" não é evidência.
2. Critério sem evidência = task NÃO terminou. Continuar trabalhando, não entregar com ressalva escondida no meio do texto.
3. Self-review antes de entregar: diff completo relido; **diff não-trivial → Task `code-reviewer` SEMPRE** (tokens são baratos, iteração do usuário não) e achados corrigidos antes da entrega; UI → loop visual da skill `design-guidelines`; comportamento de app → rodar de verdade (skill `verify`) em vez de inferir.
4. Entrega estruturada: o que foi feito, evidência por critério, o que ficou de fora (citando o não-escopo).

## Anti-padrões

- ❌ "Entendi, vou fazer X" e partir pro código sem critérios
- ❌ Declarar pronto com "deve funcionar" / "acredito que resolve"
- ❌ Entregar 80% e deixar o usuário descobrir os 20%
- ❌ Perguntar o que o repo responde (custo de uma iteração > custo de um grep)
- ❌ Critérios genéricos ("código limpo", "funcionando") — se não dá pra checar sim/não, não é critério
