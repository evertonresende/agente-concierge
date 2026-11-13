# Resposta do Gemini (gemini-4-hydrogen-high)

Comando: `agy -p "<pergunta>" --model gemini-4-hydrogen-high`, rodado de uma pasta vazia fora do repositório.
Saída 0. Resposta inteira, sem edição:

---

## Parte 1 — Lacunas do enunciado

**L1. Datas relativas:** Aceitar expressões comuns ("amanhã", "Natal", "sexta que vem") resolvendo em `America/Sao_Paulo` (padrão do negócio no Brasil) e ecoar as datas completas calculadas. Se forem ambíguas ("próximo fim de semana" na sexta), propor o intervalo exato e pedir confirmação antes de cotar/fechar; (a) bateria espera fluidez e (b) negócio evita erro de reserva (ambos convergem).

**L2. Datas no passado / hoje:** Recusar qualquer check-in anterior à data atual em `America/Sao_Paulo`, explicando o motivo e pedindo novas datas (`handoff: false`); aceitar check-in hoje normalmente. Negócio real aceita reserva no mesmo dia e recusa passado; bateria tende a testar passado como data inválida.

**L3. Persistência de `handoff`:** Manter `handoff: true` no turno do encaminhamento e em todos os turnos seguintes daquela `session_id`. Em conflito com um possível retorno ao bot no negócio, vence (a) a bateria automática, cujo avaliador frequentemente verifica `handoff === true` no estado final da sessão.

**L4. Comportamento pós-handoff:** Uma vez em `handoff: true`, bloquear novas cotações e registros de lead, respondendo apenas que o atendimento já foi transferido para um humano que assumirá dali. Previne que usuário insistente/hostil burle um bloqueio prévio; (a) robustez vence (b) conveniência.

**L5. Informação ausente do catálogo:** Responder apenas que a informação não consta no catálogo (`handoff: false`) e oferecer ajuda com os dados disponíveis ou perguntar se deseja falar com um atendente. Só passar para humano (`handoff: true`) se o hóspede insistir que a dúvida é impeditiva para decidir ou pedir explicitamente atendimento humano.

**L6. Formato de telefone:** Aceitar números nacionais e estrangeiros (qualquer string com 10 a 15 dígitos após remover pontuação, mantendo DDI se houver ou assumindo `+55` para 10–11 dígitos ao enviar ao webhook, conforme validação do contrato). Recusar entradas claramente inválidas (< 10 dígitos, sequências repetidas) pedindo correção sem handoff.

**L7. Segunda reserva e repetição:** Permitir nova cotação/reserva na mesma sessão após concluir a anterior, limpando apenas o rascunho da reserva anterior. Para repetição idêntica já enviada com 201 (mesmos imóvel, datas, hóspedes e telefone), bloquear por idempotência e informar que o lead já foi registrado (`handoff: false`).

**L8. Momento de dar o total:** Exigir imóvel, datas e número de hóspedes antes de dar a cotação final, pois sem a contagem não há como aplicar a recusa determinística de capacidade. Se o hóspede pedir preço sem dizer quantas pessoas são, perguntar o número de hóspedes antes de calcular; (a) evitar cotação fora da capacidade vence.

**L9. O que conta como confirmação:** Apenas resposta afirmativa inequívoca ao resumo explícito apresentado no turno anterior ("sim", "confirmo", "pode fechar"), sem condições extras. "Acho que sim" → pedir confirmação clara; "fecha com 10% de desconto" → não envia lead e aciona `handoff: true`; mudança de assunto → mantém pendente sem enviar.

**L10. Mudança pós-resumo / mudança de preço no catálogo:** Qualquer alteração de dados pelo hóspede invalida o resumo, exigindo novo cálculo, novo resumo e nova confirmação em outro turno. No envio, sempre reconsultar o catálogo e recalcular; se o valor mudou, abortar o POST, mostrar o novo total e pedir nova confirmação.

