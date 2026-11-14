# Testes — Rede de Regressão

Objetivo: task futura não quebra o que esta task fez. Teste que protege é teste que RODA — existe no repo, na suite, executável por qualquer sessão futura.

## Regra central (OBRIGATÓRIO)

**Toda task que muda comportamento de código executável deixa teste automatizado cobrindo o comportamento novo/alterado.** Não é meta de coverage — é guarda do que a task fez.

- Feature nova → teste do happy path + 1 edge crítico. Mais que isso só se a lógica pedir.
- **Bug fix → teste que reproduz o bug ANTES do fix** (vermelho → fix → verde). Sem exceção — é o teste de regressão clássico.
- O "check rodável" da regra de escopo mínimo gradua pra teste no repo: assert solto em demo() não protege task futura; teste na suite sim.

## Trust boundaries (OBRIGATÓRIO)

Mudança em auth, autorização multi-tenant, dinheiro, webhook ou dado de cliente exige mais que happy + 1 edge. Cobrir o contrato observável mínimo:

1. Sem credencial / assinatura inválida → 401/403 e **zero efeito**.
2. Identidade A tentando recurso de B → 403/404 e **zero efeito**.
3. Identidade dona / assinatura válida → sucesso.
4. Pagamento/webhook → replay, idempotência e falha parcial/transitória.

Teste de handler com client mockado prova a decisão do handler; **não prova** wiring HTTP, runtime, middleware/gateway, RLS real, migration nem deploy. Quando a mudança toca um desses boundaries, deixar teste/smoke automatizado nessa camada **se houver ambiente autorizado**. Sem credencial/staging ou com deploy gated: deixar script/checklist reproduzível, registrar a limitação e pedir aprovação antes de smoke vivo; nunca usar produção por conta própria. Policy RLS exige Postgres/Supabase real com roles e pelo menos dois tenants; mock de `supabase.from()` não conta.

## Camadas e comandos do projeto

O CLAUDE.md do repo deve listar separadamente todas as suites aplicáveis: unit/component, integração DB, runtime/API, plugin/cliente distribuído e E2E staging. O gate executa todas as suites afetadas pela task; CI deve executar pelo menos as suites determinísticas sem credencial externa.

- E2E de fluxo que **é o produto** (checkout, upload, onboarding, acesso privado) não depende de pedido adicional do usuário: propor/incluir no plano quando o risco justificar.
- Credencial de teste nunca vai em source. Usar secret/env + usuário descartável de staging; achou credencial versionada → rotacionar, porque apagar o arquivo não limpa o histórico Git.
- Em sistema com auth, pagamento ou dados de terceiros, propor scanner de secrets/dependências ao tocar CI/security. Depois de configurado, ele vira gate; enquanto não existe, registrar backlog/risco sem inflar toda task não relacionada.

## Gate de commit (OBRIGATÓRIO)

Antes de todo commit em repo com suite:

1. Rodar todas as suites aplicáveis documentadas no CLAUDE.md do repo.
2. **Suite quebrou → não commita.** Consertar antes, mesmo que a quebra pareça não-relacionada.
3. `exit 0` com erro assíncrono/unhandled, warning que invalida o teste ou resultado dependente de timing **não é verde**.
4. Flake não se "corrige" com retry, `skip`, timeout maior ou nova execução até passar. Reproduzir, registrar e corrigir a causa.
5. Teste quebrado preexistente (já falhava antes da task) → avisar usuário, NÃO silenciar/skipar pra passar.

## Coverage: diagnóstico + ratchet

Coverage não substitui mapa de risco, mas revela código nunca exercitado.

- Registrar baseline por área quando a cobertura sistêmica for desconhecida.
- Código crítico/alterado não pode reduzir line/branch coverage sem justificativa explícita.
- Preferir cobertura de linhas alteradas e branches de auth/dinheiro a impor 80% global num legado descoberto.
- Novo trust boundary: todas as decisões de allow/deny e seus zero-side-effects cobertas, independentemente do percentual agregado.

## O que NÃO exige teste novo

- Docs, config, conteúdo, estilo/visual puro (loop visual da skill `design-guidelines` cobre)
- Scripts realmente descartáveis e sem efeito destrutivo. Migração, backup, billing, cleanup e script que toca produção **não** são throwaway.
- Refactor sem mudança de comportamento — a suite existente continuar verde JÁ É o teste
- Trivial de 1 linha sem branch (YAGNI vale pra teste também)

## Repo sem infra de teste

Primeira task de código em repo sem testes → **propor setup mínimo** (uma vez, não a cada task):

- Framework que o repo/stack já sugere: vitest (TS/JS moderno), jest (React legado), pytest (Python), `go test` (Go)
- Setup mínimo: 1 arquivo de config + 1 teste real da task atual, nada de boilerplate especulativo
- Documentar comando no CLAUDE.md do projeto (`npm test`, `pytest`, etc.) — sem isso, sessão futura não roda o gate

Usuário recusou → seguir sem, mas deixar o check rodável da regra de escopo mínimo (demo/assert) como fallback.

## Escalação

- Feature crítica (dinheiro, auth, dados de cliente) ou pedido explícito de TDD → skill `dev-testing` (test-first, coverage alto, Playwright)
- E2E de fluxo completo → quando user pedir **ou** o fluxo for o produto (checkout, upload, onboarding, acesso privado)

## Anti-padrões

- ❌ Suite de 40 testes pra função de 10 linhas — teste também é código que o escopo mínimo poda
- ❌ Teste que testa mock em vez de comportamento
- ❌ Coverage% como meta em vez de comportamento coberto
- ❌ Skipar/comentar teste quebrado pra "destravar" commit
- ❌ Rodar de novo até o flake passar e chamar de verde
- ❌ Chamar teste com mocks de "integração" ou prova de RLS/runtime
- ❌ Credencial fixa versionada em fixture/E2E
- ❌ Testar detalhes de implementação (quebra em todo refactor) em vez de contrato observável
