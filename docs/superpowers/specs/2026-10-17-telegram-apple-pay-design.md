# Hermes — Telegram e Apple Pay: registrar gastos sem abrir o app (documento de planejamento)

> Especificação para implementação futura. Nenhum código, schema ou dependência descrita aqui foi
> implementado nesta rodada.

---

## 0. Contexto

- Este documento é o subsistema 3 da decomposição registrada em
  `2026-10-16-financial-reports-center-design.md` §0 ("Integração com Telegram + OCR").
- Ele reaproveita a estrutura de `docs/whatsapp-integration.md`: canal de entrada para o mesmo
  domínio, reuso total de `CreateTransactionUseCase`, vinculação com prova de posse e assinatura
  do webhook. O provedor passa a ser o Telegram, que tem API oficial e gratuita para bots, não
  exige verificação de empresa nem número dedicado, e tem botões dentro da mensagem.
- Pedido do usuário: "eu pago tudo sempre por aproximação no iPhone; podemos fazer um atalho que
  manda se foi no cartão débito ou cartão crédito automático e manda no Telegram pro Hermes
  salvar".
- Dependência: a fase F0 de `2026-10-17-inicio-hub-design.md` (patrimônio sem a dívida do cartão e
  pagamento de fatura fora das despesas) precisa estar pronta antes. Capturar automaticamente
  cada compra no crédito amplificaria os dois erros.

---

## 1. Experiência que queremos

Você encosta o iPhone na maquininha. Dois segundos depois chega no Telegram:

```
Nubank Crédito · R$ 23,90
Padaria Real · hoje 12:41
Categoria?
[Alimentação] [Mercado] [Lazer] [Outra…]
[Foi no débito] [Parcelar] [Desfazer]
```

Você toca em "Alimentação". A mensagem vira:

```
Nubank Crédito · R$ 23,90 · Alimentação
Padaria Real · hoje 12:41
Livre até 05/11: R$ 1.818,20 (R$ 101 por dia)
Da próxima vez, Padaria Real já entra em Alimentação.
[Desfazer]
```

Na segunda compra no mesmo lugar nada é perguntado: chega a confirmação já categorizada, com o
"Livre" atualizado (§4.1 do spec do Início). Cada pagamento diz quanto ainda dá para gastar.

O mesmo chat também aceita texto ("uber 18 débito") e comandos (`/livre`, `/fatura`, `/hoje`).

---

## 2. A restrição técnica que define a arquitetura

O atalho do iPhone não consegue mandar uma mensagem no Telegram que o Hermes receba de forma
confiável:

- A ação de internet do Atalhos ("Obter conteúdo do URL") só fala com a API de bots.
- Um bot não recebe as mensagens que ele mesmo envia. Também não há garantia documentada de que
  receba as de outro bot: os relatos da comunidade são contraditórios.
- A ação "Enviar mensagem" pelo app do Telegram depende do app aberto ou desbloqueado e pode pedir
  confirmação, o que não serve para uma automação silenciosa.

**Decisão:** o atalho envia os dados direto para o Hermes, por HTTPS, com um token pessoal. O
Telegram vira a conversa: confirmação, categoria, débito ou crédito, parcelar, desfazer,
perguntas, registro por texto e consultas.

**Consequência:** o iPhone precisa alcançar o Hermes também fora de casa, no 4G (decisão D1).
Situação em 17/10/2026: o domínio expirou e o Hermes só responde na rede local
(`NEXT_PUBLIC_APP_URL` aponta para `192.168.100.201`).

Isso não exige domínio nem abrir portas no modem:

- **Tailscale (recomendado):** gratuito para uso pessoal, instalado no servidor e no iPhone.
  Com "VPN sob demanda" ligada no iPhone, o atalho chama o Hermes pelo endereço privado da rede
  Tailscale (`https://<máquina>.<tailnet>.ts.net`, com HTTPS emitido pelo `tailscale serve`).
  O tráfego vai criptografado ponta a ponta e o Hermes continua fora da internet aberta, o que é
  mais seguro do que um endpoint público.
- **Alternativas, se um dia o Hermes precisar ser público:** Tailscale Funnel, que dá um endereço
  público `*.ts.net` sem domínio próprio, ou um domínio com Cloudflare Tunnel.

