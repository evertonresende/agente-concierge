# Setup do ambiente usado nesta entrega

Cópia das regras, skills e subagentes do ambiente global do autor (Claude Code) que
**rodaram de fato** nesta entrega. A lista sai do bloco "Setup global usado nesta entrega"
do [backlog](../exploracoes/BACKLOG-CONCIERGE-2026-11.md); a tabela abaixo foi conferida
contra esse bloco em 14/11.

| Arquivo | Onde rodou |
|---|---|
| [`CLAUDE-global.md`](CLAUDE-global.md) | extrato das regras do `CLAUDE.md` global que valeram aqui, reescritas |
| [`rules/coding-style.md`](rules/coding-style.md) | carregada em toda sessão Claude |
| [`rules/git-workflow.md`](rules/git-workflow.md) | carregada em toda sessão Claude |
| [`rules/git-sync.md`](rules/git-sync.md) | carregada em toda sessão Claude |
| [`rules/security.md`](rules/security.md) | carregada em toda sessão Claude |
| [`rules/task-contract.md`](rules/task-contract.md) | carregada em toda sessão Claude |
| [`rules/testing.md`](rules/testing.md) | carregada em toda sessão Claude |
| [`skills/cloudflare-token/SKILL.md`](skills/cloudflare-token/SKILL.md) | coordenadora, pré-voo (versão reduzida) |
| [`skills/design-hifi/SKILL.md`](skills/design-hifi/SKILL.md) | frente J, passo 1 (canvas da página) |
| [`skills/design-guidelines/SKILL.md`](skills/design-guidelines/SKILL.md) | frente J, passo 1 |
| [`agents/code-reviewer.md`](agents/code-reviewer.md) | verificador das frentes A, B1, B2 e D (Claude Opus 5.5) |
| [`agents/design-reviewer.md`](agents/design-reviewer.md) | frente J, passo 1 |
| [`hooks/git-sync.sh`](hooks/git-sync.sh) | início de toda sessão Claude: busca o remoto e injeta o estado do git no contexto |
| [`skills/orquestrar-entrega/SKILL.md`](skills/orquestrar-entrega/SKILL.md) | planejamento e coordenadora: formato do backlog e disciplina da coordenação (versão reduzida; revisão do Éverton: a preencher) |

## O que foi retirado das cópias

O repositório é público. As cópias saíram sem:

- endereços IP, nomes de máquina e e-mails;
- caminho do arquivo de credencial e caminhos pessoais da máquina;
- identificador de conta, nomes de Workers, contas e tokens de outros projetos;
- nomes de outros projetos e de clientes (trocados por descrição genérica);
- chaves e e-mails de exemplo (trocados por marcador).

As regras, as skills de design e o hook saíram como estão, salvo essas trocas. A skill
`cloudflare-token` saiu reduzida ao que vale para esta entrega. A skill
`orquestrar-entrega` saiu reduzida ao formato do backlog e à disciplina da coordenadora:
ela foi escrita para outro orquestrador de sessões, cujos comandos e scripts não rodaram
aqui, e as medições de outras entregas saíram. O `CLAUDE.md` global não
foi copiado: o extrato traz só as regras que valeram aqui.

Onde uma regra global e o [`CLAUDE.md`](../../CLAUDE.md) deste repositório divergem, vale
o do repositório.
