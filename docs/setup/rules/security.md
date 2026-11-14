# Security Guidelines

## Gatilhos — quando aplicar checks

Checklist NÃO é pré-commit universal. Aplicar quando a mudança toca:

| Tocou em | Checar |
|:---------|:-------|
| Qualquer commit | Sem secrets hardcoded (API keys, passwords, tokens) |
| Input de usuário / API externa | Validação no boundary, XSS (sanitizar HTML) |
| SQL | Queries parametrizadas, nunca concatenação |
| Auth/sessão | Authn/authz verificados, CSRF em forms com sessão |
| Endpoints públicos novos | Rate limiting, erros não vazam dados sensíveis |
| Pagamento/dinheiro | Tudo acima + idempotência + lock/atomicidade |

## Secret Management

```typescript
// NEVER: hardcoded
const apiKey = "<chave escrita no código>"

// ALWAYS: env var + fail fast
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
```

## Security Response Protocol

Achou issue de segurança:

1. STOP imediato
2. Subagente Task `security-reviewer`
3. Fix CRITICAL antes de continuar
4. Avisar usuário QUAL secret rotacionar e onde é usado — NUNCA rotacionar sozinho
5. Varrer codebase por padrão similar
