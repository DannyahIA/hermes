# Hermes — Integração com WhatsApp (documento de planejamento)

> Este documento é apenas um plano técnico. Nenhum código, schema ou dependência descrita aqui
> foi implementado ou instalado nesta rodada — é a especificação para uma implementação futura.
> Escopo confirmado com o usuário: "não implementar ainda, mas deixar pronto já".

---

## 1. Objetivo

Permitir que o usuário registre uma transação enviando uma mensagem de WhatsApp — texto livre
("mercado 87,50 no cartão") ou uma foto de um recibo/nota fiscal — e o Hermes interpretar essa
mensagem, propor uma transação e adicioná-la ao histórico da conta correta, sem o usuário precisar
abrir o app.

Este é um canal de **entrada** adicional para o mesmo domínio já existente (`Transaction`,
`Account`, `Category`) — não um novo domínio. A integração deve reusar `CreateTransactionUseCase`
e as mesmas regras de negócio (validação, `Account.deltaFor`, unit-of-work) já usadas pela UI web.

---

## 2. Comparação de provedores

| Provedor                    | Prós                                                                                                                               | Contras                                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meta Cloud API (direto)** | Gratuito até um volume generoso de conversas/mês; sem intermediário; suporte oficial a mídia (imagem) e templates; webhook nativo. | Setup mais burocrático (verificação de negócio no Meta Business Manager); número dedicado exige portabilidade ou compra; documentação por vezes densa.                                 |
| **Twilio**                  | SDK e documentação excelentes; onboarding rápido (sandbox de teste em minutos); abstrai parte da complexidade do Meta.             | Cobra por mensagem além do que o Meta cobraria diretamente (camada de markup); ainda depende do Meta por trás, então herda os mesmos limites de conteúdo.                              |
| **Z-API (ou similar BR)**   | Onboarding muito rápido, aceita número de WhatsApp pessoal sem aprovação de Business Manager, preço baixo, comunidade BR grande.   | Não é API oficial — roda sobre automação não sancionada pelo WhatsApp, risco de bloqueio do número; sem SLA; inadequado para um produto que pretende crescer além de uso pessoal/beta. |

**Recomendação: Meta Cloud API direta.** Para um produto financeiro que vai lidar com dados
sensíveis do usuário, a via oficial (Meta Cloud API) é a única que garante estabilidade de longo
prazo e conformidade com os termos de uso do WhatsApp — o principal risco das alternativas
não-oficiais (Z-API e similares) é o bloqueio do número sem aviso, o que quebraria a funcionalidade
para todos os usuários simultaneamente. Twilio é uma alternativa aceitável se a burocracia de
verificação de negócio do Meta for um bloqueio real no curto prazo, mas deve ser tratada como um
adapter alternativo atrás da mesma porta (ver §4), não como a escolha definitiva.

---

## 3. Fluxo de ponta a ponta

```
Usuário (WhatsApp)
   │  envia texto ou imagem
   ▼
Meta Cloud API ──── webhook POST ───▶  /api/webhooks/whatsapp  (Next.js Route Handler)
                                              │
                                              │ 1. verifica assinatura (X-Hub-Signature-256)
                                              │ 2. identifica o remetente pelo número de telefone
                                              │ 3. resolve o número → userId (ver §5.3)
                                              ▼
                                    MessageParser (porta em core/contracts)
                                              │
                              texto ──────────┼────────── imagem
                                              │                │
                                   parser de texto      OCR + parser de recibo
                            (regex/heurística de         (extrai comerciante,
                             valor + descrição)            valor total, data)
                                              │                │
                                              └───────┬────────┘
                                                       ▼
                                       ParsedTransactionDraft
                                    { description, amount, type,
                                      suggestedAccountId?, suggestedCategoryId?,
                                      confidence }
                                                       │
                                                       ▼
                                   confiança alta E conta inequívoca?
                                    │                              │
                                   sim                             não
                                    │                              │
                                    ▼                              ▼
                        cria a transação direto        responde no WhatsApp pedindo
                        via CreateTransactionUseCase     confirmação/esclarecimento
                        e confirma por mensagem          ("Confirma R$ 87,50 em
                        ("Registrado: Mercado,            Mercado, conta Nubank?
                         R$ 87,50, hoje")                 Responda SIM ou informe a conta")
```

Ponto de design deliberado: **nenhuma transação é criada sem alguma forma de confirmação** — seja
implícita (alta confiança + conta única do usuário, com a mensagem de confirmação servindo como
o "recibo" que o usuário pode contestar) ou explícita (usuário responde "SIM" a uma proposta).
Isso evita o pior cenário de um app financeiro: uma leitura errada do OCR criar uma transação
errada silenciosamente, distorcendo o saldo sem o usuário perceber.

---

## 4. Superfície de domínio esperada

Seguindo a regra de dependência do projeto (`core` nunca depende de infraestrutura), o parsing de
mensagem é modelado como uma porta, não uma implementação concreta:

- **`core/contracts/message-parser.ts`** — contrato puro:

  ```ts
  interface ParsedTransactionDraft {
    description: string;
    amount: number;
    type: 'income' | 'expense';
    occurredAt?: Date;
    suggestedCategoryName?: string;
    confidence: 'high' | 'low';
  }

  interface MessageParser {
    parseText(text: string): ParsedTransactionDraft | null;
    parseImage(imageBuffer: Buffer): Promise<ParsedTransactionDraft | null>;
  }
  ```

  `confidence: 'low'` é o que decide, na camada de aplicação, se a transação é criada direto ou se
  vira uma pergunta de confirmação — a porta apenas descreve o que foi entendido, nunca decide se
  deve persistir.