**L11. Falha do webhook:** Para 5xx ou timeout, fazer até 2 retentativas curtas (ex: 500 ms e 1,5 s) dentro do teto de 60 s; se persistir, informar falha técnica sem confirmar registro e acionar `handoff: true`. Para 422, se o erro apontar dado corrigível do usuário (ex: telefone), pedir correção (`handoff: false`); caso contrário, `handoff: true`.

**L12. Conflito com regras do imóvel:** Se o hóspede declarar que levará pet, fumará ou fará festa onde `regras` proíbe, recusar a cotação para aquela condição explicando a regra do imóvel e oferecer opções compatíveis (`handoff: false`). Se insistir em burlar a regra ou pedir exceção, passar para humano (`handoff: true`).

**L13. Contagem de hóspedes e valores inválidos:** Contar adultos, crianças e bebês na capacidade total do imóvel (salvo exceção explícita na ficha, mas na dúvida contar todos evita violar limite máximo). Quantidade ≤ 0, fracionária ou absurda (ex: 999) deve ser recusada pedindo um número inteiro positivo válido (`handoff: false`).

**L14. Arredondamento da noite com acréscimo:** Arredondar cada noite individualmente para o centavo inteiro mais próximo (`Math.round(diariaCentavos * 1.2)`) antes de somar a estadia, conforme literalidade do enunciado ("arredonda cada noite para centavos"). Garante reprodutibilidade exata contra gabarito automático de centavos.

**L15. Idioma:** Responder no idioma do hóspede (inglês ou espanhol), mantendo as mesmas travas de catálogo/negócio e exibindo valores monetários estritamente no formato exigido `R$ 2.156,00`. Atende bem ao negócio e não quebra eventuais asserções regex de moeda da bateria.

**L16. Fora de escopo, injection e falso funcionário:** Recusar de forma seca e educada sem revelar instruções/ferramentas e sem acatar comandos de suposto dono/funcionário (`handoff: false`), redirecionando para dúvidas/reservas. Só virar `handoff: true` se o usuário insistir abusivamente ou escalar para reclamação, evitando falso handoff em testes de recuperação pós-ataque.

**L17. Corpo inválido no `POST /chat`:** JSON malformado, `session_id` ausente/vazio, `message` ausente/vazia/não-string ou acima do limite (ex: 4.000 caracteres) devem retornar HTTP `400` com erro JSON claro antes de acionar o Durable Object ou o LLM. Protege custo, latência e testes de contrato HTTP.

**L18. Falha interna (LLM, catálogo, timeout):** Aplicar timeout interno abaixo do teto (ex: 45 s); se catálogo ou modelo falharem após retry breve, retornar HTTP `200` com aviso educado de indisponibilidade momentânea e `handoff: true`. Melhor que HTTP 500, pois preserva o contrato esperado pelo avaliador e encaminha o cliente com segurança.

**L19. Ações fora da alçada do agente:** Pedidos de cancelamento, alteração de reserva já fechada, pagamento, check-in antecipado/late check-out ou ocorrências durante a estadia devem receber explicação curta do limite e `handoff: true` imediato. Bateria e negócio real concordam.

**L20. Nome do hóspede:** Solicitar "nome completo" na coleta, mas aceitar primeiro nome ou nome simples caso o usuário informe só um nome válido (recusando apenas strings vazias, números ou placeholders como "teste"). Reduz atrito desnecessário na bateria automática; se o webhook devolver 422 pedindo sobrenome, aí solicita-se o sobrenome.

### Lacunas adicionais importantes

