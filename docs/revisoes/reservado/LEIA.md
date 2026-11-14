# Diagnóstico do conjunto reservado (P33)

Material do diagnóstico feito no papel da frente C depois das duas primeiras leituras do
agregado (83% e 80%, árvore b5af852), copiado sem reescrever. O conjunto e o histórico das
leituras estão em `evals/casos/reservado/LEIA.md`.

**Antes de ler `correcoes.md`:** as 9 mudanças que ele propõe foram todas vetadas pelo segundo
revisor (`segundo-revisor/vetos.md`) e os 9 casos voltaram ao original. Nenhuma está no
conjunto final.

Termos usados nos arquivos:

- **leitura 2**: a segunda das primeiras leituras do agregado (80%, árvore b5af852), a que foi
  gravada.
- **rodada A** e **rodada B**: rodadas do diagnóstico, com as expectativas originais (85%) e
  com as 9 mudanças propostas (91,7%, invalidado pelos vetos).
- Classes das falhas (`classificacao.md`): A2, redação certa reprovada pela expressão do
  próprio caso; J, falso vermelho do juiz compartilhado; B-det, erro do agente que se repete.

| arquivo | o que é |
|---|---|
| `auditoria.md` | conferência às cegas dos 60 casos contra o contrato, antes de qualquer rodada |
| `fase1.sha256` | hash da auditoria gravado antes da rodada A (`auditoria.md` não mudou desde então) |
| `classificacao.md` | classificação das falhas da rodada A e da leitura 2 |
| `correcoes.md` | a passada única de correção proposta (vetada) |
| `substitutos.md` | os 4 substitutos dos casos revelados |
| `segundo-revisor/vetos.md` | os 9 vetos |
| `segundo-revisor/apertos.md` | os 3 apertos em casos originais |
| `segundo-revisor/classificacao-r2.md` | releitura da classificação |
| `segundo-revisor/substitutos-r2.md` | conferência dos substitutos, em três rodadas |
| `fechado.sha256` | hashes dos 60 casos do conjunto fechado |
| `originais/` | versão original dos 3 casos apertados e dos 4 revelados |

Ficaram de fora os registros das conversas gravadas, os logs, os scripts e as entradas de
teste do diagnóstico, as versões intermediárias dos casos e a cópia da árvore usada como
export.
