# Hermes - Software Architecture

> Documento responsável por definir a arquitetura do Hermes.
>
> Este documento estabelece as regras de organização do código, fluxo de dependências e princípios arquiteturais que devem ser seguidos durante todo o desenvolvimento do projeto.

---

# Objetivo

O Hermes foi projetado para ser um sistema de longa duração.

A arquitetura deve permitir:

- evolução contínua;
- facilidade de manutenção;
- baixo acomplamento;
- alta coesão;
- substituição de tecnologias sem impacto nas regras de negócio;
- facilidade para testes automatizados.

---

# Arquitetura

O Hermes utiliza um **Monólito Modular (Modular Monolith)**.

Frontend e Backend compartilham o mesmo projeto Next.js.

A lógica de negócio permanece independente da interface, do banco de dados e de bibliotecas externas.

```
Browser
    │
    ▼
Next.js App Router
    │
    ▼
Server Actions / Route Handlers
    │
    ▼
Application Services
    │
    ▼
Repositories (Interfaces)
    │
    ▼
Infrastructure (Adapters)
    │
    ▼
Database
```

---

# Princípios

## Dependency Rule

As dependências sempre apontam para dentro.

```
app
    ↓

modules
    ↓

core
```

Nunca o contrário.

## Infrastructure is Replaceable

Toda tecnologia externa deve ser encapsulada.

Exemplos:

- PostgreSQL
- Drizzle
- Prisma
- Clerk
- Better Auth
- Resend
- Stripe

Nunca devem ser acessados diretamente pelos módulos.

Sempre através de adapters.

---

## Framework Independent

A regra de negócio nunca deve depender do Next.js.

Caso o frontend seja substituído futuramente, a lógica permanece válida.

---

## Domain First

Toda funcionalidade começa no domínio.

Nunca começamos implementando banco de dados ou interface.

---

## Single Source of Truth

Cada informação possuí apenas uma origem.

Exemplo:

O saldo de uma conta é consequência das transações.

Nunca é editado manualmente.

---

# Estrutura do Projeto

```
src/

  app/
  config/
  core/
  infra/
  modules/
  shared/
  styles/
```

---

# app

Responsável apenas pela exposição da aplicação.

Contém:

- rotas
- layouts
- páginas
- server actions
- route handlers

Não deve conter regra de negócio.

---

# core

Contém o domínio do sistema.

Exemplos:

- Entities
- Value Objects
- Domain Errors
- Repository Contracts

O core nunca depende de nenhuma biblioteca externa.

---

# modules

Cada funcionalidade é isolada em seu próprio módulo.

Exemplo:

```
expenses/

application/
components/
repositories/
schemas/
services/
types/
```

Os módulos não devem acessar diretamente outros módulos.

Caso exista compartilhamento, ele deve ocorrer através do `shared`.

---

# infra

Responsável pela comunicação com recursos externos.

Exemplos:

- banco de dados
- autenticação
- cache
- filas
- envio de e-mails
- APIs externas

Toda integração deve possuir um adapter.

---

# shared

Componentes reutilizáveis.

Exemplos:

- Button
- Card
- Modal
- Toast
- Hooks
- Helpers
- Utils
- Types

Nenhuma regra de negócio deve existir aqui.

---

# config

Configurações centralizadas.

Exemplos:

- env
- rotas
- constantes
- navegação
- feature flags

---

# styles

Estilos globais.

Não deve conter componentes.

---

# Fluxo de Dependências

```
app

↓

modules

↓

core

↓

interfaces

↓

infra

↓

database
```

As dependências nunca devem subir novamente.

---

# Adapters

Toda biblioteca externa deve possuir uma camada intermediária.

Exemplo:

```
ExpenseRepository

↓

DrizzleExpenseRepository

↓

Drizzle ORM
```

Caso o ORM seja substituído, apenas o adapter muda.

---

# Camadas

```
Presentation

↓

Application

↓

Domain

↓

Infrastructure
```

## Presentation

Interface.

## Application

Casos de uso.

Coordena operações.

## Domain

Regras de negócio.

## Infrastructure

Persistência e integrações.

---

# Comunicação entre camadas

```
Page

↓

Server Action

↓

Service

↓

Repository Interface

↓

Repository Adapter

↓

Database
```

Nenhuma camada pode ignorar outra.

---

# Responsabilidades

## Page

Renderizar interface.

---

## Server Action

Receber dados.

Validar entrada.

Executar um caso de uso.

Retornar resultado.

---

## Service

Implementar regra de negócio.

---

## Repository

Persistir ou recuperar dados.

---

## Adapter

Traduzir a interface para uma tecnlologia específica.

---

# Dependências Permitidas

```
Page
    ↓
Service
    ↓
Repository
    ↓
Adapter
    ↓
Library
```

---

# Dependências Proibidas

nunca:

```
Page

↓

Prisma
```

Nunca:

```
Page

↓

Database
```

Nunca:

```
Component

↓

Repository
```

Nunca:

```
Entity

↓

Next.js
```

---

# Objetivo Final

O Hermes deve permitir que qualquer tecnologia possa ser substituída sem alterar o domínio do sistema.

A arquitetura sempre prioriza:

- simplicidade;
- legibilidade;
- baixo acoplamento;
- alta coesão;
- manutenção de longo prazo.
