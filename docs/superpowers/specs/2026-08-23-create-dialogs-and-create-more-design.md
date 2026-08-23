# Hermes — Criação sob demanda + "Criar mais"

> Spec arquitetural. Primeiro de quatro sub-projetos de uma revisão geral do app pedida pelo
> usuário (2026-08-23), focada em profissionalismo, responsividade (desktop + mobile) e
> usabilidade. Os outros três — auditoria de responsividade, polimento geral de usabilidade, e
> qualquer item que sobrar deles — ficam para sub-projetos seguintes, cada um com seu próprio
> ciclo spec → plano → implementação.

## Problema

Toda página de listagem (Categorias, Contas, Orçamentos, Empréstimos, Transações) renderiza seu
formulário de criação como um card permanentemente visível na página, disputando espaço com o
conteúdo real — e piorando ainda mais no mobile, onde o formulário inteiro fica entre o título e a
lista. Ao mesmo tempo, a edição já faz isso corretamente: `AccountEditDialog`,
`TransactionEditDialog`, `RecurringTransactionFormDialog` e `ImportDialog` já abrem sob demanda via
`Dialog`/`DialogForm`. O padrão certo existe no código — só não foi aplicado à criação, que é o
caso de uso mais comum.

Separadamente, nenhum formulário de criação suporta lançar vários registros em sequência sem
retrabalho. Pior: hoje o comportamento é o oposto do desejável — o React 19 reseta automaticamente
todo campo não controlado após um submit bem-sucedido de uma form action, então até os selects de
conta/categoria voltam ao topo da lista a cada transação lançada.

## Escopo

Todos os seis fluxos de criação: Categoria, Conta, Orçamento, Empréstimo, Transação, Transferência
— mais o já-existente dialog de Recorrência, que ganha o "Criar mais" por consistência
(`docs/ui-ux.md`: "elementos iguais devem sempre possuir o mesmo comportamento").

Fora de escopo nesta rodada: auditoria de responsividade ponto-a-ponto (rodada seguinte),
`ImportDialog` (já é um fluxo de importação em lote, não um "criar um registro" — "criar mais" não
se aplica), e qualquer página ainda não revisada (`reports`, `settings`, `dashboard`).

## `CreateDialogForm`

Novo componente em `src/components/ui/create-dialog-form.tsx`, compondo o `DialogForm` existente
sem alterá-lo — dialogs de edição continuam exatamente como estão, zero risco de regressão.

```ts
interface CreateDialogFormProps<State extends { success: boolean }> {
  trigger: (open: () => void) => React.ReactNode; // render-prop: o chamador decide o botão, CreateDialogForm dá o `open`
  title: string;
  description?: string;
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  repeatLabel: string; // ex: "Criar mais uma conta"
  children: (args: {
    state: State;
    formAction: (formData: FormData) => void;
    repeating: boolean; // true = "Criar mais" está marcado
  }) => React.ReactNode;
}
```

Comportamento:

- Controla `open` internamente (mesmo padrão do `RecurringTransactionFormDialog` hoje: um
  `useState`); `trigger` é uma render-prop que recebe a função `open` para o chamador conectar ao
  seu próprio botão — o quick-add global do header, por exemplo, passa o botão que já existe hoje
  no `AppShellChrome`.
- Renderiza o checkbox "Criar mais" (rótulo customizável via `repeatLabel`) — cada formulário
  decide, através do texto, o que faz sentido para aquela entidade.
- Ao suceder (`state.success`): se o checkbox **não** está marcado, fecha o dialog — comportamento
  idêntico ao `DialogForm` hoje. Se está marcado, o dialog permanece aberto; o `CreateDialogForm`
  não decide sozinho o que limpar nos campos — isso é responsabilidade de cada formulário-filho,
  que já observa `state` via `useEffect` (mesmo padrão do `CategoryForm` com `successCountRef`, ou
  do `TransactionForm` com campos controlados) e decide, campo a campo, o que manter e o que
  limpar, conforme a tabela da seção seguinte.
- Foco: cada formulário-filho, no mesmo `useEffect` de sucesso, dá foco ao primeiro campo que
  normalmente seria preenchido em seguida (ex.: "Descrição" numa transação) quando `repeating` é
  `true` — replica a digitação rápida em sequência do Linear.
- O checkbox sempre começa desmarcado quando o dialog abre (decisão do usuário: sem persistência
  entre sessões/aberturas).