O bot do Telegram não depende de nada disso: em long polling (§9), o próprio Hermes busca as
mensagens no Telegram, só com internet de saída. Mensagens, botões, texto livre e comandos
funcionam já com a rede atual.

**Vantagem:** a captura funciona mesmo sem o Telegram conectado (a transação entra e aparece em
"Para revisar" no Início). O Telegram melhora a experiência, mas não é obrigatório.

---

## 3. F0 — Teste no iPhone antes de qualquer código (15 minutos)

A automação "Transação" (iOS 17 ou superior) entrega ao atalho os campos **Valor**,
**Comerciante** e **Cartão ou Passe** (há relatos também de **Nome**). Há relatos de Comerciante
chegando vazio e Valor chegando 0 em alguns casos. O desenho trata os dois (§5.3), mas o
comportamento real no seu iPhone e nos seus cartões precisa ser visto:

1. Em Atalhos › Automação › Nova automação › Transação, marque todos os cartões e escolha
   "Executar imediatamente".
2. Use uma única ação, "Mostrar notificação", com o texto:
   `Valor: [Valor] | Comerciante: [Comerciante] | Cartão: [Cartão ou Passe] | Nome: [Nome]`.
3. Faça uma compra pequena no **débito** e outra no **crédito**. Anote:
   - o nome exato que aparece em "Cartão" para cada um, e se débito e crédito são cartões
     separados na Wallet ou um só;
   - o formato do valor: "R$ 23,90" como texto, "23.9", ou vazio;
   - se o comerciante vem preenchido;
   - se a automação roda com o iPhone bloqueado e sem pedir confirmação;
   - se dispara em pagamento recusado (teste quando acontecer, sem forçar).

As respostas ajustam três pontos do desenho: o parser de valor, como o cartão é identificado
(`wallet_cards`) e se "Foi no débito" precisa existir (só se um único cartão da Wallet servir às
duas funções).

---

## 4. Arquitetura

```
iPhone: encosta na maquininha
  └─ Atalhos (automação "Transação", executa imediatamente)
       └─ POST https://<hermes>/api/capture/wallet      Authorization: Bearer <token>
            { amount, merchant, card, occurredAt }
              │
              ▼
        CaptureWalletPaymentUseCase
          1. idempotência (capture_events)
          2. cartão da Wallet → conta do Hermes (wallet_cards)    desconhecido → pergunta
          3. valor ausente/0 → pergunta                           (status needs_amount)
          4. estabelecimento → categoria (merchant_rules)         desconhecido → sem categoria
          5. CreateTransactionUseCase (despesa, source: 'wallet')
          6. ChatNotifier → mensagem com botões                   (se houver chat vinculado)
              │
              ▼
Telegram (você)  ── toque num botão, texto livre ou comando
  └─ Bot API ← worker de long polling `pnpm telegram:poll` (padrão: só precisa de internet
              de saída) ou → POST /api/telegram/webhook (se um dia houver URL pública)
       └─ HandleChatUpdateUseCase
            ├─ botões → UpdateTransaction / MoveTransactionToAccount / Delete / CreateInstallmentPlan
            ├─ texto  → parseQuickEntry → CreateTransactionUseCase
            └─ comandos → métricas do Início (Livre, Cartões, Últimas)
```

### 4.1 Onde cada coisa mora (regra de dependência de `docs/architecture.md`)

```
core/contracts/
  chat-channel.ts                 porta: sendMessage, editMessage, answerCallback, (askForReply)
                                  independente do canal; o WhatsApp pode implementar depois
modules/capture/
  domain/
    parse-quick-entry.ts          parser de texto pt-BR (compartilhado com o registro rápido
                                  do Início)
    normalize-merchant.ts         "PADARIA REAL LTDA *123" → chave "padaria real" e nome
                                  "Padaria Real"
    parse-amount.ts               "R$ 23,90", "23,90", "23.9", 23.9, "1.234,56"
  application/
    capture-wallet-payment.use-case.ts
    handle-chat-update.use-case.ts
    link-chat.use-case.ts / unlink-chat.use-case.ts
    create-capture-token.use-case.ts / revoke-capture-token.use-case.ts
    resolve-wallet-card.use-case.ts
    move-transaction-to-account.use-case.ts   remove e recria numa unidade de trabalho; o
                                              UpdateTransaction não troca conta por desenho
infra/telegram/
  telegram-bot-api.client.ts      fetch puro sobre a Bot API (sem SDK, zero dependência nova)
  telegram-chat-channel.ts        implementa ChatChannel
  telegram-update.mapper.ts       Update do Telegram → comando interno
  polling-worker.ts               `pnpm telegram:poll` (desenvolvimento e fallback)
app/api/capture/wallet/route.ts
app/api/telegram/webhook/route.ts
app/settings/                     nova seção "Integrações" (§6)
```

