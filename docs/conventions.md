# Hermes - Coding Conventions

> Este documento define os padrões de desenvolvimento do projeto Hermes.
>
> Todas as contribuições devem seguir estas convenções.

---

# Filosofia

O código deve ser:

- simples;
- legível;
- previsível;
- testável;
- consistente.

Sempre priorizamos clareza em vez de "código inteligente".

---

# Clean Code

Todo código deve seguir os princípios do Clean Code.

- funções pequenas;
- nomes descritivos;
- responsabilidade única;
- baixo acoplamento;
- alta coesão.

---

# SOLID

Sempre que aplicável:

- Single Responsibility
- Open/Closed
- Liskov Substitution
- Interface Segregation
- Dependency Inversion

---

# Estrutura de Pastas

Cada módulo possui sua própria organização.

Exemplo:

modules/

expenses/

application/
components/
repositories/
schemas/
types/

---

# Organização dos Arquivos

Um arquivo deve possuir apenas uma responsabilidade.

Evitar arquivos com centenas de linhas.

---

# Nome de Arquivos

Componentes:

Button.tsx

ExpenseCard.tsx

DashboardLayout.tsx

---

Use Cases:

create-expense.use-case.ts

delete-expense.use-case.ts

transfer-money.use-case.ts

---

Repositories:

expense.repository.ts

user.repository.ts

---

Adapters:

drizzle-expense.repository.ts

clerk-auth.adapter.ts

---

Schemas:

expense.schema.ts

login.schema.ts

---

Hooks:

use-expenses.ts

use-sidebar.ts

---

Utils:

format-currency.ts

format-date.ts

slugify.ts

---

# Componentes

Componentes devem ser pequenos.

Evitar componentes acima de 200 linhas.

Caso cresçam demais, dividir em componentes menores.

---

# Props

Sempre utilizar interfaces.

Exemplo:

interface ButtonProps

Nunca utilizar any.

---

# Tipagem

Utilizar TypeScript estrito.

É proibido:

- any
- unknown sem tratamento
- as desnecessário

---

# Validação

Toda entrada deve ser validada utilizando Zod.

Nunca confiar em dados vindos do cliente.

---

# Server Actions

Server Actions possuem apenas três responsabilidades:

- validar entrada;
- executar um caso de uso;
- retornar resultado.

Nunca colocar regra de negócio diretamente nelas.

---

# Use Cases

Cada arquivo representa uma única ação.

Exemplos:

CreateExpense

DeleteExpense

UpdateExpense

TransferMoney

Nunca criar classes gigantes responsáveis por dezenas de operações.

---

# Repository

Repositories representam contratos.

Nunca conhecem banco de dados.

---

# Adapter

Adapters implementam repositories.

Toda tecnologia externa deve estar encapsulada.

---

# Componentes Compartilhados

Componentes reutilizáveis pertencem ao shared.

Exemplos:

Button

Input

Modal

Card

Table

Toast

---

# Imports

Sempre utilizar aliases.

Exemplo:

@/shared

@/modules

@/infra

Nunca utilizar caminhos relativos longos.

Errado:

../../../../shared/utils

---

# Comentários

Comentários explicam "por quê".

Nunca explicar "o quê".

Código bem escrito já explica o que está fazendo.

---

# Nomenclatura

Classes:

PascalCase

Interfaces:

PascalCase

Componentes:

PascalCase

Hooks:

camelCase iniciando com use

Arquivos:

kebab-case

Constantes globais:

UPPER_SNAKE_CASE

Variáveis:

camelCase

---

# Funções

Preferir funções puras.

Evitar efeitos colaterais.

---

# Estado

O estado deve permanecer o mais próximo possível de quem o utiliza.

Evitar estados globais desnecessários.

---

# Erros

Nunca lançar strings.

Sempre utilizar objetos Error.

Quando necessário, criar erros específicos do domínio.

---

# Performance

Evitar otimizações prematuras.

Primeiro escrever código simples.

Depois medir.

Depois otimizar.

---

# Dependências

Antes de instalar uma nova biblioteca, responder:

- Ela resolve um problema real?
- O Next.js já possui solução?
- O React já possui solução?
- Conseguimos implementar internamente?

Menos dependências significam menor custo de manutenção.

---

# Testes

Todo caso de uso deve ser testável de forma isolada.

O domínio nunca deve depender de banco de dados.

---

# Objetivo Final

Qualquer desenvolvedor deve conseguir abrir o projeto e entender uma funcionalidade em poucos minutos.

A consistência é mais importante do que preferências individuais.
