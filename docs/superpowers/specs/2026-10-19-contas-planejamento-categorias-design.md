# Hermes — Contas, orçamentos e empréstimos numa página; categorias que ajudam; sidebar fixa

> Especificação de design para implementação. Conversa de 19/10/2026. O que o usuário decidiu está
> marcado como decisão dele; o que foi escolha do design está marcado como **[escolha do
> design]**; o resto fica para quem constrói (§11).

---

## 0. Contexto

- Pedido do usuário (19/10/2026), em quatro partes:
  1. Orçamentos e Empréstimos fazem pouco cada um; juntar as telas. Depois, na conversa: Contas,
     Orçamentos e Empréstimos "se interligam" e devem dividir uma página só.
  2. Categorias: sugerir categorias que o usuário ainda não tem (a compra na farmácia deveria ter
     sugerido "Saúde"), criar uma categoria sem sair da compra, e uma tela de Categorias útil.
  3. Contas: revisão de funcionalidade e visual.
  4. Sidebar: altura da tela; só o conteúdo da página rola.
- Relação com outros specs: o "Livre" e o ritmo dos orçamentos vêm de
  `2026-10-17-inicio-hub-design.md` (§4.1, §4.2); os avisos no Telegram e o registro por texto vêm
  de `2026-10-17-telegram-apple-pay-design.md` (F2 e F3, já implementadas).
- Esboços aprovados na conversa (servidor de brainstorm, `.superpowers/brainstorm/`):
  `categorias-sugestao.html`, `categorias-tela.html`, `pagina-unica.html` (opção **B** escolhida)
  e `simulador.html`.

---

## 1. Intenção

O usuário quer saber, a qualquer momento, **quanto do mês já está comprometido e quanto ainda
cabe**. Hoje essa resposta está espalhada em três telas que quase não são abertas:

- **Contas** só é usada para criar uma conta e, raramente, ver o saldo de uma delas.
- **Orçamentos** deveria avisar quando o gasto chega perto do limite e ajudar a segurar. Na
  percepção do usuário, "nem isso está funcionando".
- **Empréstimos** cumpre o básico, mas o valor que o usuário procura é outro: comparar ofertas de
  bancos (prazo, taxa, custo total, impostos), saber se vai dar conta de pagar olhando o futuro, e
  cadastrar o empréstimo contratado para que as parcelas entrem no mês sem susto. Caso real: moto,
  R$ 25.000, comparação entre 12 e 16 meses, parcela de cerca de R$ 1.500 a partir do mês que vem,
  e o 13º e o 14º de dezembro usados para amortizar.

Nas categorias, o momento que falhou: o usuário registrou na mão uma compra de remédios. O Hermes
sugeriu só categorias que já existiam. "Saúde" não existia, não foi sugerida, e criar exigia ir à
tela de Categorias, que também não tem utilidade hoje.

**Sucesso, nas palavras dele:** nas categorias, "as sugestões e a lista com o gráfico mostrando o
que aumentou e diminuiu já deixam a tela útil". No orçamento, ser avisado por etapas ("cheguei na
metade do orçamento em 10 dias de mês, como assim? Tá na hora de segurar"). Nos empréstimos, ver
"mês que vem começa, R$ 1.500 por mês: quanto isso pesa?".

---

## 2. Objetivos, não-objetivos e antiobjetivos

**Objetivos**

- Uma página para Contas, Orçamentos e Empréstimos, no layout B (§6.1).
- Orçamentos que avisam por etapa e por ritmo (§6.3).
- Um simulador que compara ofertas, mostra o peso no mês e simula amortizações (§7).
- Sugestão de categorias que o usuário ainda não tem, e criação na hora, em todo lugar que pede
  categoria (§5.1).
- Tela de Categorias em lista, com comparação contra o mês anterior e sugestões (§5.2).
- Sidebar da altura da tela; só o conteúdo rola (§4).

**Não-objetivos (catalogados para o futuro, pedido explícito do usuário)**

- Notificações em tempo real por websocket.
- App Android/iOS com notificação direto no celular.

**Antiobjetivos (o que faria isto falhar mesmo funcionando)**

- Avisos que viram barulho: o mesmo aviso repetido a cada compra até o usuário ignorar todos.
- Telas "bonitas" que continuam sem uso: blocos grandes, pouca informação por tela, sem
  comparação. O usuário pediu explicitamente listas compactas, lineares, no lugar dos blocos.
- Um simulador que inventa números: impostos e taxas calculados por fórmula própria em vez do que
  o banco informou.
