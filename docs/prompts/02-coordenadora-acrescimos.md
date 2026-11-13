# Acréscimos ao prompt da coordenadora

O prompt de `02-coordenadora.md` foi enviado em 13/11/2026 com os dois blocos abaixo
colados no fim, e depois veio um complemento na mesma conversa. Estão aqui como foram
escritos pelo Éverton, inclusive os campos que ficaram sem preencher. O que eles mudam
está em `DECISOES.md` (X6 a X12) e no backlog.

## Colado no fim do prompt

```
## Acréscimos do Éverton

- L1a, L1b e L17a: fico com os três padrões provisórios. Registre como decididos no
  contrato e no DECISOES.md.
- Frente N: copie para docs/setup/ as skills, as regras e os subagentes do meu ambiente
  global que rodaram de fato nesta entrega, sem IP, nome de máquina nem dado de cliente.
  O enunciado pede para ver esse setup.
- Pré-voo: plano pago da Cloudflare assinado. Bot Fight Mode da zona: <ligado ou
  desligado>. Regra do hostname: <criada ou não>.
---
- Modelos (substitui a linha "Modelos" da configuração; registre no DECISOES.md e no
  backlog). As frentes rodam em quatro provedores do T3 Code:
  - Claude Fable 5.2 (`--provider claudeAgent --model claude-fable-5-2`): você, A, F e G.
  - Claude Opus 5.5 (`--provider claudeAgent --model claude-opus-5-5`): E, H, I, K, L, N
    e os subagentes de revisão e de verificação.
  - Gemini 4 Hydrogen (`--provider antigravity --model gemini-4-hydrogen`): B2 e D.
  - GPT-6 Astra (`--provider codex --model gpt-6-astra`): C. Uso limitado: nada além
    de C e do conselho.
  - DeepSeek pago (`--provider opencode --model deepseek/deepseek-flash`): B1 e J.
    Nunca os modelos gratuitos do OpenCode.
  O motivo da divisão: quem escreve os evals e o conjunto reservado não é o provedor
  que escreve o agente.
- Regras para frente fora do Claude:
  1. Antes de despachar a primeira, crie o AGENTS.md na raiz com as mesmas regras do
     CLAUDE.md (idioma, sigilo, histórico, webhook real). Esses agentes não leem o
     CLAUDE.md.
  2. Ela nunca lê ~/.config/agente-concierge/env, nunca toca producao e nunca recebe o
     token nem a URL real. Se precisar de dado do catálogo, você grava as fichas num
     arquivo fora do repositório, sem token, e passa o caminho.
  3. O relatório dela é conferido por um subagente verificador do Claude antes do
     merge, como qualquer outra.
  4. Se o provedor falhar ou a cota acabar, passe a frente para o Gemini 4 Hydrogen,
     registre no log e me avise no resumo da leva.
```

## Complemento, enviado durante o pré-voo

```
Complemento, sem recomeçar:

- Você está numa worktree, na branch t3/concierge-delivery-coordination. As frentes
  nascem da main. Antes de despachar, leve os seus commits de docs para a main
  (merge --no-ff e push), senão elas nascem sem o AGENTS.md e sem as lacunas decididas.
- Modelo do agente. O Marco 1 começa em modelo nativo, como está no plano. Minha chave
  da OpenAI está em OPENAI_API_KEY, no arquivo de ambiente: use por referência, nunca
  imprima. A frente I inclui um modelo da OpenAI entre os três candidatos, mede também
  10 conversas simultâneas contando erros de limite de pedidos, e deixa um modelo
  reserva de outro provedor configurado no AI Gateway.
- Modelo de decisão (Jev ou Clef). Já uso o Jev em produção em outro projeto. Aqui ele
  fica fora do caminho do pedido. Se os evals de handoff ou de confirmação falharem
  depois da leva 2, a frente G avalia um juiz de decisão como segunda opinião nesses
  dois pontos, lendo a documentação antes. Se não entrar, registre em "o que faria com
  mais tempo".
- Pré-voo: Bot Fight Mode da zona: <ligado ou desligado>. Regra do hostname: <criada ou
  não>. Endereço de produção no arquivo de ambiente: <sim ou ainda não>.
```