`suggestCategories` vem do spec do Início (§4.2) e é usado pelos dois lados.

### 4.2 Dados (uma migration Drizzle)

| Tabela            | Campos                                                                                                                                                                                | Para quê                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `api_tokens`      | id, user_id, name, token_hash (SHA-256), prefix, scope (`capture:write`), created_at, last_used_at, revoked_at                                                                        | Autenticar o atalho sem sessão de navegador.                                                                 |
| `chat_links`      | id, user_id, channel (`telegram`), external_chat_id (único por canal), username, linked_at, revoked_at                                                                                | Saber para quem mandar e de quem aceitar.                                                                    |
| `chat_link_codes` | code, user_id, expires_at, used_at                                                                                                                                                    | Prova de posse ao conectar (§5.1).                                                                           |
| `wallet_cards`    | id, user_id, wallet_name, account_id, alternate_account_id?                                                                                                                           | Cartão da Wallet → conta. `alternate_account_id` só existe se um cartão da Wallet servir a débito e crédito. |
| `merchant_rules`  | id, user_id, merchant_key, display_name, category_id, hits, updated_at                                                                                                                | Lembrar a categoria e o nome limpo de cada estabelecimento.                                                  |
| `capture_events`  | id, user_id, source (`wallet`/`telegram_text`), idempotency_key (único por usuário), payload (jsonb mínimo), transaction_id (set null on delete), status, chat_message_id, created_at | Idempotência, perguntas pendentes e o vínculo mensagem → transação para os botões.                           |
| `transactions`    | novo `source` (`manual`/`import`/`recurring`/`installment`/`wallet`/`telegram`), padrão `manual`                                                                                      | Marca de origem nas listas e filtro "capturadas".                                                            |

---

## 5. Fluxos

### 5.1 Conectar o Telegram (uma vez)

1. Em Configurações › Integrações, o usuário toca em **Conectar Telegram**.
2. O Hermes gera um código aleatório (válido por 10 minutos, de uso único) e mostra o botão
   **Abrir no Telegram** (`t.me/<bot>?start=<código>`) e um QR code para quem está no
   computador.
3. No Telegram, o usuário toca em **Começar**. O bot recebe `/start <código>`, valida e grava
   `chat_links`. A resposta é: "Pronto. Vou te avisar aqui a cada pagamento e você pode registrar
   gastos mandando mensagem, como 'almoço 32,50 crédito'."
4. A tela de Configurações passa a mostrar "Conectado como @usuario" e o botão **Desconectar**.

Mensagens de chats não vinculados recebem só: "Este bot é do Hermes. Para usar, conecte pelo app
em Configurações › Integrações." Grupos são ignorados.

### 5.2 Configurar o atalho do iPhone (uma vez)

1. Em Configurações › Integrações › Atalho do iPhone, o usuário toca em **Gerar token**. O token
   é mostrado uma única vez, com botão de copiar; o Hermes guarda só o hash.
2. A tela mostra a receita de §7 com os valores já preenchidos (URL e cabeçalho).
3. **Testar:** a tela mostra "Última captura: há 2 min · Padaria Real · R$ 23,90" assim que a
   primeira chega. É a confirmação de que tudo está ligado.

### 5.3 Pagamento capturado

Dados recebidos: `{ amount, merchant, card, occurredAt }`. Os campos chegam como o Atalhos os
manda: o valor pode ser texto ("R$ 23,90") e `occurredAt` vem em ISO 8601.

1. **Autenticação:** token válido, não revogado, com escopo `capture:write`. Se não, a resposta é
   401 e nada é gravado.
2. **Idempotência:** a chave é `card | valor | occurredAt arredondado ao minuto`. Uma repetição
   devolve o mesmo resultado sem duplicar.