- Juntar as telas e perder funções que existem hoje (criar e editar conta, pagar fatura, criar e
  excluir orçamento, criar e excluir empréstimo).

---

## 3. Restrições

- Arquitetura e convenções do repositório (`docs/architecture.md`, `docs/conventions.md`): regra
  de negócio em `modules/` e `core/`, telas em `app/`, testes com fakes (TDD), textos em pt-BR.
- Saldos e totais continuam sendo **consequência das transações** (nunca editados à mão).
- O Telegram é o canal de aviso que existe hoje (bot e worker `pnpm telegram:poll`, F2/F3).
- Sem dependência nova sem motivo forte. Os gráficos usam o que o projeto já tem (`recharts`) ou
  SVG simples.
- Funciona no celular (Safari, iPhone) e no tema escuro, como o resto do app.

---

## 4. Parte 1 — Sidebar fixa, conteúdo rolando

Hoje (`src/components/layout/app-shell-chrome.tsx`) a moldura tem `min-h-screen` e a página
inteira rola: a sidebar cresce até a altura do conteúdo.

**Decisão do usuário:** a sidebar tem a altura da tela e fica parada; só a área de conteúdo da
página rola. Os demais elementos (sidebar, cabeçalho) não fazem a página crescer.

- A moldura passa a ter a altura da janela (`100dvh`, descontado o espaçamento externo), e a área
  de conteúdo vira o contêiner de rolagem.
- **[escolha do design]** No celular, onde a sidebar já é uma gaveta, vale o mesmo: o cabeçalho
  fica parado e o conteúdo rola.
- Cuidados para quem constrói: elementos `sticky` existentes (o comentário no próprio
  `app-shell-chrome.tsx` fala de uma barra `sticky`), a rolagem infinita da lista de transações e
  qualquer código que dependa da rolagem da janela precisam continuar funcionando com o novo
  contêiner. O "voltar ao topo" ao trocar de página deve rolar o contêiner, não a janela.

**Pronto quando:** em qualquer página longa, a sidebar fica inteira na tela e só o conteúdo rola,
no computador e no celular.

---

## 5. Parte 2 — Categorias

### 5.1 Sugerir categorias que ainda não existem, e criar na hora

Aprovado no esboço `categorias-sugestao.html`.

- Onde o Hermes hoje sugere categorias para uma transação sem categoria (`CategoryPicker` em
  "Para revisar" e na lista do Início, os botões do Telegram, a edição de transação), aparece
  também **uma categoria nova sugerida**, com aparência distinta: "＋ Saúde (nova)".
- **De onde vem a sugestão [escolha do design]:** um catálogo de categorias comuns com palavras
  que as identificam no nome do estabelecimento ou na descrição. Exemplos: Saúde (farmácia,
  drogaria, Drogasil, Raia, Pague Menos, clínica, laboratório); Transporte (Uber, 99, posto,
  combustível, estacionamento, pedágio); Pets (Petz, Cobasi, pet shop, veterinário); Assinaturas
  (Netflix, Spotify, Prime, Disney+, iCloud); Educação (escola, curso, faculdade, livraria); Casa
  (Leroy Merlin, Telhanorte, material de construção). Vale a mesma normalização de
  `normalizeMerchant`. O catálogo vive no domínio (`modules/categories`), como dado, para crescer.
- A sugestão só aparece quando o usuário **não tem** uma categoria com aquele nome (ou o singular
  ou plural dele) e quando o estabelecimento ainda não tem regra (`merchant_rules`).
- **Um toque** em "＋ Saúde (nova)" cria a categoria, classifica a transação e grava a regra do
  estabelecimento, numa unidade de trabalho. As próximas compras ali já entram em Saúde, como hoje
  acontece com categorias que existem.
- **Criar na hora:** no fim de "Outra…", um campo com o nome de uma categoria nova e o botão
  **Criar**, que cria e já classifica.
- No Telegram, a categoria nova sugerida aparece como mais um botão ("＋ Saúde"), com o mesmo
  efeito. **[escolha do design]**

### 5.2 A tela de Categorias

Aprovado no esboço `categorias-tela.html`. Os blocos grandes de hoje (`category-card.tsx`) saem.

- **Mês no topo** (padrão: o atual; trocar o mês compara com o anterior). Total gasto no mês e a
  variação contra o mês anterior.
