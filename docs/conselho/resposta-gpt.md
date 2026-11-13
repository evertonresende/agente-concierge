# Resposta do GPT (gpt-6-astra)

Comando: `codex exec -m gpt-6-astra --skip-git-repo-check -s read-only -`, com a pergunta pela entrada padrão, rodado de uma pasta vazia fora do repositório.
Saída 0. Resposta inteira (última mensagem do modelo), sem edição:

---

**L1. Datas relativas.** Aceitar usando o fuso do imóvel; enquanto ele não estiver escolhido, usar `America/Sao_Paulo` e registrar essa decisão. “Amanhã” é determinístico; expressões como “próximo fim de semana”, “sexta que vem” e “no Natal” exigem explicitar entrada e saída e confirmar a interpretação antes de cotar.

**L2. Passado e entrada hoje.** Recusar entrada anterior à data local atual e pedir novas datas; aceitar entrada hoje para cotação, sem garantir disponibilidade ou check-in imediato. Isso acrescenta uma restrição não explicitada, mas aqui vence a coerência operacional do negócio; documentar e testar.

**L3. Duração de `handoff`.** Usar como evento: `true` na resposta em que decide encaminhar, sem torná-lo permanentemente verdadeiro. Guardar o encaminhamento no estado; essa leitura segue a definição explícita do contrato, que vence a preferência operacional por uma flag persistente.

**L4. Conversa depois do encaminhamento.** Continuar atendendo solicitações que estejam no escopo, inclusive cotação e lead sem desconto. O encaminhamento anterior permanece registrado, mas não bloqueia a sessão; uma nova solicitação que exija humano produz outro `handoff: true`.

**L5. Informação ausente.** Dizer claramente que o catálogo não informa e usar `handoff: true` quando a pergunta factual continuar sem solução. A regra explícita de encaminhar o que não resolve vence a conveniência de reduzir encaminhamentos; dados que o próprio hóspede pode fornecer, como suas datas, geram esclarecimento com `false`.

**L6. Telefone.** Aceitar formatação humana e números estrangeiros; normalizar com biblioteca para E.164. Sem código internacional, assumir Brasil apenas quando DDD e número forem plausíveis, mostrando a normalização no resumo; números incompletos ou ambíguos exigem correção, sem exigir comprovação de titularidade.

**L7. Segunda reserva e repetição.** Permitir uma nova intenção de reserva na mesma sessão, com novo resumo e confirmação. Repetição ou reenvio da confirmação já consumida não faz outro POST; para duas reservas intencionalmente iguais, exigir que o hóspede explicite que quer uma segunda.

**L8. Momento do total.** Com imóvel e datas válidas, fornecer o total como cotação condicionada à capacidade e perguntar quantas pessoas irão. Não inventar quantidade nem bloquear desnecessariamente uma pergunta de preço; o resumo para confirmação exige quantidade válida.

**L9. Confirmação.** Aceitar assentimento inequívoco ao resumo pendente, como “sim”, “pode ser” e “pode registrar”, sem alterações ou condições. “Acho que sim” exige esclarecimento; desconto gera encaminhamento; silêncio ou outra pergunta não confirmam, e a resposta à pergunta deve renovar o pedido de confirmação.

**L10. Mudança após o resumo.** Alterar qualquer dado do lead invalida a confirmação pendente e exige novo resumo. Na confirmação, reconsultar e recalcular: mudança no total ou em condições relevantes exige nova confirmação; uma alteração meramente descritiva não precisa reiniciar o fluxo.

**L11. Falha do webhook.** `422`: apresentar os erros úteis, coletar correções e obter nova confirmação, sem repetição automática. Timeout/`5xx`: no máximo uma nova tentativa **se houver idempotência garantida pelo receptor**; sem isso, marcar resultado incerto, encaminhar e impedir reenvio cego. Nunca dizer “registrado” sem `201`.

**L12. Conflito com regras.** Informar a proibição e impedir avanço para lead enquanto a intenção conflitante continuar. Pode fornecer preço deixando explícito que a cotação não autoriza pet ou festa; pedido de exceção, negociação ou insistência gera encaminhamento. Não criar uma proibição genérica de calcular preço.

**L13. Quantidade de hóspedes.** Contar adultos, crianças e bebês, pois o catálogo não oferece exceções. Exigir inteiro positivo; acima da capacidade, recusar explicando o limite; zero, negativo, fracionário ou número numericamente inseguro geram pedido de correção.

**L14. Arredondamento.** Usar arredondamento comercial, meio centavo para cima, por noite, antes da soma. Para diária inteira `d` em centavos, a noite com acréscimo pode ser calculada como divisão inteira de `(120 × d + 50)` por `100`, dentro de limites numéricos seguros.

**L15. Idioma.** Responder em inglês ou espanhol conforme o hóspede, preservando as mesmas regras e ferramentas. Totais continuam obrigatoriamente em `R$ 2.156,00`, e datas devem aparecer sem ambiguidade; nomes e textos do catálogo não autorizam inferir informações.

