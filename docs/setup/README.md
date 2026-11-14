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
| [`skills/orquestrar-entrega/SKILL.md`](skills/orquestrar-entrega/SKILL.md) | planejamento e coordenadora: formato do backlog e disciplina da coordenação (versão reduzida; durante a construção valeram só o formato do backlog e a disciplina da coordenadora; a seção "Modo T3 Code" foi escrita depois, em 14/11) |

## MCPs

O único servidor MCP chamado na construção foi o do T3 Code, a ferramenta de orquestração
das sessões. Ele serviu para:

- abrir e configurar as threads das frentes (modelo e esforço de cada uma);
- mandar mensagem às frentes e ler o que elas devolveram;
- delegar tarefa a verificador independente e acompanhar a tarefa;
- esperar comando de fundo, como a suíte e as rodadas de eval.

Conferido em 14/11 nos registros de sessão: nos 86 registros do Claude Code deste projeto há
mais de 700 chamadas MCP, todas a esse servidor; os 3 registros do Codex que citam o projeto
não têm chamada MCP. Nenhum outro servidor MCP foi chamado, e o repositório não tem arquivo
de configuração de MCP. O que em outro ambiente viria por MCP veio por outro caminho: a
documentação da Cloudflare por leitura de página, a conta da Cloudflare por `wrangler` e
pela API com a credencial por referência, e o modelo de outro provedor no simulador por
linha de comando.

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
aqui, e as medições de outras entregas saíram. Durante a construção valeram só o formato do
backlog e a disciplina da coordenadora. A seção "Modo T3 Code", no fim da cópia, foi escrita
depois, em 14/11, a partir do que esta entrega mostrou; ela não existia enquanto as frentes
rodavam. O `CLAUDE.md` global não
foi copiado: o extrato traz só as regras que valeram aqui.

Onde uma regra global e o [`CLAUDE.md`](../../CLAUDE.md) deste repositório divergem, vale
o do repositório.