- **Barra empilhada** com a fatia de cada categoria no total do mês.
- **Sugestões** (caixa no topo, cada uma com um botão de ação):
  - criar uma categoria que falta, com as compras sem categoria que entrariam nela (§5.1);
  - arquivar uma categoria sem uso há 60 dias ou mais;
  - juntar duas categorias que parecem a mesma (nomes iguais depois da normalização, ou um contido
    no outro, como "Mercado" e "Supermercado"). Juntar move transações, orçamentos, regras de
    estabelecimento e recorrências para a que fica, e arquiva a outra. **[escolha do design]**
    Juntar pede confirmação dizendo quantas transações mudam, já que não tem volta simples.
- **Lista em linhas**, ordenada pelo gasto no mês. Cada linha mostra cor, nome, quantas compras,
  gasto no mês, fatia do total, variação contra o mês anterior (subiu em vermelho, desceu em verde)
  e, se houver, quanto do orçamento já foi.
- **Clicar numa linha** abre o detalhe dela ali mesmo: onde mais gastou (estabelecimentos), os
  últimos 6 meses (minigráfico) e o atalho para as transações daquela categoria (a lista de
  Transações filtrada).
- **Menu "⋯"** em cada linha: renomear, cor, arquivar, excluir. As arquivadas ficam recolhidas no
  fim.
- **[escolha do design]** Categorias que só recebem entradas (como "Salário") ficam num grupo
  "Entradas" abaixo da lista de gastos, com os mesmos números do lado das entradas.

**Pronto quando:** a compra da farmácia mostra "＋ Saúde (nova)" e um toque resolve; a tela de
Categorias responde, sem rolar, quais categorias mais gastaram no mês e o que subiu ou desceu.

---

## 6. Parte 3 — Contas, Orçamentos e Empréstimos numa página

### 6.1 Estrutura (layout B, escolhido pelo usuário)

Aprovado no esboço `pagina-unica.html`.

- **Topo, sempre visível:**
  - um resumo em poucos números: em conta corrente, nos cartões, nas reservas e parcelas do mês;
  - a **lista de contas** em linhas compactas, agrupadas em contas correntes, cartões e reservas,
    cada uma com o valor. Nos cartões, o fechamento e o vencimento da fatura.
- **Embaixo, três abas:** Orçamentos, Empréstimos e Simulador.
- A página se chama **Meu Dinheiro** (decisão do usuário, §10.1).
- O usuário pediu um resultado visualmente caprichado ("dá para fazer algo bem estilizado"): o
  esboço é a estrutura, não o visual final.

### 6.2 Contas

- **Clicar numa conta** abre o detalhe dela: saldo (ou fatura aberta e fechada, nos cartões), as
  últimas transações, o atalho para a lista de Transações filtrada por ela e as ações que existem
  hoje (editar, arquivar, excluir, pagar fatura).
- Criar conta continua a um botão ("＋ Conta").
- Contas arquivadas e ocultas ficam recolhidas no fim da lista.

### 6.3 Orçamentos que avisam

**O que o usuário pediu:** avisos por etapa, em **75%, 90%, 95% e 100%** do limite e **quando
passar dele**, e um aviso de **ritmo** quando o gasto corre mais rápido que o mês (o exemplo dele:
metade do orçamento em 10 dias).