**L16. Fora do escopo e manipulação.** Pedidos legítimos fora do escopo recebem limite breve e `handoff: true`, pela leitura literal do enunciado, mesmo que um negócio preferisse evitar encaminhar perguntas sobre política. Tentativa de extrair instruções ou alterar regras é recusada sem encaminhamento automático; desconto gera `true`, mesmo quando solicitado por suposto dono.

**L17. Corpo HTTP inválido.** Retornar `400` para JSON ou campos inválidos e `413` para corpo acima do limite documentado, com `{reply, handoff:false}`. Definir limites generosos, por exemplo 32 KiB de corpo e 8 mil caracteres de mensagem; o `200` obrigatório vale para mensagens válidas, inclusive recusas de negócio.

**L18. Falha interna.** Para uma requisição válida aceita, responder `200` com mensagem honesta de impossibilidade temporária e `handoff: true` quando as tentativas limitadas se esgotarem. Reservar tempo para essa resposta, encerrando trabalho externo por volta de 45–50 segundos; não prometer que um humano foi notificado sem integração que comprove isso.

**L19. Ação externa.** Cancelamento, alteração de reserva existente, pagamento, autorização de entrada antecipada e problemas durante a estadia geram encaminhamento. Dúvida informativa respondida pelo catálogo — por exemplo, horário normal de check-in — continua no agente; ele nunca afirma ter executado essas ações.

**L20. Nome.** Aceitar o nome informado, inclusive nome único ou apelido, e repeti-lo no resumo. Não exigir nome completo sem obrigação do webhook; rejeitar apenas conteúdo vazio ou evidentemente inutilizável, evitando validações que excluam nomes legítimos.

**Outras lacunas importantes, com decisão:**

1. **Descoberta dos 15 imóveis.** Inspecionar o contrato real da API no início. Usar busca ou paginação existente; se só houver consulta por ID, manter uma lista configurada de IDs válidos e buscar todos os fatos pela API. Sem enumeração nem IDs fornecidos, não há como garantir descoberta completa: isso precisa ser resolvido imediatamente.
2. **Identificação ambígua.** Nome parcial que corresponda a vários imóveis exige desambiguação antes da cotação. Nunca escolher silenciosamente um imóvel ou tratar “não encontrei” como prova de que não existe.
3. **Semântica de “fechar”.** Confirmar o **envio da solicitação de reserva**, não a efetivação da hospedagem. `201` significa lead registrado; não significa reserva garantida, pagamento realizado ou datas bloqueadas.
4. **Calendário e dados inválidos.** Validar datas civis reais, inclusive anos bissextos; calcular noites por datas, sem dividir milissegundos locais por 24 horas. Catálogo com preço ou limites ausentes/inválidos bloqueia a operação dependente e gera encaminhamento.
5. **Memória e isolamento.** Persistir o estado relevante entre reinícios, isolando rigorosamente sessões. Registrar prazo de retenção e expiração; `session_id` identifica a conversa, mas não comprova identidade do hóspede.
6. **Concorrência e duplicação HTTP.** Serializar o processamento completo por sessão, inclusive chamadas externas e consumo da confirmação. Como o contrato não tem ID de mensagem, a principal defesa contra POST duplicado deve estar na intenção de reserva e no estado do envio.
7. **Significado de `valor_total`.** Enviar número em reais, por exemplo `2156.00`, convertido do inteiro em centavos na fronteira do webhook, salvo contrato explícito diferente. Formatação brasileira fica no texto; não enviar `"R$ 2.156,00"` no campo numérico.
8. **Proteção dos dados pessoais.** Não registrar telefone e nome completos em telemetria comum nem enviar conversas reais a simuladores. Usar dados sintéticos nos testes e mascarar informações pessoais em exports de entrega.

**Eu organizaria em quatro levas, com entrega-alvo em 12 horas e margem absoluta até a hora 14.** Isso deixa de 8 a 6 horas de folga. As estimativas abaixo são horas por frente, não durações que devem ser somadas; dependem de executores realmente disponíveis em paralelo.

| Leva | Janela | Frentes e esforço estimado | Dependências e condição de saída |
|---|---:|---|---|
| 1 | H0–H4 | **A: 3,5–4 h**; **B: 2–3 h**; **C: 1,5–2 h**; **N: 0,5 h inicial** | A é a única frente de código de produto. B e C trabalham separadamente pelo HTTP. Saída obrigatória: conversa completa em dev, com cálculo correto, resumo, confirmação, `201` falso e desconto com encaminhamento. |
| 2 | H4–H7,5 | **E: 1,5–2 h**; **F: 2,5–3 h**; **G: 2–2,5 h**; **H: 1–1,5 h**; **D: 1–1,5 h**; **I: 0,75–1 h**; **M: 1 h distribuída** | Frentes de produto partem do marco integrado. H integra antes da validação final de F. D começa contra dev; I compara modelos com o mesmo código e os mesmos casos de desenvolvimento. |
| 3 | H7,5–H10 | **Integração e correções: 1,5–2 h**; **M: 1–1,5 h**; **K: 1,5–2 h**; **L: 0,75–1 h**; **N: 1 h**; **J: 0,5–0,75 h, opcional** | Primeiro integrar e passar testes de desenvolvimento; depois congelar o candidato e rodar C. K prepara configuração em paralelo, mas deploy depende do candidato aprovado. J não entra no caminho crítico. |
| 4 | H10–H12 | **K: 0,5–1 h final**; **N: 1–1,5 h**; **reserva para correções: até 1 h** | Verificação pós-deploy sem confirmação nem lead real, documentação final, exports sanitizados, vídeo e empacotamento. H12–H14 fica como contingência; não como espaço para novas funcionalidades. |

