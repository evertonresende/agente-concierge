# Extrato do `CLAUDE.md` global do autor

Não é cópia do arquivo. São só as regras do `CLAUDE.md` global que valeram nesta
entrega, reescritas sem dado de ambiente (máquinas, caminhos, contas, outros projetos).
Onde o `CLAUDE.md` do repositório diz outra coisa, vale o do repositório (item 2 da
precedência): por exemplo, aqui merge de frente é sempre `--no-ff` e o push é só da
branch da frente.

## Precedência (quando regras conflitam)

1. Pedido explícito do usuário
2. `CLAUDE.md` do projeto
3. Este `CLAUDE.md` global — seções OBRIGATÓRIO vencem regras genéricas
4. Escopo mínimo — decide QUANTO código existe (YAGNI, biblioteca padrão, o mínimo que funciona)
5. Regras genéricas (estilo de código etc.) — decidem COMO escrever o código que passou
6. Skills de processo — só para processo (brainstorm, debug, planos), nunca para inflar escopo

O escopo mínimo nunca corta: validação em trust boundaries, tratamento de erro que evita
perda de dados, segurança, acessibilidade. Em tarefa de UI, qualidade visual é requisito.

## Commits — OBRIGATÓRIO

Ao terminar uma tarefa: commit e push, foco no **porquê**. Formato:

```
tipo(escopo): resumo imperativo

Por que mudou? Motivação, impacto, decisões técnicas.

Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)
```

Tipos: `feat` `fix` `refactor` `docs` `chore` `test` `perf` `ci`. Nunca sem pedir: merge,
deploy, criar ou trocar branch. Detalhes: [`rules/git-workflow.md`](rules/git-workflow.md).

## Contrato de tarefa — OBRIGATÓRIO em tarefa não trivial

Antes de executar: critérios de aceite verificáveis (3 a 7, checáveis sim ou não),
não-escopo (1 a 3 itens) e dúvidas reais numa rodada só. Antes de declarar pronto:
evidência concreta por critério (teste verde, saída de comando). Critério sem evidência =
tarefa não terminou. Detalhes: [`rules/task-contract.md`](rules/task-contract.md).

## Testes — rede de regressão (OBRIGATÓRIO)

Tarefa que muda comportamento deixa teste automatizado do comportamento novo. Bug fix
deixa teste que reproduz o bug antes do fix. Antes de todo commit, rodar as suítes do
projeto; saída diferente de 0, erro não tratado ou flake conhecido não é verde. Trust
boundary (dinheiro, dado de cliente) exige matriz negativa e prova de zero efeito.
Detalhes: [`rules/testing.md`](rules/testing.md).

## Escalação

- Duas ou mais frentes independentes → subagentes em paralelo.
- Diff não trivial pronto → subagente `code-reviewer` antes de entregar, achados
  corrigidos. Qualidade se compra com verificação, não com geração.
- Dúvida arquitetural → segunda opinião de um modelo de outro provedor.
- Tecnologia nova na tarefa → antes de codar, procurar a skill ou a documentação oficial
  dela; não assumir de memória.

## Entregas grandes — modo preferido

Entrega com três ou mais frentes independentes roda em duas sessões separadas: uma de
descoberta, que explora e escreve o backlog coordenado, e uma coordenadora, que despacha
as frentes em paralelo, cada uma na sua worktree, mergeia com disciplina e confere cada
entrega. Esta entrega seguiu esse modo (`docs/prompts/`).

## Isolamento de worktree

Sessões paralelas nunca editam o mesmo checkout. Worktree nova tem plano de merge; fim de
tarefa em worktree é commit e push, e o merge fica com quem coordena.

## Credencial da Cloudflare

Uma credencial de usuário, fora de qualquer repositório, sempre por referência, nunca
ecoada nem colada em prompt, e nunca como secret de runtime de Worker. Detalhes:
[`skills/cloudflare-token/SKILL.md`](skills/cloudflare-token/SKILL.md).

## Sincronização Git

Um hook de início de sessão busca o remoto, puxa só por fast-forward quando a árvore está
limpa e alerta divergência e branches não mergeadas. Divergência é decisão do usuário,
nunca merge automático. Detalhes: [`rules/git-sync.md`](rules/git-sync.md).