3. **Valor:** `parseAmount`. Se vier vazio ou 0, grava `capture_events` com status
   `needs_amount` e pergunta no Telegram:

   > Compra em Padaria Real (Nubank) chegou sem valor. Quanto foi? Responda só o número, por
   > exemplo 23,90.

   A resposta, como `force_reply`, completa a captura.

4. **Cartão:** procura `wallet_cards` pelo nome. Se for desconhecido, status `needs_account`:

   > Primeira compra que vejo com "Nubank". Ela vai para qual conta?
   > [Nubank Crédito] [Nubank Conta] [Itaú Crédito]

   Os cartões de crédito aparecem primeiro. A escolha grava o mapeamento e completa a captura.

5. **Estabelecimento:** `normalizeMerchant`. Se a chave existir em `merchant_rules`, usa a
   categoria e o nome limpo. Se não, a transação fica sem categoria e a mensagem traz sugestões.
   Se o comerciante vier vazio, a descrição é "Compra no [cartão]".
6. **Grava** com `CreateTransactionUseCase`: despesa, conta resolvida, data e hora do toque,
   `source: 'wallet'`. A compra no crédito aumenta a dívida do cartão (`Account.deltaFor`) e entra
   na fatura aberta; a compra no débito sai da conta corrente.
7. **Responde ao atalho** com `{ "status": "ok" }`, sem saldos nem dados da conta (§8).
8. **Notifica** no Telegram, se houver chat vinculado, com as mensagens de §1.
9. **Alertas por evento,** sem precisar de agendador:
   - se esta compra fez um orçamento passar de 80% ou de 100%, uma linha a mais na mesma mensagem:
     "Mercado: 84% do orçamento, acima do ritmo";
   - se o "Livre" ficou negativo, outra linha: "Você já comprometeu R$ 120,00 da próxima entrada."

Dados estruturados da maquininha não passam por confirmação (o risco de leitura errada que
justifica o limiar do doc do WhatsApp, §5.4, é do OCR e do texto livre). O desfazer fica a um
toque.

### 5.4 Botões

| Botão                          | O que faz                                                                                                                                                                           | Como a mensagem fica                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Categoria sugerida / Outra…    | `UpdateTransaction(categoryId)` e grava ou atualiza `merchant_rules`                                                                                                                | "✓ Alimentação. Da próxima vez, Padaria Real já entra em Alimentação." |
| Trocar categoria               | Mostra as sugestões de novo                                                                                                                                                         | Teclado de categorias.                                                 |
| Foi no débito / Foi no crédito | `MoveTransactionToAccount` para `alternate_account_id` (só aparece se o cartão tiver conta alternativa)                                                                             | Cabeçalho atualizado com a nova conta.                                 |
| Parcelar                       | Pergunta o número de parcelas ([2] [3] [4] [5] [6] [10] [12] [Outro]). Troca a compra por um plano com o mesmo total (`CreateInstallmentPlanUseCase`), na mesma unidade de trabalho | "Parcelado em 6× de R$ 49,90 (primeira na fatura de 03/11)."           |
| Desfazer                       | `DeleteTransactionUseCase`                                                                                                                                                          | "Desfeito. R$ 23,90 em Padaria Real não foi registrado."               |

Os botões carregam só o id opaco de `capture_events`. A cada toque o servidor confere que o chat
está vinculado ao dono da transação. Os botões valem por 7 dias; depois, "Esta mensagem expirou.
Edite pelo app."

### 5.5 Texto livre

O `parseQuickEntry` é o mesmo do registro rápido do Início:

| Mensagem                                | Entendido                                                  |
| --------------------------------------- | ---------------------------------------------------------- |
| `almoço 32,50`                          | Despesa R$ 32,50 · "Almoço" · conta padrão do texto · hoje |
| `uber 18 débito`                        | Despesa R$ 18,00 · "Uber" · conta mapeada para "débito"    |
| `mercado 250,40 ontem`                  | Data de ontem                                              |
| `+3000 salário` / `recebi 3000 salário` | Receita                                                    |
| `farmácia 89,90 itaú`                   | Conta pelo nome ou apelido                                 |

**Regras do parser:**

- **Valor:** formato pt-BR (`1.234,56`, `1234,56`, `32`), aceitando também ponto decimal
  (`1234.56`).
