# Git Workflow

## Commit Message Format

```
tipo(escopo): resumo imperativo (max 72 chars)

<corpo opcional — foco no porquê>

Committed by [Éverton Resende](https://github.com/evertonresende), assisted by [Claude Code](https://claude.ai/code)
```

Tipos: feat, fix, refactor, docs, test, chore, perf, ci. Escopo = módulo/área (`lead`, `preco`, `evals`). Footer custom acima é o padrão — atribuição default do Claude Code (Co-Authored-By) desligada via `includeCoAuthoredBy: false` no settings.json.

## Commits

- **Granular**: uma mudança lógica = um commit. Data model e UI alterados juntos = dois commits separados.
- **Frequente**: commitar a cada mudança significativa, não acumular
- **Push imediato** após commit (se remote existe) — não segurar local
- `git diff @{u}...HEAD` antes de qualquer push — mostra exatamente os commits que vão subir, funciona em qualquer branch

## Branches

- **Default deste ambiente: repo solo → commit direto na branch principal, ok.** Branch+PR só quando o CLAUDE.md do projeto define fluxo de PR (colaboradores/CI de review).
- Quando usar branch: nome descritivo — `oauth-migration`, `rate-limiter-fix`, `pix-refactor`

## Pull Requests

1. `git diff [base-branch]...HEAD` — ver todas as mudanças, não só o último commit
2. PR summary completo: o quê mudou e por quê
3. Usar `gh pr create` via CLI

## Segurança

- Nunca commitar secrets, API keys, tokens
- Secrets sempre via env vars, nunca hardcoded
