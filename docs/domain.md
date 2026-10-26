# Hermes - Domain Model

> Documento responsável por definir o dominio do Hermes.
>
> Este documento descreve apenas as regras de negócio.
> Nenhuma tecnologia (Next.js, React, PostgresSQL, Drizzle, Prisma, etc.) deve ser considerada aqui.

---

# Objetivo

O Hermes é uma plataforma para gerenciamento financeiro pessoal.

O foco do sistema não é apenas registrar receitas e despesas, mas fornecer uma visão completa do patrimônio financeiro do usuário.

---

# Objetivos do Produto

O sistema deverá permitir:

- gerenciamento de contas financeiras;
- gerenciamento de cartões de crédito;
- registro de receitas;
- registro de despesas;
- transferências entre contas;
- controle de orçamento;
- gerenciamento de categorias;
- geração de relatórios;
- visualização da evolução patrimonial.

---

# Linguagem Ubíqua

Os seguintes termos devem ser utilizados em todo o projeto.

| Termo       | Descrição                          |
| ----------- | ---------------------------------- |
| User        | Proprietário dos dados financeiros |
| Account     | Conta financeira                   |
| Transaction | Movimento financeiro               |
| Income      | Receita                            |
| Expense     | Despesa                            |
| Transfer    | Transferência entre contas         |
| Category    | Categoria de uma transação         |
| Budget      | Limite financeiro                  |
| Report      | Relatório financeiro               |

---

# Entidades Principais

## User

Representa o proprietário das informações financeiras.

Responsabilidades:

- possuir contas
- possuir categorias
- possuir orçamentos
- possuir configurações

---

## Account

Representa um local onde existe dinheiro.

Exemplos:

- Conta Corrente
- Conta Poupança
- Carteira
- Dinheiro
- Banco Digital

Uma conta possui:

- saldo
- nome
- instituição
- moeda
- status

---

## Transaction

Representa qualquer movimentação financeira.

Tipos:

- Income
- Expense
- Transfer

Toda transação possuí:

- valor
- data
- conta
- categoria
- descrição

A data é um instante. Lançada só com o dia, ela fica no começo daquele dia no horário local, e o
horário não aparece; lançada agora (registro rápido, captura do Apple Pay), guarda a hora. Editar
outra coisa numa transação não muda a hora dela; trocar o dia a põe no começo do dia novo.

---

## Category

Representa uma classificação financeira.

Exemplos:

- Alimentação
- Transporte
- Moradia
- Saúde
- Investimentos

Categorias pertencem ao usuário.

---

## Budget

Representa um limite financeiro.

Pode existir para:

- categoria
- mês
- ano

---

## Report

Representa uma consolidação de informações financeiras.

Não é persistido.

É gerado dinamicamente.

---

# Regras de Negócio

## Conta

- Uma conta nunca pode possuir saldo inválido.
- Uma conta pode ser arquivada.
- Uma conta pode ser ocultada.

---

## Receita

- Sempre aumenta o saldo.

---

## Despesa

- Sempre reduz o saldo.

---

## Transferência

- Nunca altera o patrimônio.
- Apenas move saldo entre contas.

---

## Cartão de crédito

- O saldo de um cartão é o que se deve: uma despesa no cartão aumenta a dívida.
- Uma compra no cartão é despesa no momento da compra.
- Pagar a fatura não é despesa nem receita: move dinheiro da conta de pagamento e reduz a dívida
  do cartão na mesma medida. Nunca altera o patrimônio e nunca entra nos totais de gastos, que já
  contaram as compras.

---

## Categoria

- Uma categoria pode ser arquivada.
- Uma categoria pode possuir cor.
- Uma categoria pode possuir ícone.
- Transferências e pagamentos de fatura não têm categoria.
- Ao classificar uma transação, o Hermes lembra a categoria escolhida para o estabelecimento
  (regra de estabelecimento). Grafias diferentes do mesmo lugar ("PADARIA REAL LTDA \*123",
  "Padaria Real") contam como um só. A regra serve de primeira sugestão nas próximas compras ali;
  escolher outra categoria a substitui.

---

## Orçamento

- Um orçamento vale para dias inteiros: do começo do primeiro dia ao fim do último.
- O ritmo compara o quanto já foi gasto com o quanto do período já passou. Até 10 pontos acima
  do calendário ainda conta como "no ritmo"; acima do limite, o orçamento está estourado.
- Um orçamento é mensal (recomeça todo mês, o padrão) ou por prazo (vale de uma data a outra).
- Mudar o limite de um orçamento mensal vale do mês corrente em diante; os meses anteriores
  ficam como eram.
- O Hermes avisa quando o gasto chega a 75%, 90%, 95% e 100% do limite, e a cada compra acima
  do limite, dizendo quanto passou. Exatamente no limite é "No limite"; só acima dele é
  "Passou do limite".
- Cada etapa (75, 90, 95, 100) avisa uma vez por período. Se o gasto voltar a ficar abaixo dela
  (uma compra desfeita, um limite maior), a etapa é re-armada e avisa de novo ao chegar lá.
- O aviso de ritmo aparece quando metade do limite foi gasta antes da metade do período, e
  também vale uma vez por período, re-armado se o gasto cair abaixo de metade do limite.
