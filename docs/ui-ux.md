# Hermes - UI/UX Guidelines

> Este documento define os princípios de Interface (UI) e Experiência do Usuário (UX) do Hermes.
>
> Todas as telas, componentes e fluxos devem seguir estas diretrizes

---

# Filosofia

O Hermes é um sistema financeiro.

A interface deve transmitir:

- confiança;
- clareza;
- velocidade;
- organização;
- previsibilidade.

O usuário deve gastar seu tempo entendendo suas finanças, nunca tentando entender a interface.

---

# Princípios

## Simplicidade

A interface deve conter apenas elementos necessários.

Evitar:

- excesso de cores;
- excesso de botões;
- excesso de informação;
- excesso de animações.

Sempre perguntar:

> Este elemento realmente ajuda o usuário?

---

## Consistência

Elementos iguais devem sempre possuir o mesmo comportamento.

Exemplo:

Um botão primário deve parecer igual em qualquer tela.

Um modal deve abrir sempre da mesma forma.

Um formulário deve seguir sempre o mesmo padrão.

Nunca criar exceções visuais.

---

## Feedback

Toda ação do usuário deve produzir um retorno.

Exemplos:

- loading;
- sucesso;
- erro;
- confirmação;
- progresso.

Nunca deixar o usuário sem resposta.

---

## Hierarquia Visual

O usuário deve identificar rapidamente:

- o que é importante;
- o que é secundário;
- o que é clicável;
- o que é apenas informativo.

A interface deve guiar naturalmente a leitura.

---

## Espaçamento

Utilizar espaçamentos consistentes.

Preferencialmente seguir a escala de 4px.

Exemplo:

4
8
12
16
24
32
48
64

Nunca utilizar valores aleatórios.

---

# Tipografia

A tipografia deve possuir poucos níveis.

Exemplo:

Display

Heading

Title

Body

Caption

Evitar muitas variações.

---

## Cores

As cores possuem significado.

Exexmplo:

Primary

Neutral

Success

Warning

Error

Info

Nunca utlizar cor apenas por estética.

Toda cor deve comunicar alguma informação.

---

# Design Tokens

Toda estilização deve utilizar tokens.

Exemplos:

colors.primary

spacing.md

radius.lg

shadow.sm

font.body

Nunca utilizar valores "hardcoded" diretamente nos componentes.

---

# Componentes

Todos os componentes devem ser reutilizáveis.

Exemplos:

Button

Input

Select

Checkbox

Radio

Switch

Card

Dialog

Toast

Badge

Tooltip

Dropdown

Table

Sidebar

Breadcrumb

Pagination

---

# Estados

Todo componente deve possuir estados bem definidos.

Exemplo:

Button

- default
- hover
- active
- loading
- disabled
- focus

Input

- empty
- filled
- focus
- error
- disabled

---

# Ícones

Todos os ícones devem utilizar Lucide.

Nunca misturar bibliotecas.

---

# Formulários

Todo formulário deve:

- indicar campos obrigatórios;
- validar imediatamente quanto apropriado;
- apresentar mensagens claras;
- preservar dados em caso de erro;

Nunca limpar o formulário após uma validação inválida.

---

# Tabelas

Tabelas devem permitir:

- ordenação;
- filtros;
- paginação;
- busca.

Sempre que fizer sentido.

---

# Responsividade

O Hermes deve ser Mobile First.

Breakpoints sugeridos:

Mobile

Tablet

Notebook

Desktop

Ultrawide

Nenhuma funcionalidade deve existir apenas no Desktop.

---

# Sidebar

A navegação principal ocorre pela Sidebar.

Ela deve:

- permanecer consistente;
- destacar a rota atual;
- permitir recolhimento;
- funcionar em dispositivos móveis.

---

# Dashboard

O Dashboard deve responder rapidamente às seguintes perguntas:

Quanto tenho?

Quanto gastei?

Quanto recebi?

Estou dentro do orçamento?

Como evoluiram minhas finanças?

Toda informação secundária deve ficar abaixo dessas respostas.

---

# Estados Vazios

Sempre apresentar uma ação.

Exemplo:

"Nenhuma despesa cadastrada."

↓

"Cadastrar primeira despesa"

Nunca deixar páginas vazias.

---

# Loading

Toda operação assíncrona deve possuir loading.

Priorizar:

Skeleton

Ao invés de:

Spinner

Sempre que possível.

---

# Mensagens de Erro

Nunca utilizar mensagens técnicas.

Errado:

500 Internal Server Error

Correto:

Não foi possível salvar esta despesa.

Tente novamente.

---

# Confirmações

Operações destrutivas sempre exigem confirmação.

Exemplo:

Excluir conta

Excluir categoria

Excluir orçamento

Nunca solicitar confirmação para ações reversíveis.

---

# Acessibilidade

Todos os componentes devem seguir boas práticas de acessibilidade.

Incluindo:

- navegação por teclado;
- foco visível;
- contraste adequado;
- labels;
- aria-label quando necessário.

---

# Animações

As animações devem ser discretas.

Objetivos:

- indicar mudança;
- orientar navegação;
- melhorar percepção.

Nunca utilizar animações apenas por estética.

---

# Performance Percebida

O usuário deve sentir que o sistema responde rapidamente.

Priorizar:

Skeleton

Otimistic UI

Lazy Loading

Streaming

Server Components

---

# Dark Mode

O Hermes deve oferecer suporte completo ao modo claro e escuro.

Todos os componentes devem ser desenvolvidos considerando ambos os temas desde o início.

---

# Design System

Todo componente utilizado pela aplicação deve fazer parte do Design System.

Nunca criar componentes específicos sem avaliar se podem ser reutilizados.

---

# Princípio Final

Antes de implementar qualquer tela, responder:

- Esta interface é simples?
- Está consistente com o restante do sistema?
- Existe feedback para todas as ações?
- Um usuário novo conseguiria utilizá-la sem instruções?
- O componente pode ser reutilizado?

Se alguma resposta for "não", a implementação deve ser revisada.