- **Ritmo:** a conta já existe (`calculateBudgetPace`: `spentShare` contra `elapsedShare`, status
  `ahead` acima de 10 pontos de diferença). O aviso de ritmo diz quando, mantido o ritmo, o limite
  estoura ("Mercado: metade do orçamento em 10 dias. No ritmo de hoje, passa do limite dia 26.
  Hora de segurar um pouco.").
- **[escolha do design] Uma vez por etapa:** cada etapa avisa uma única vez por período do
  orçamento, e o aviso de ritmo também. Uma compra que pula várias etapas de uma vez (de 70% para
  100%) avisa só a mais alta. Depois de passar do limite, cada compra nova naquela categoria diz
  quanto já passou. Isso exige guardar quais etapas já avisaram em cada período.
- **[escolha do design] Quando o ritmo avisa:** uma vez por período, quando metade do limite foi
  gasta antes da metade do período (o exemplo do usuário). Os avisos de etapa (75% em diante)
  trazem junto a linha do ritmo quando o gasto está à frente do calendário.
- **[escolha do design] Por onde:** pelo Telegram, junto da compra que cruzou a etapa, valendo
  para compras de qualquer origem: atalho do iPhone, texto no chat ou registradas no app. Uma
  compra registrada no app manda uma mensagem própria no Telegram. Sem chat conectado, o aviso
  aparece só no app.
- **Dois tipos (decisão do usuário, §10.1):** mensal, que recomeça todo mês, e por prazo, de uma
  data a outra. Ao criar, o usuário escolhe o tipo; o mensal é o padrão **[escolha do design]**.
  Mudar o limite de um mensal vale do mês corrente em diante, sem reescrever meses passados
  **[escolha do design]**.
- **No app:** cada orçamento na aba Orçamentos mostra a barra, quanto já foi do limite, a etapa
  atual, o ritmo e a data em que estoura, com a cor mudando conforme aperta.
- **Investigar primeiro (pedido do usuário):** por que o aviso de hoje "não funciona". Fatos já
  vistos:
  - o aviso atual só existe na mensagem do Telegram da própria compra, a partir de 80%
    (`budgetAlert` em `modules/capture/domain/spending-lines.ts`), e só para compras que passam
    pelo Telegram;
  - um orçamento hoje tem início e fim fixos (`Budget.periodStart`/`periodEnd`) e não se renova:
    um orçamento de outubro deixa de valer em novembro (ver §10, pergunta 1);
  - quem constrói deve conferir os orçamentos reais do usuário no banco (só leitura) antes de
    concluir.

### 6.4 Aba Empréstimos

- Cada empréstimo mostra a taxa, a parcela, quanto já pagou, quanto falta, quantas parcelas
  restam e o custo total (juros e taxas).
- **Amortizar um empréstimo contratado:** valor, data e o que reduzir (prazo ou parcela). O Hermes
  registra o pagamento extra e recalcula as parcelas futuras. É o caso real de dezembro, com o 13º
  e o 14º.
- **[escolha do design]** Na aba Orçamentos, as parcelas do mês aparecem como um compromisso fixo
  acima dos orçamentos ("Parcelas de novembro: R$ 1.500"), para responder "quanto pesa no mês".

---

## 7. Parte 4 — Simulador e amortização

Aprovado no esboço `simulador.html`, com os acréscimos do usuário (entradas previstas e
amortizar).

- **Ofertas lado a lado** para o mesmo valor (ex.: R$ 25.000). Para cada banco, o usuário digita
  **o que o banco informou**: valor, número de parcelas e parcela. O Hermes calcula o total pago, o
  custo (total pago menos o valor) e a taxa efetiva mensal implícita. Para um "e se fosse em 16
  meses?", o usuário pode informar só a taxa, e o Hermes calcula a parcela pela tabela Price
  (`calculatePriceInstallments`, que já existe).
- **Impostos e taxas:** vêm embutidos no que o banco informou. O Hermes **não** calcula IOF por
  conta própria (antiobjetivo §2).
- **"Vou dar conta?":** para cada oferta, quanto sobra por mês depois da parcela e quantos meses
  ficam apertados, e um gráfico dos próximos meses com a oferta escolhida.
  - **[escolha do design]** O que sobra no mês = entradas previstas (recorrentes e avulsas) −
    contas fixas (recorrências de despesa) − parcelas já assumidas − o gasto médio dos últimos 3
    meses fora de parcelas e recorrências − a parcela simulada.
- **Entradas avulsas previstas:** o usuário adiciona um valor numa data ("13º, R$ X, 20/12"; "14º,
  R$ Y, 20/12"). Elas entram na projeção do simulador. **[escolha do design]** Elas valem só no
  simulador: não mexem no "Livre" do Início nem em saldos. Para uma entrada contar no resto do
  app, ela é registrada como transação agendada, como hoje.
- **Amortizar na simulação:** valor e data (ex.: o 13º inteiro em dezembro), e os dois caminhos
  dos bancos lado a lado: **reduzir o prazo** (termina em tal mês, economiza tanto de juros) ou
  **reduzir a parcela** (cai para tanto). Vale para cada oferta, então a comparação mostra, por
  exemplo, se a de 16 meses amortizada sai mais barata que a de 12.
- **"Contratar esta":** cadastra o empréstimo de verdade (`CreateLoanUseCase`, com a taxa efetiva
  calculada a partir do que o banco informou), com as parcelas nos meses certos. Elas aparecem em
  "Parcelas do mês", no "Livre" do Início e na aba Orçamentos. Uma amortização planejada na
  simulação **[escolha do design]** não é registrada sozinha: ela é registrada quando acontecer,
  pelo "Amortizar" da aba Empréstimos (§6.4).
- **[escolha do design]** As ofertas e as entradas previstas do simulador ficam guardadas até o
  usuário removê-las, para comparar com calma ao longo de dias.

**Pronto quando:** o caso da moto pode ser refeito no simulador: três ofertas, o 13º e o 14º em
dezembro, a amortização com os dois caminhos e "Contratar esta" levando as parcelas para o mês.

---

## 8. Navegação

- A sidebar passa a ter **um item** no lugar de Contas, Orçamentos e Empréstimos.
- As rotas antigas (`/accounts`, `/budgets`, `/loans`) levam à página nova, já na aba
  correspondente, para links salvos e atalhos continuarem funcionando. **[escolha do design]** A
  página nova fica em `/accounts`, com a aba na URL (`?aba=orcamentos`, `?aba=emprestimos`,
  `?aba=simulador`), para o voltar do navegador e os links levarem à aba certa.
- O item se chama **Meu Dinheiro** (decisão do usuário, §10.1).

---

## 9. Ordem das partes

Decisão do usuário, nesta ordem, cada uma entregável sozinha:

1. Sidebar (§4).
2. Categorias (§5).
3. Página única com orçamentos que avisam (§6), começando pela investigação do aviso de hoje.
4. Simulador e amortização (§7).
5. Esqueceu sua senha (§9.1), pedido do usuário em 26/10/2026.

### 9.1 Parte 5 — Esqueceu sua senha

Hoje uma pessoa que esquece a senha não tem como voltar a entrar: aconteceu com uma conta de teste
em 26/10/2026, e a senha teve de ser trocada direto no banco.

O que já existe: o link "Esqueceu a senha?" no login, a página `/forgot-password` que pede o e-mail,
`requestPasswordResetAction` e o envio do e-mail (`sendResetPassword` em `infra/auth/server.ts`,
modelo em `infra/email/templates.ts`).

O que falta:

- **A página de nova senha.** O link do e-mail volta para `/login` (`redirectTo` em
  `better-auth-provider.adapter.ts`), e nenhuma página lê o `token` nem chama
  `auth.api.resetPassword`. Falta `/reset-password?token=…` com "Nova senha" e "Confirmar", e o
  aviso de link vencido ou já usado, com um atalho para pedir outro.
- **E-mail de verdade.** Sem `RESEND_API_KEY` o e-mail só aparece no log do servidor. Antes da
  entrega, configurar o Resend com um domínio verificado (o `onboarding@resend.dev` só entrega para
  o dono da conta do Resend).
- **Depois de trocar:** encerrar as outras sessões da conta (`revokeSessionsOnPasswordReset`) e
  entrar direto, ou levar ao login com o aviso "Senha alterada".
- **Verificação de e-mail.** Está desligada desde 26/10/2026 (`REQUIRE_EMAIL_VERIFICATION`, padrão
  `false`), porque sem e-mail de verdade ninguém conseguia concluir o cadastro. Religar junto com o
  Resend.

---

## 10. Perguntas ao usuário

1. **Orçamentos que se renovam todo mês?** Hoje um orçamento vale de uma data a outra e acaba. A
   proposta "Orçamentos de outubro" e os avisos "por período" pressupõem orçamentos mensais que se
   renovam sozinhos. A resposta muda o modelo de dados dos orçamentos.
2. **Nome do item na sidebar** que junta Contas, Orçamentos e Empréstimos.

### 10.1 Respostas (20/10/2026)

1. **Os dois tipos de orçamento:** o **mensal**, que recomeça sozinho todo mês com o mesmo limite,
   e o **por prazo**, que vale de uma data a outra e acaba (o que existe hoje). Os orçamentos que
   já existem continuam como "por prazo". Num mensal, "período" nos avisos (§6.3) é o mês
   corrente: as etapas voltam a valer no primeiro dia de cada mês.
2. **Nome do item na sidebar: "Meu Dinheiro"**, que é também o título da página.

---

## 11. Deixado para quem constrói

- Modelo de dados das etapas já avisadas, das ofertas e das entradas previstas do simulador.
- O cálculo da taxa efetiva a partir da parcela (método numérico) e do recálculo de parcelas na
  amortização, com testes de tabela.
- Como a compra registrada no app dispara o aviso no Telegram (o mesmo caminho do `after()` usado
  nas capturas é um bom ponto de partida).
- O desenho visual final das três partes, seguindo `docs/ui-ux.md` e os esboços como estrutura.
- A forma do minigráfico de 6 meses e do gráfico de projeção.