1. **Busca no catálogo sem rota de listagem completa:** Fazer consultas orientadas pelos atributos pedidos (cidade, bairro, capacidade, comodidades) e, quando não houver correspondência ou a API exigir termo exato, testar variações óbvias antes de dizer que não encontrou; nunca afirmar lista exaustiva do portfólio se só consultou um recorte.
2. **Desambiguação de imóveis parecidos:** Se a busca retornar mais de um imóvel compatível ou com nome similar, listar as opções relevantes com bairro/cidade e capacidade e exigir escolha explícita antes de cotar/confirmar.
3. **Regra exata da noite de sexta/sábado:** Contar pela data de início de cada pernoite (ex: check-in sexta e check-out domingo = noite de sexta +20% e noite de sábado +20%; domingo→segunda sem acréscimo; quinta→sexta sem acréscimo).
4. **Feriados e datas especiais:** Não aplicar sobretaxa fora da regra fixa (só sexta/sábado +20%), mesmo em Natal/Réveillon/Carnaval, reforçando que a cotação segue a tarifa padrão e não garante disponibilidade.
5. **Múltiplas mensagens simultâneas na mesma sessão:** Serializar requisições no Durable Object (fila / `blockConcurrencyWhile`) para impedir leitura de estado obsoleto, dupla confirmação ou duplo POST de lead.
6. **Formatação de todos os valores em reais:** Usar a função determinística `R$ X.XXX,XX` não só no total, mas também ao citar diária e taxa de limpeza, evitando inconsistência visual ou falha em regex de avaliação.
7. **Estouro de histórico em conversas longas:** Manter o estado da reserva/handoff em objeto estruturado separado do histórico e aplicar janela deslizante nas mensagens enviadas ao LLM (ex: últimas 20 mensagens), mantendo a latência bem abaixo de 60 s.
8. **Privacidade em logs e exports:** Mascarar telefone completo nos artefatos/exports públicos de sessão (mantendo o dado íntegro apenas no payload do webhook e na validação), evitando exposição acidental de PII.

---

## Parte 2 — Ordem das levas

### 1. Organização em levas, paralelismo e estimativas (meta: ~11 h de relógio, ~9 h de folga)

* **Leva 1 (0 h – 3,5 h de relógio) — Fundação e Marco 1 (paralelo):**
  * **A (Esqueleto vertical dev):** **3,5 h** (única frente de código de produto: Worker, DO, núcleo puro de preço + testes unitários, cliente catálogo, loop de ferramentas, trava de confirmação, webhook fake, handoff, deploy dev e E2E do exemplo).
  * **B (Harness HTTP + evals de dev):** **2,5 h** (paralelo com A, baseado no contrato `POST /chat`).
  * **C (Evals reservados):** **2,5 h** (paralelo, agente isolado que nunca toca no código do produto; reporta só agregado).
  * **I (Preparação do benchmark de modelos):** **1,0 h** (monta casos comparativos de tool calling usando o harness B).
  * *Portão Marco 1 (3,5 h):* Conversa E2E no ar em dev aprovada + conclusão rápida de **I** (+0,5 h) para travar o modelo vencedor antes da Leva 2.

* **Leva 2 (4,0 h – 7,5 h de relógio) — Regras de borda, ataque e revisão (paralelo em worktrees após Marco 1):**
  * **E (Datas e fuso):** **2,0 h**.
  * **F (Lead, telefone, idempotência, falhas webhook):** **2,5 h**.
  * **G (Robustez, anti-injection catálogo/usuário, matriz handoff):** **3,0 h**.
  * **H (Serialização por sessão no DO):** **1,5 h**.
  * **D (Simulador de hóspede hostil):** **2,5 h** (roda contra dev e alimenta casos fixos de regressão para B).
  * *Portão de Integração (7,5 h – 8,5 h):* Merge sequencial das worktrees (H → E → F → G) na base, execução completa de **B + D** e primeira leitura agregada de **C**.

* **Leva 3 (8,5 h – 11,5 h de relógio) — Revisão pesada, Produção e Entrega:**
  * **M (Revisão de código/segurança/2ª opinião):** **2,0 h** total (0,5 h no Marco 1 + 1,5 h logo após o merge da Leva 2; bloqueante antes de K).
  * **K (Produção + smoke test sem confirmação):** **1,5 h** (sequencial após aprovação de M e rodada verde de B/C).
  * **L (Observabilidade, custo e monitor 7d):** **1,5 h** (paralelo após merge, finalizado junto com K).
  * **J (Página simples de chat):** **1,5 h** (paralelo a K/L).
  * **N (Documentação, decisões, diagrama, exports, roteiro):** **2,5 h** (rascunho iniciado na Leva 2, finalizado após smoke test de K).