- **Palavras de conta:** crédito, débito, pix, dinheiro, ou o nome ou apelido de uma conta.
- **Palavras de data:** hoje, ontem, anteontem, `dd/mm`.
- **Descrição:** o resto do texto.

**Comportamento:**

- **Resposta:** sempre ecoa o que foi entendido, com [Trocar categoria] [Desfazer].
- **Confirmação antes de salvar:** só acima de R$ 500 (configurável) ou quando o parser tiver
  dúvida, como dois números na mensagem:
  > Entendi R$ 870,00 em Mercado (Nubank Crédito). Salvo?
  > [Salvar] [Corrigir]

### 5.6 Comandos (só leitura)

| Comando     | Resposta                                                                      |
| ----------- | ----------------------------------------------------------------------------- |
| `/livre`    | O cabeçalho do Início em texto: livre até a data, por dia, cartões e a pagar. |
| `/fatura`   | Por cartão: fatura aberta, data de fechamento, fatura fechada e vencimento.   |
| `/hoje`     | Gastos de hoje, com o total.                                                  |
| `/desfazer` | Desfaz a última captura, com confirmação.                                     |
| `/ajuda`    | Exemplos de texto livre e a lista de comandos.                                |

---

## 6. Tela de Configurações › Integrações

- **Telegram:** estado (desconectado ou "Conectado como @usuario desde 17/10"), Conectar e
  Desconectar.
- **Atalho do iPhone:**
  - tokens ativos (nome, prefixo `hm_3fa…`, último uso) com Revogar, e o botão Gerar token;
  - a receita de §7 com a URL preenchida;
  - a última captura recebida.
- **Cartões da Wallet:** a lista de `wallet_cards` (nome na Wallet → conta, e conta alternativa
  se houver), editável. Cartões novos aparecem aqui sozinhos depois da primeira compra.
- **Regras de estabelecimento:** a lista de `merchant_rules` (nome, categoria, quantas vezes foi
  usada), editável e removível.
- **Preferências:**
  - limiar de confirmação do texto livre;
  - mostrar ou não o "Livre" e saldos nas mensagens do Telegram (§8);
  - conta padrão para texto sem conta.

---

## 7. Receita do atalho (o que vai na tela de Integrações)

> Os rótulos podem variar um pouco conforme a versão do iOS. Confira no teste F0.

1. Abra **Atalhos › Automação › Nova automação** e escolha **Transação**.
2. Em **Cartões**, marque os cartões que você usa (débito e crédito). Deixe **Categorias** e
   **Estabelecimentos** em "Qualquer". Escolha **Executar imediatamente**.
3. Adicione a ação **Obter conteúdo do URL**:
   - URL: `https://SEU-HERMES/api/capture/wallet`, com o endereço do Tailscale, por exemplo
     `https://hermes.tail1234.ts.net/api/capture/wallet` (D1)
   - Método: `POST`
   - Cabeçalhos: `Authorization` = `Bearer hm_…` (o token gerado)
   - Corpo da requisição: **JSON**, com os campos:
     - `amount` = Entrada do atalho › **Valor**
     - `merchant` = Entrada do atalho › **Comerciante**
     - `card` = Entrada do atalho › **Cartão ou Passe**
     - `occurredAt` = **Data atual**, formato ISO 8601
4. Recomendado: adicione **Se** o conteúdo do URL **não contém** `ok` → **Mostrar notificação**
   "Hermes não recebeu R$ [Valor] em [Comerciante]. Registre pelo Telegram." Assim, se o Hermes
   estiver fora do ar, você fica sabendo na hora e registra por texto depois.

**Débito ou crédito:** não é preciso configurar nada no atalho. O Hermes descobre pelo nome do
cartão, que você associa a uma conta na primeira compra (§5.3, passo 4). Se a Wallet tiver um
único cartão para as duas funções, ele vai para a conta que você escolher como padrão, e o botão
"Foi no débito" corrige em um toque.

---

## 8. Segurança e privacidade

- **Token do atalho:**
  - 32 bytes aleatórios em base64url, com o prefixo `hm_` para ser reconhecível;
  - mostrado uma vez e guardado só como SHA-256;
  - escopo `capture:write`: não lê nada, só registra captura;
  - revogável a qualquer momento, com o último uso visível;
  - limite de 30 requisições por minuto por token.