**Reuso do gatilho em dois lugares.** Em vez de compartilhar estado `open` entre o cabeçalho da
página e o CTA do estado vazio — que vivem em partes diferentes da árvore, com a página sendo
Server Component — cada "Criar X" vira um client component autocontido (ex:
`CreateCategoryDialog`, envolvendo `CreateDialogForm` com o formulário e os textos já resolvidos).
Ele é renderizado uma vez no cabeçalho da página e, quando a lista está vazia, mais uma vez como a
`action` do `EmptyState` — duas instâncias independentes do mesmo componente, sem necessidade de
estado compartilhado entre elas.

## Quick-add global de transação

O botão "Nova transação", hoje fixo no cabeçalho do `AppShellChrome` como um `<Link>` para
`/transactions`, passa a abrir o `CreateDialogForm` de transação diretamente — de qualquer página
do app, igual ao quick-add do Linear.

Isso exige que o `AppShellChrome` tenha `accounts`/`categories` disponíveis. `AppShell` (Server
Component, o único ponto por onde toda página autenticada já passa) passa a buscar as duas listas
e repassá-las como props. Para não duplicar a query nas páginas que já buscam a mesma coisa (ex.
`transactions/page.tsx`), as funções de busca são envolvidas em `cache()` do React — mesma técnica
já usada em `src/infra/auth/session.ts` — garantindo que, dentro de uma mesma request, `AppShell` e
a página filha compartilhem o resultado.

## O que cada formulário mantém no "Criar mais"

| Formulário    | Mantém                                                  | Limpa                                             |
| ------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Categoria     | — (cada categoria é única)                              | nome, descrição, cor                              |
| Conta         | tipo                                                    | nome, saldo inicial, dia de fechamento/vencimento |
| Orçamento     | período (início/fim)                                    | categoria, valor                                  |
| Empréstimo    | contas de recebimento/pagamento                         | descrição, valor, taxa, parcelas, data            |
| Transação     | tipo, conta, categoria, data                            | descrição, valor, parcelamento                    |
| Transferência | contas (de/para)                                        | valor, descrição                                  |
| Recorrência   | conta, categoria, tipo, regra de repetição, data início | descrição, valor                                  |

Tecnicamente, "manter" um campo entre envios exige que ele seja controlado (senão o reset
automático do React 19 o zera junto com os demais) — o `TransactionForm` já faz isso hoje para
`amount`; os campos da coluna "Mantém" de cada formulário passam a seguir o mesmo padrão.

## Layout das páginas após a remoção dos cards fixos

- **Categorias**: o card "Resumo" (hoje dividindo a linha com o formulário, `xl:grid-cols-[0.9fr_1.1fr]`)
  passa a ser um card único, largura cheia, no topo — mesmo padrão que "Patrimônio total" já usa em
  Contas. `CreateCategoryDialog` é renderizado no cabeçalho da seção (ao lado do título) e como
  `action` do `EmptyState`.
- **Contas**: a página ganha um cabeçalho de seção (título + descrição) que hoje não existe,
  consistente com as demais páginas, com `CreateAccountDialog` à direita. A coluna lateral
  `lg:grid-cols-[1fr_360px]` só existia para o formulário — é removida; a lista de contas passa a
  ocupar a largura cheia, com "Patrimônio total" no topo.
- **Orçamentos / Empréstimos**: o formulário era uma seção inteira antes da lista — é removida; a
  lista sobe para logo abaixo do título, com o dialog de criação no cabeçalho e no `EmptyState`.
- **Transações**: a coluna lateral (`lg:grid-cols-[1fr_360px]`) mantém apenas o card
  "Recorrências" (lista de regras existentes + o dialog, que já existia — só ganha "Criar mais").
  Os cards "Nova transação" e "Transferência" saem da coluna: a criação de transação passa a ser
  via quick-add global do header; "Transferência" ganha seu próprio botão/dialog na barra de
  filtros/ações do topo da página, ao lado de "Exportar" e "Importar".

## Testes

Os `use-case`s de aplicação (`create-account.use-case.ts` etc.) não mudam — este trabalho é
inteiramente de apresentação. A cobertura nova é de componente: um teste por formulário
confirmando que, com "Criar mais" marcado, o dialog permanece aberto após um submit bem-sucedido e
os campos da coluna "Mantém" preservam o valor anterior enquanto os da coluna "Limpa" voltam ao
estado inicial; e um teste do `CreateDialogForm` confirmando que, sem "Criar mais" marcado, o
comportamento de fechar ao suceder continua idêntico ao `DialogForm` puro.