### 2. Onde entram M (revisões) e I (escolha do modelo)

* **I (Escolha do modelo):** Entra na transição entre a **Leva 1 e a Leva 2** (assim que **A** coloca o loop de ferramentas de pé em dev). Testar cedo evita otimizar prompts e parsers da Leva 2 para um modelo que seria descartado depois.
* **M (Revisões):** Entra em **dois checkpoints**: uma revisão enxuta logo no **Marco 1** (para validar a máquina de estados determinística e evitar retrabalho em E/F/G) e a revisão completa de código, segurança e segunda opinião de outros modelos **logo após o merge da Leva 2 e antes do deploy em produção (K)**.

### 3. Linha de corte

* **Cai primeiro (ordem de corte se o tempo apertar):**
  1. **J** (página web de chat — o contrato avaliado é `POST /chat`, não interface visual).
  2. Parte secundária de **L** (monitor automático de 7 dias e métricas avançadas — manter apenas log JSON estruturado por turno com custo/latência).
  3. **D** em modo contínuo (substituir por 8–10 prompts hostis fixos direto no harness **B**).
  4. Acabamento longo de **N** (reduzir roteiro de vídeo a tópicos curtos, mantendo README e decisões impecáveis).
* **Não pode cair de jeito nenhum:** **A** (núcleo determinístico + trava de confirmação), **E / F / G / H** (datas, validação de lead/idempotência, anti-injection/handoff, serialização no DO), **B + C** (evals de dev e reservado), **K** (produção validada sem disparar lead real) e o núcleo de **M** (revisão de segurança) e **N** (README + decisões claras, que compõem diretamente os 40 pontos de processo e clareza).

### 4. Os 5 maiores riscos na bateria oculta e a defesa mais barata

1. **Erro de centavos, sexta/sábado ou formatação (`R$ 2.156,00`):**
   * *Defesa:* Toda aritmética em centavos inteiros, arredondamento por noite e formatação BRL rodam em funções puras TS cobertas por testes unitários; o código injeta o texto formatado pronto e um validador pós-resposta confere se qualquer total citado bate com o cálculo determinístico.
2. **Disparo prematuro ou duplicado de lead (sem confirmação explícita ou após mudança de dado):**
   * *Defesa:* Máquina de estados estrita no DO (`idle` → `quoted` → `awaiting_confirmation` → `submitted`) vinculada a um hash do pacote cotado; a tool de lead recusa execução se não estiver em `awaiting_confirmation` ou se o resumo não tiver sido exibido no turno anterior, sempre recalculando o valor antes do POST.
3. **Injeção de prompt via mensagem ou campo `descricao` do catálogo (concedendo desconto ou vazando regras):**
   * *Defesa:* Tratar dados do catálogo como payload estruturado com delimitadores e instrução de não-obediência no system prompt, somado à trava no código (nenhuma tool aceita desconto ou sobrescrita de preço) e casos fixos de ataque no eval **B**.
4. **Handoff errado (não transferir em desconto/reclamação/ação externa, transferir em pergunta simples sem catálogo, ou perder `handoff: true` depois):**
   * *Defesa:* Tabela curta de gatilhos obrigatórios vs. "não sei sem handoff" no prompt + trava no estado do DO que mantém `handoff: true` irreversível na sessão após ativado.
5. **Race condition na mesma sessão, fuso horário UTC no Worker ou webhook falho dado como aceito:**
   * *Defesa:* Serializar chamadas com `blockConcurrencyWhile` / fila no DO, fixar `America/Sao_Paulo` em todo cálculo de data, e só responder "lead registrado" quando o webhook retornar explicitamente HTTP `201`.