- **A resposta do endpoint** não traz saldo nem dado de conta, só `status`.
- **Webhook do Telegram:** `setWebhook` com `secret_token`. O servidor rejeita qualquer requisição
  sem o cabeçalho `X-Telegram-Bot-Api-Secret-Token` correto, antes de qualquer processamento.
- **Só chats privados vinculados** são atendidos. Os botões carregam ids opacos, e a posse é
  conferida a cada toque.
- **Privacidade:** conversas com bots no Telegram não têm criptografia de ponta a ponta, então
  valores e estabelecimentos passam pelos servidores do Telegram. As consultas (`/livre`,
  `/fatura`) e a linha "Livre" nas confirmações podem ser desligadas em Preferências. Recomenda-se
  a senha de bloqueio do próprio Telegram.
- **Logs** registram ids de captura, nunca o token nem o payload completo.
- **Desligar tudo:** revogar o token ou desconectar o chat interrompe na hora.

---

## 9. Hospedagem e execução

- **Acesso do iPhone ao Hermes (D1):** Tailscale no servidor (`tailscale serve --bg 3000`, que
  publica o `next start` só dentro da rede Tailscale, com HTTPS) e no iPhone (app Tailscale com
  "VPN sob demanda"). A máquina precisa ficar ligada; se estiver desligada ou fora da rede, o
  passo 4 da receita (§7) avisa no iPhone.
- **Transporte do bot (D2):**
  - **padrão, long polling:** `pnpm telegram:poll`, um processo ao lado do `next start` (serviço
    de usuário do systemd ou mais um serviço no `docker-compose.yml`). Só precisa de internet de
    saída, então funciona hoje, sem domínio;
  - **webhook,** só se um dia houver URL pública: dispensa o processo extra, pois o handler é uma
    rota do Next.

  Os dois são mutuamente exclusivos: o worker chama `deleteWebhook` ao iniciar.

