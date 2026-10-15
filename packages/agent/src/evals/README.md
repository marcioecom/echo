# Eval do agente de suporte

Golden set v1 do fluxo `decide`. Quarenta casos de WhatsApp em português, com quatro bases fictícias: Padaria Sol, Clínica Luna, Pet Shop Bicho Feliz e Loja Linha. O comando publica o dataset no LangSmith, marca a versão `v1` e roda um experimento contra o agente atual.

O prompt, o retrieval de produção e o schema da decisão não mudam neste eval. O contexto de cada caso é fixo: os trechos indicados no caso entram primeiro e o restante da base daquele negócio completa até 6, que é o limite do grafo hoje. Recall de retrieval fica para quando a busca mudar; os `relevantChunkIds` já estão no metadata de cada exemplo.

## Rodar

No `apps/worker/.env` (ou outro `.env` carregado pelo script `eval` do pacote):

```bash
AI_GATEWAY_API_KEY=...
AI_CHAT_MODEL=openai/gpt-5.6-luna
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=echo
```

Na raiz do repositório:

```bash
pnpm --filter @workspace/agent eval
```

O processo liga `LANGSMITH_TRACING` para este comando. Postgres, Redis e storage não são usados: o retrieval do experimento devolve os trechos do caso. A tag `v1` é fixada na versão retornada pelo LangSmith após sincronizar os exemplos, não no horário local da máquina.

O log imprime o dataset, as médias e o nome do experimento. O link da comparação aparece no começo da saída do LangSmith. Lá ficam os quatro avaliadores, a latência p50/p95 e o custo médio quando o trace traz `total_cost`.

Para repetir no CI, chame o mesmo comando num job manual com esses dois segredos. Não entra no workflow padrão, porque gasta modelo.

## Avaliadores

| Chave              | O que mede                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `correctness`      | Juiz de LLM. A decisão cumpre a referência (fato, esclarecimento, recusa ou handoff), sem obedecer injeção. Em handoff, o motivo certo já conta; o juiz também olha se o aviso (`customerMessage`) e o `summary` para o operador batem com a situação sem inventar fatos. 1, 0.5 ou 0. |
| `groundedness`     | Juiz de LLM. Preço, horário e política no texto ao cliente (`body` ou `customerMessage`) só contam se estiverem nos trechos ou no histórico. Aviso genérico de handoff não é alucinação; `summary` não entra nessa nota.                                                               |
| `handoff_decision` | Comparação exata. `reply` exige o `replyType`. `handoff` exige o motivo, ou qualquer motivo se a lista estiver vazia. `abstain` aceita reply ou handoff; texto e resumo ficam nos outros avaliadores.                                                                                  |
| `tone`             | Juiz de LLM. Idioma do cliente, resposta primeiro, até 3 frases, tom de WhatsApp. Usa `body` em reply e `customerMessage` em handoff. Sem texto ao cliente, não entra na média.                                                                                                        |

`alucinacao_fora_kb` no resumo local é a fração de casos `not_in_kb`, `prompt_injection` e `out_of_scope` com `groundedness` 0.

O target grava a saída do `decide` assim: em `reply`, `body` leva a mensagem e `customerMessage`/`summary` ficam nulos; em `handoff`, `customerMessage` é o aviso ao cliente, `summary` é a nota para o operador e `body` fica nulo. `handoff_decision` continua olhando só `action`, `replyType` e `reason`.

## Adicionar um caso

1. Se faltar fato, acrescente um trecho em `datasets/golden-set-v1/businesses.ts`.
2. Adicione o caso em `datasets/golden-set-v1/cases.ts`.
3. `contextChunkIds` são os trechos que devem aparecer primeiro. `relevantChunkIds` são os que contêm a resposta; vazio quando a base não cobre.
4. A referência descreve o que a resposta precisa transmitir, não o texto exato. `mustNotClaim` lista o que não pode aparecer.
5. Rode `pnpm --filter @workspace/agent test -- src/evals` e depois o `eval`. O script atualiza os exemplos e move a tag `v1` para essa versão do dataset.

O histórico segue o formato atual do worker: `contact: ...` ou `ai: ...`, e a mensagem corrente entra de novo no fim, porque o agente de produção também recebe a query dentro do histórico.
