# Coding Style

Define COMO escrever o código que existe. QUANTO código existe é decisão do ponytail (ver precedência no CLAUDE.md) — esta rule nunca justifica escrever mais código, só escrever melhor o necessário.

## Immutability (CRITICAL)

Criar objetos novos, não mutar:

```javascript
// WRONG
function updateUser(user, name) {
  user.name = name  // MUTATION!
  return user
}

// CORRECT
function updateUser(user, name) {
  return { ...user, name }
}
```

Exceção óbvia: hot paths medidos onde imutabilidade custa caro — comentar o porquê.

## File Organization

Muitos arquivos pequenos > poucos grandes: alta coesão, baixo acoplamento. 200-400 linhas típico, 800 max. Organizar por feature/domínio, não por tipo.

## Error Handling

Nos boundaries (I/O, rede, parsing, DB) e onde falha perde dados ou dinheiro — não envelopar toda função em try/catch:

```typescript
try {
  return await riskyOperation()
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('Mensagem útil pro usuário')
}
```

## Input Validation

Em trust boundaries (input de usuário, APIs externas, webhooks) — obrigatório, ponytail não corta. Zod quando projeto já usa; senão validação nativa simples:

```typescript
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})
const validated = schema.parse(input)
```

## Checklist antes de fechar

- [ ] Nomes legíveis, funções <50 linhas, arquivos <800
- [ ] Error handling nos boundaries
- [ ] Sem console.log esquecido, sem hardcoded values/secrets
- [ ] Sem mutação
- [ ] Comportamento novo/alterado tem teste na suite; suite rodada e verde (`rules/testing.md`)
