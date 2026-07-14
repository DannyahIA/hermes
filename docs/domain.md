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

## Categoria

- Uma categoria pode ser arquivada.
- Uma categoria pode possuir cor.
- Uma categoria pode possuir ícone.

---

# Patrimônio

O patrimônio é calculado pela soma dos saldos das contas.

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