- **`infra/whatsapp/`** — adapters concretos:
  - `whatsapp-cloud-api.client.ts` — cliente HTTP fino sobre a Meta Cloud API (enviar mensagem,
    baixar mídia recebida).
  - `regex-message-parser.ts` — implementação inicial de `MessageParser.parseText` via heurística
    (valor = primeiro número com vírgula/ponto decimal encontrado; descrição = resto do texto).
    Suficiente para a maioria dos casos de uso pessoal antes de justificar um serviço de NLP.
  - `receipt-ocr-message-parser.ts` — implementação de `parseImage`, delegando o OCR a um serviço
    externo (ex: Google Cloud Vision ou AWS Textract — a decisão de qual fica para a
    implementação, não é bloqueante para este documento).

- **`modules/whatsapp/application/`**:
  - `handle-incoming-message.use-case.ts` — orquestra: resolve usuário pelo telefone → chama o
    `MessageParser` apropriado → decide (criar direto vs. perguntar) → em caso de criação direta,
    delega ao já existente `CreateTransactionUseCase` (reuso total, zero duplicação de regra de
    negócio) → envia a resposta de confirmação via o client do WhatsApp.
  - `link-phone-number.use-case.ts` — vincula um número de telefone a um `userId` (ver §5.3).

- **Schema**: uma nova tabela `whatsapp_links` (`user_id`, `phone_number` normalizado E.164,
  `verified_at`, `default_account_id?`) — o `default_account_id` permite ao usuário pré-configurar
  "toda transação vinda do WhatsApp sem conta explícita cai nesta conta", evitando perguntar toda
  vez.

---

## 5. Segurança

### 5.1 Verificação de assinatura do webhook

Toda requisição recebida em `/api/webhooks/whatsapp` deve ter sua assinatura HMAC-SHA256
(header `X-Hub-Signature-256`, calculado pela Meta com o App Secret) validada antes de qualquer
processamento. Uma requisição com assinatura inválida é rejeitada com 401 e nunca chega à lógica
de negócio — isso impede que qualquer terceiro forje mensagens em nome de um usuário.

### 5.2 Rate limiting

O webhook é um endpoint público (a Meta precisa alcançá-lo sem autenticação de sessão), então é o
único ponto de entrada do sistema exposto sem login — precisa de um limite de requisições por
número de telefone de origem (ex: N mensagens por minuto) para impedir abuso caso a validação de
assinatura seja de alguma forma contornada ou haja um bug de parsing custoso (ex: OCR).

### 5.3 Vinculação de número de telefone (confirmação de posse)

Um número de telefone não pode ser vinculado a uma conta Hermes apenas porque ele _diz_ ser dono
dela. O fluxo de vinculação exige prova de posse:

1. Usuário logado no app web solicita "conectar WhatsApp" em `/settings`.
2. Hermes gera um código de 6 dígitos, válido por alguns minutos, associado ao `userId`.
3. Usuário envia esse código por WhatsApp para o número do Hermes.
4. O webhook, ao receber uma mensagem que é só um código de 6 dígitos vindo de um número ainda não
   vinculado, valida contra o código pendente e, se bater, cria o registro em `whatsapp_links`.

Isso é o mesmo princípio de segurança já usado por qualquer verificação de telefone (ex: 2FA por
SMS) e evita que alguém vincule o número de outra pessoa à própria conta, ou vice-versa.

### 5.4 Confirmar antes de comprometer (já coberto em §3, reforçado aqui)

Nunca criar uma transação de valor alto ou de confiança baixa sem confirmação explícita. Um limiar
de valor (configurável, ex: transações acima de R$ 500) deve sempre exigir confirmação
independentemente da confiança do parser, como uma segunda camada de proteção além da confiança
do OCR/regex — um erro de leitura de "R$ 8,70" como "R$ 870,00" não pode passar despercebido.

### 5.5 Dados de mídia

Imagens de recibos podem conter informações sensíveis além do valor da compra (últimos dígitos de
cartão, CPF em notas fiscais). A imagem recebida deve ser processada e descartada — não
armazenada permanentemente — a menos que o usuário opte explicitamente por anexá-la à transação
como comprovante (funcionalidade futura, fora deste escopo).

---

## 6. Fora de escopo desta rodada

- Nenhum código deste documento foi implementado: sem tabela `whatsapp_links`, sem rota de
  webhook, sem cliente da Meta Cloud API, sem parser.
- Transferências entre contas via WhatsApp (mensagem de texto ambígua demais para inferir duas
  pernas de uma transferência com segurança — mesmo racional já aplicado ao CSV import).
- Envio de relatórios/resumos periódicos via WhatsApp (canal de saída, não de entrada) — poderia
  ser um documento de planejamento separado no futuro.

---

## 7. Critério de pronto para uma futura implementação

Quando este trabalho for priorizado, a implementação deve:

1. Adicionar a tabela `whatsapp_links` e a migration correspondente.
2. Implementar `core/contracts/message-parser.ts` e ao menos o `regex-message-parser.ts` (o OCR de
   imagem pode ficar para uma segunda fase — texto livre já cobre o caso de uso principal do
   pedido original do usuário).
3. Implementar o fluxo de vinculação de número (§5.3) na tela de `/settings`.
4. Implementar o Route Handler do webhook com verificação de assinatura (§5.1) e rate limiting
   (§5.2).
5. Implementar `HandleIncomingMessageUseCase` reutilizando `CreateTransactionUseCase` sem duplicar
   nenhuma regra de negócio já existente.
6. Testes: parser de texto (casos com vírgula/ponto decimal, valores por extenso opcionalmente
   fora de escopo), fluxo de confirmação (confiança baixa → pergunta; confiança alta + valor abaixo
   do limiar → cria direto), verificação de assinatura do webhook (requisição forjada é rejeitada).