- **Variáveis de ambiente:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` e, só no modo
  webhook, `TELEGRAM_WEBHOOK_SECRET`. A tela de Integrações mostra o endereço do atalho a partir
  de uma nova `CAPTURE_BASE_URL` (o endereço do Tailscale), já que `NEXT_PUBLIC_APP_URL` continua
  sendo o endereço da rede local.
- **Criação do bot:** no @BotFather (`/newbot`). Desligue a entrada em grupos (`/setjoingroups`).

---

## 10. Testes

- **Tabelas de casos** para `parseAmount`, `normalizeMerchant` e `parseQuickEntry` (formatos
  pt-BR, palavras de conta e data, receita, ambiguidade).
- **`CaptureWalletPaymentUseCase`** com fakes:
  - repetição idempotente;
  - cartão desconhecido → `needs_account`;
  - valor ausente → `needs_amount`;
  - regra de estabelecimento aplicada;
  - crédito aumenta a dívida e débito reduz o saldo (`deltaFor`);
  - sem chat vinculado, salva e não notifica.
- **Rotas:**
  - `/api/capture/wallet`: 401 sem token, com token revogado ou com escopo errado; 200 com
    payload válido;
  - `/api/telegram/webhook`: 401 sem o segredo correto; chat não vinculado não altera nada.
- **Botões:** posse conferida (chat A não mexe em transação de B), Parcelar preserva o total,
  Desfazer remove e devolve o saldo.
- **Roteiro manual no iPhone** a cada fase: débito, crédito, cartão novo, compra sem valor,
  Hermes fora do ar.

---

## 11. Fases e critério de pronto

| Fase              | Entrega                                                                                                                                                                                                   | Pronto quando                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **F0**            | Teste no iPhone (§3) e Tailscale no servidor e no iPhone (D1)                                                                                                                                             | Campos, formatos e nomes de cartão anotados neste doc.                                        |
| **F1**            | Captura do Apple Pay **sem** Telegram: `api_tokens`, endpoint, `wallet_cards` editável em Configurações, `merchant_rules`, `transactions.source`. As capturas aparecem em "Para revisar" no Início        | Uma compra real no débito e outra no crédito entram na conta certa, sem duplicar, em até 5 s. |
| **F2**            | Telegram: vincular, notificar, botões (categoria, débito/crédito, parcelar, desfazer), perguntas de cartão novo e valor ausente, alertas de orçamento e de "Livre" por evento                             | O fluxo de §1 funciona de ponta a ponta no iPhone.                                            |
| **F3**            | Texto livre e comandos (`/livre`, `/fatura`, `/hoje`, `/desfazer`, `/ajuda`)                                                                                                                              | Tabela de §5.5 coberta por testes e conferida no chat.                                        |
| **F4 (opcional)** | Foto de comprovante (OCR, como no doc do WhatsApp §4), lembrete de fechamento e vencimento da fatura, resumo diário. Os lembretes e o resumo exigem um agendador; em modo polling, o próprio worker serve | Decidir depois de usar F1–F3 por algumas semanas.                                             |

**F1 — como ficou:**

- `POST /api/capture/wallet` com `Authorization: Bearer hm_…`; responde `{ "status": "ok" }`
  (com o estado da captura), 401 sem token válido, 429 acima de 30 por minuto e 400 quando nada
  do que chegou é usável (atalho mal configurado), para o passo 4 da receita avisar no iPhone.
- Sem Telegram, o que falta numa captura se resolve em Configurações › "Esperando você": um
  cartão novo espera a conta (escolhida em "Cartões da Wallet", que registra as compras que
  esperavam) e uma compra sem valor espera o valor; as duas podem ser descartadas.
- `merchant_rules` já existia (Início, F3). `transactions.source` marca a origem; as parcelas e
  recorrências antigas foram marcadas pela migration, e as compras capturadas aparecem nas listas
  com "Apple Pay".
- Ficam para a F2: a lista editável de regras de estabelecimento e as preferências (§6).

**F2 — como ficou:**

- **Conectar:** Configurações › Telegram › **Conectar Telegram** gera o link
  `t.me/<bot>?start=<código>` (10 minutos, uso único), com o botão **Abrir no Telegram** e o link
  para copiar. A página se atualiza sozinha quando o chat conecta. Sem QR code, para não trazer
  dependência nova: no computador, copie o link e abra no celular. Um chat por usuário e um usuário
  por chat; **Desconectar** guarda o vínculo como revogado.
- **Anúncio:** cada captura nova é contada no chat logo depois da resposta ao atalho (`after()`),
  fora da transação: o Telegram fora do ar nunca derruba uma captura, que continua esperando em
  Configurações. O que se resolve em Configurações (cartão associado, valor informado, compra
  descartada) também atualiza a mensagem no chat; uma compra descartada pelo app só atualiza uma
  mensagem que já existia, sem puxar conversa.
- **Botões (§5.4):** categoria sugerida e **Outra…** (todas as categorias, 8 por página), **Trocar
  categoria**, **Foi no débito/crédito** (só com conta alternativa no cartão), **Parcelar** (só
  compra no cartão de crédito; 2 a 12 vezes, mesmo total, primeira parcela na data da compra) e
  **Desfazer** (a compra ou o parcelamento inteiro, devolvendo o saldo). Cartão novo: até 10
  contas de crédito e corrente como botões, mais **Descartar**; as demais ficam em Configurações.
  Valor ausente: a pergunta vai como resposta (`force_reply`) e uma resposta que não é valor, ou
  passa do que a coluna guarda, pergunta de novo.
- **Segurança:** a cada toque, o chat precisa estar vinculado ao dono da captura; os botões valem 7
  dias. Uma regra que diz não (categoria ou conta arquivada) responde "Não deu para fazer isso.
  Edite pelo app." e nada muda, porque a unidade de trabalho é desfeita.
- **"Livre" e alertas** saem por evento na própria mensagem (§5.3, passo 9). Em Configurações ›
  Telegram dá para não mandar o "Livre" (D5), guardado como preferência de visualização da tela
  `telegram`; os alertas de orçamento continuam.
- **Configurações › Estabelecimentos:** a lista de `merchant_rules`, com a categoria editável,
  **Esquecer** e busca a partir de 8 estabelecimentos.
- **Rodar o bot:** crie no @BotFather (`/newbot`, e `/setjoingroups` › Disable), ponha
  `TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME` (sem "@") no `.env.local` e rode
  `pnpm telegram:poll` ao lado do `next start` (ele chama `deleteWebhook` ao iniciar e para com
  Ctrl+C ou SIGTERM). O webhook (`/api/telegram/webhook`) só liga com `TELEGRAM_WEBHOOK_SECRET` e
  uma URL pública:
  `curl -d url=https://SEU-HERMES/api/telegram/webhook -d secret_token=$TELEGRAM_WEBHOOK_SECRET https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook`.