O escopo de A precisa ser deliberadamente estreito, mas completo: dados explícitos, um imóvel identificável, preço correto, fluxo de confirmação e ferramentas essenciais. Datas sofisticadas e recuperação de falhas entram depois; integridade do cálculo e proibição de envio antecipado entram desde o primeiro marco. Como o texto fornecido não contém os valores da “cotação do exemplo”, eu fixaria uma fixture com resultado esperado calculado independentemente.

Na abertura, o coordenador registra contratos HTTP, ferramentas, estado e propriedade dos arquivos. Cada frente recebe objetivo, critérios de aceite, arquivos sob sua responsabilidade e comandos de validação; mudanças nesses contratos passam pelo coordenador. Ele acompanha, organiza merges e evidências, mas uma frente de integração executa as alterações de código.

E, F, G e H não devem editar livremente o mesmo arquivo do Durable Object. E entrega interpretação de datas; F entrega o ciclo do lead; G entrega políticas e limites de ferramentas; H entrega a serialização. Um responsável integra esses módulos. A criação do harness B e do conjunto C pode ocorrer junto, mas **casos e resultados detalhados de C ficam separados de quem corrige o agente**.

**Revisões e escolha de modelo.** M começa com uma revisão curta do contrato e das invariantes ainda na primeira leva. Revisa depois os pontos de maior impacto: cálculo, confirmação, POST, concorrência, isolamento de sessões e limites das ferramentas. A revisão final avalia o diff integrado e evidências de execução; segunda opinião de outros modelos deve ser focada nesses riscos, não virar uma rodada aberta de sugestões.

I entra após o primeiro marco, com dois ou no máximo três candidatos. Comparar conclusão correta das conversas, violações de regras, chamadas de ferramenta, latência de cauda e custo; escolher primeiro por confiabilidade e cumprimento dos 60 segundos. Não usar C para escolher modelo. Congelar modelo e configuração antes da avaliação reservada; se houver mudanças posteriores, registrar que o agregado anterior não representa a versão final.

L começa com logs mínimos em A — latência, ferramentas, resultado do lead e erros, com dados pessoais mascarados — e ganha métricas na terceira leva. O monitor de sete dias deve ficar configurado e testado antes da entrega; os sete dias de execução são acompanhamento posterior, não algo que possa ser declarado concluído no prazo atual.

**Linha de corte.** Cortaria nesta ordem:

1. J, a página de chat, porque a interface obrigatória é HTTP.
2. Amplitude de I e rodadas extras de segunda opinião em M.
3. Volume do simulador D, preservando uma rodada curta e os casos fixos encontrados.
4. Dashboards e detalhamento de custos em L, mantendo logs, alertas básicos e monitor agendado.
5. Interpretações elaboradas de linguagem temporal: na dúvida, pedir datas explícitas.
6. Polimento visual de N, mantendo entrega clara e reproduzível.

Não podem cair: marco vertical, cálculo determinístico, catálogo como única fonte, validações, confirmação em turno separado, prevenção de POST duplicado, tratamento honesto de erros, encaminhamento, memória isolada, serialização, orçamento de tempo, testes essenciais, avaliação reservada e validação do deploy. Pelo peso de 30% em processo, setup dos agentes, decisões, evidências e instruções de reprodução também são parte do produto entregue.

**Os cinco maiores riscos de reprovação oculta:**

| Risco | Defesa mais barata |
|---|---|
| **Cálculo ou datas errados**, sobretudo sexta/sábado, virada de ano, arredondamento e mínimo de noites | Tabela pequena de testes unitários com resultados calculados independentemente; datas civis e dinheiro inteiro; mesma função para cotação e envio. |
| **Lead antecipado, duplicado ou com dados antigos**, incluindo confirmações concorrentes | Intenção de reserva versionada; resumo associado à versão; confirmação consumível uma vez; processamento serial e estado persistente de envio. |
| **Inventar atributos ou disponibilidade**, ou obedecer a instruções dentro de `descricao` | Ferramentas com parâmetros validados; fatos vinculados ao retorno do catálogo; ausência explícita; poucos casos fixos de injeção no catálogo e na mensagem. |
| **Encaminhar incorretamente ou negociar preço**, especialmente após “sou o dono” ou depois de um handoff anterior | Matriz curta e explícita de encaminhamento, sem ferramenta capaz de aplicar desconto; casos multi-turno cobrindo retomada normal após encaminhamento. |
| **Perder contexto ou estourar o prazo durante falhas externas** | Estado durável por sessão, testes intercalando duas sessões, timeouts por chamada, limite de iterações e resposta de contingência antes de 60 segundos. |