- Os avisos chegam pelo Telegram, quando há um chat ligado; sem chat, aparecem só no app.
- Editar uma transação só avisa quando o valor aumenta ou a categoria ou a data mudam; corrigir
  a descrição, por exemplo, não repete o aviso.

---

## Registro rápido

- Uma linha escrita como numa mensagem vira uma receita ou despesa: "almoço 32,50 crédito",
  "+3000 salário", "mercado 250,40 ontem". O mesmo leitor serve ao Início e, depois, ao Telegram.
- O valor é o número escrito como dinheiro (com centavos, "R$" ou sinal); sem nenhum assim, o
  último número, e a tela avisa que havia outro. "+" ou "recebi" fazem uma receita; sem sinal,
  vale o que o estabelecimento costuma ser, ou despesa.
- A conta vem do nome ou de parte dele ("itaú") e do tipo ("crédito", "cartão", "débito", "pix",
  "dinheiro", "poupança"). Sem isso, a conta que o estabelecimento costuma usar, ou a mais usada
  para receitas ou para despesas.
- A data aceita "hoje", "ontem", "anteontem", "amanhã", "12/10", "12/10/25" e "dia 12". Sem data,
  ou com a de hoje, vale o momento do registro.
- A categoria só é preenchida quando já se sabe: a regra do estabelecimento, o histórico dele ou
  uma categoria com o nome da descrição. Um estabelecimento novo entra sem categoria e aparece em
  "Para revisar". Escolher a categoria no registro ensina a regra, como em "Para revisar".
- Um estabelecimento já visto é escrito como da última vez ("padaria real" vira "Padaria Real").

---

## Extrato (Transações)

- O extrato mostra o que já aconteceu, até o fim de hoje, do mais novo para o mais antigo. O que
  tem data depois de hoje (parcelas futuras, sobretudo) fica à parte, em "Agendadas", do mais
  próximo para o mais distante.
- As transações se agrupam por dia, por mês ou por categoria, à escolha da pessoa, que fica
  guardada. O total de cada grupo é o que entrou menos o que saiu em todo o grupo dentro dos
  filtros, mesmo quando a lista ainda não carregou todas as linhas dele. Transferências e
  pagamentos de fatura não entram nos totais.
- A busca encontra a descrição sem diferenciar maiúsculas nem acentos ("cafe" encontra "Café").
- Os filtros (busca, período, conta, categoria e tipo) ficam no endereço da página, e a
  exportação em CSV leva os mesmos filtros.
- "Este mês" vai do dia 1 ao último dia do mês, então o que está agendado no resto do mês aparece
  em "Agendadas"; "7 dias" são os sete dias até hoje, contando hoje.

## Captura do Apple Pay

- Um atalho do iPhone manda cada pagamento por aproximação ao Hermes (valor, estabelecimento,
  cartão e hora), autenticado por um token pessoal. O Hermes guarda só o hash do token, que só
  registra compras e não lê nada; a resposta nunca traz saldo nem conta.
- Cada pagamento vira uma despesa na conta do cartão usado, com a hora do toque e a origem
  "Apple Pay". O cartão é reconhecido pelo nome na Wallet, sem diferenciar maiúsculas nem acentos,
  e associado a uma conta uma vez, em Configurações; um cartão novo fica esperando essa escolha, e
  as compras dele são registradas quando ela é feita.
- O estabelecimento é lido como no registro rápido: um já conhecido entra na categoria lembrada,
  com o nome escolhido; um novo entra sem categoria e aparece em "Para revisar". Sem
  estabelecimento, a descrição é "Compra no <cartão>".
- O mesmo pagamento mandado de novo (mesmo cartão, valor e minuto) não é registrado duas vezes.
  Um pagamento sem valor espera que o valor seja informado; ele pode ser descartado.

---

# Patrimônio

O patrimônio é calculado pela soma dos saldos das contas, com o saldo dos cartões de crédito
(dívida) entrando subtraindo.

Não deve ser armazenado no banco.

Sempre deve ser calculado.

---

# Fora do Escopo

Nesta primeira versão não existirão:

- investimentos
- criptomoedas
- múltiplas moedas
- sincronização bancária
- compartilhamento entre usuários

Esses recursos poderão ser adicionados posteriormente.

---

# Princípios

Todo código desenvolvido deverá responder às regras deste documento.

Esse documento possuí prioridade sobre decisões de implementação.

---

# Casos de Uso

Os casos de uso representam as ações que um usuário pode executar.

Cada caso de uso possui uma única responsabilidade.

Exemplos:

- CreateAccount
- UpdateAccount
- ArchiveAccount

- CreateTransaction
- UpdateTransaction
- DeleteTransaction

- CreateBudget
- UpdateBudget

Os casos de uso pertencem à camada de Application e utilizam o domínio para executar as regras de negócio.

---

# Invariantes

As seguintes regras nunca podem ser violadas:

- Toda transação pertence exatamente a uma conta.
- Uma transferência sempre possui uma conta de origem e uma conta de destino.
- O valor de uma transação deve ser maior que zero.
- O patrimônio é sempre calculado a partir das contas.
- Uma categoria arquivada não pode receber novas transações.

---

# Aggregate Roots

Os principais agregados do sistema são:

- User
- Account
- Transaction
- Budget

Toda modificação nesses objetos deve ocorrer através de seus respectivos casos de uso.