- **Acesso (D1), 19/10/2026:** Tailscale com `tailscale serve --bg 3000`. O nome `*.ts.net` não
  resolveu no iPhone (nenhuma conexão chegou na porta 443, mesmo com MagicDNS e "Use Tailscale
  DNS"), então o atalho usa o IP da Tailscale da máquina, `http://<ip-tailscale>:3000`, que é
  fixo e continua criptografado pelo túnel. Fica para rever quando o app for publicado.
- Falta o critério de pronto da F2: o fluxo de §1 de ponta a ponta no iPhone, com um bot real.

**F3 — como ficou:**

- **Texto livre (§5.5):** qualquer linha que não seja comando nem resposta a uma pergunta é lida
  pelo mesmo `parseQuickEntry` do registro rápido do Início (conta pelo nome ou por "crédito",
  "débito", "pix"; datas; "+" ou "recebi" para entrada; categoria lembrada do estabelecimento ou
  pelo nome) e registrada como captura `telegram_text`, com a transação marcada `source:
'telegram'`. A resposta é a mesma mensagem dos pagamentos (categoria, Trocar categoria,
  Parcelar no crédito, Desfazer). A chave de idempotência é a mensagem do chat: a mesma mensagem
  entregue duas vezes registra uma vez.
- **Confirmação:** acima de R$ 500 ou quando outro número poderia ser o valor, a linha espera
  ("Entendi R$ 870,00 em Mercado (Nubank Crédito). Salvo?" [Salvar] [Corrigir]). O nome da conta
  vai entre parênteses porque "no"/"na" não serve para todo nome. **Corrigir** descarta e pede
  para mandar de novo. Linha sem valor, sem descrição ou sem conta recebe uma resposta dizendo o
  que faltou.
- **Comandos (§5.6):** `/livre` (livre, por dia, conta corrente, cartões e agendado), `/fatura`
  (aberta, fechamento e vencimento; o que resta da fechada), `/hoje` (gastos de hoje e total),
  `/desfazer` (o último registro dos últimos 7 dias, com [Desfazer] [Manter]; desfazer também
  atualiza a mensagem original) e `/ajuda`. Comando desconhecido recebe a ajuda. O worker
  registra o menu de comandos no Telegram (`setMyCommands`) ao iniciar. Com o "Livre" desligado em
  Configurações › Telegram, `/livre` e `/fatura` não mandam saldos.
- Em Configurações, "Última compra recebida" do atalho só considera capturas da Wallet.
- **Ficam para depois:** as preferências de limiar de confirmação e de conta padrão do texto
  (hoje, R$ 500 fixo, e a conta mais usada para aquele tipo de lançamento, como no Início).

---

## 12. Fora de escopo

- WhatsApp: a porta `ChatChannel` deixa pronto para um adaptador futuro.
- Sincronização bancária / Open Finance.
- Voz.
- Uso em grupo ou compartilhado entre pessoas.

---

## 13. Decisões (com o padrão adotado se ninguém disser o contrário)

| #   | Pergunta                                     | Padrão                                                                                                                                          |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Como o iPhone alcança o Hermes fora de casa? | Tailscale: rede privada, sem domínio e sem abrir portas. Tailscale Funnel ou domínio com Cloudflare Tunnel só se o Hermes precisar ser público. |
| D2  | Webhook ou polling?                          | Polling, que funciona sem URL pública. Webhook só se houver URL pública.                                                                        |
| D3  | Compras do Apple Pay pedem confirmação?      | Não, salvam direto e o desfazer fica a um toque. O texto livre confirma acima de R$ 500.                                                        |
| D4  | Compra de estabelecimento novo               | Salva sem categoria e pergunta, em vez de usar uma categoria genérica "A classificar".                                                          |
| D5  | Mostrar "Livre" e saldos no Telegram?        | Sim, com opção de desligar.                                                                                                                     |
