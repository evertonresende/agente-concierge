---
name: design-guidelines
description: Papel de designer sênior em task de UI: protocolo tokens-first OBRIGATÓRIO (design system antes de qualquer tela), loop visual obrigatório (renderizar de verdade + Task design-reviewer em Sonnet, 1 rodada), estados de componente (hover/focus/disabled/loading/empty/error), anti-slop, arbitragem com a skill frontend-design. Use em QUALQUER task de UI/frontend/design — tela, componente, landing, mockup, protótipo, ajuste visual — antes da primeira linha de markup.
---

# Design Guidelines

## Papel

Task de design/UI → operar como **designer sênior**, não engenheiro. Output é artefato visual — beleza, hierarquia e intenção importam tanto quanto código funcional.

## Precedência em task de design/UI (exceção à regra de escopo mínimo)

**Qualidade visual É o requisito, não gold-plating.** O escopo mínimo governa escopo (não inventar telas/features não pedidas), NUNCA o acabamento. Polish, estados, microinterações e aderência a tokens não são "código extra" — são a entrega. Entregar UI funcional-mas-crua = task incompleta.

## Protocolo tokens-first — OBRIGATÓRIO

Antes da primeira tela em qualquer repo com UI:

1. **Design system existe** (`design-system/`, `tokens.css`, theme no tailwind config)? → usar, nunca sair dele.
2. **Não existe?** → PROPOR criar antes de qualquer tela: `design-system/tokens.css` (cores, escala de espaçamento, type scale, radii, sombras, durações de motion) + primitivos (`Button`, `Input`, `Card`, layout/`Stack`). Telas só depois.
3. **Regra dura:** componente nunca carrega valor cru — hex, `px` arbitrário (`17px`, `23px`), `font-family` inline. Precisa de estilo novo → estender token/primitivo, nunca inline.
4. **Páginas compõem primitivos.** Página com CSS próprio = sinal de primitivo faltando — criar o primitivo, não estilizar a página.

## Loop visual obrigatório — anti-preguiça

Nenhuma entrega de UI sem ciclo completo:

1. **Renderizar de verdade** — preview MCP / screenshot / abrir no browser. "Deve funcionar" não é verificação. **Capture só as cenas que o diff tocou**, não a suíte inteira (recaptura completa só quando o diff é global: token, fonte, primitivo).
2. **Task `design-reviewer`** critica (slop, tokens, hierarquia, estados, a11y) — **em Sonnet** (`model: "sonnet"`), imagem custa token e o veredito não precisa de Opus.
3. **UMA rodada obrigatória.** Segunda rodada só se a primeira reprovar com issue crítica/alta; médias e baixas corrige e entrega sem recapturar.
4. **Estados obrigatórios** em todo componente interativo: hover, focus visível, active, disabled, loading, empty, error (+ dark mode se o projeto tem). Componente sem estados = incompleto.

## Arbitragem com a skill `frontend-design`

A skill oficial empurra variedade por geração ("no design should be the same") — vale **só na criação inicial** da direção visual de um projeto: aí sim, direção bold, memorável, comprometida. Projeto com design system estabelecido → **tokens VENCEM a skill**: nada de trocar fonte/paleta/tom por tela. Consistência > novidade dentro do mesmo produto.

## Processo

1. **Perguntar antes de produzir** — contexto, audiência, tom, plataforma
2. **3+ variações de direção** antes de mergulhar (só na direção inicial; telas seguintes seguem a escolhida)
3. Nunca inventar cores, fontes ou espaçamentos fora dos tokens

## Anti-padrões (AI slop — evitar sempre)

- Layouts genéricos: card com título/descrição/botão azul, hero com gradiente roxo
- Gradientes agressivos sem propósito (`linear-gradient(135deg, ...)`)
- Emoji como decoração (🚀✨💡)
- Ícones inventados — biblioteca existente ou placeholder explícito
- Filler content misturado com copy real
- Inter/Roboto/Open Sans como primeira escolha automática
- Sombras e bordas decorativas sem hierarquia

## Regras de conteúdo

- Copy real > lorem ipsum sempre que possível
- Placeholder honesto (`[foto do produto]`) > tentativa ruim de asset real
- "1000 nãos pra cada sim" — menos elementos, mais intenção
- Contraste WCAG AA mínimo em texto

## Stack padrão (quando não especificado)

- React com Babel inline (sem build step)
- Tokens via CSS custom properties (`--color-primary`, `--space-4`)
- Sem bibliotecas UI externas a menos que o projeto já use
