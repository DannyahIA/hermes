# Hermes — Rodada 1: Fundação da experiência de listagem de transações

> Spec arquitetural. Primeira de três rodadas planejadas para evoluir a UX/performance do app
> (ver contexto completo no pedido original do usuário, 2026-08-20). Esta rodada cobre os itens
> #1 (responsividade tablet/desktop), #2 (bug de componentes travados), #3 (paginação real +
> virtualização), #4 (skeletons), #5 (agrupamento temporal) e #7 (filtros por período) do pedido.
> As rodadas 2 (correção de dados/lógica financeira) e 3 (analytics/polimento) têm specs próprias,
> escritas depois que esta for implementada e revisada.

## Objetivo

A tela de transações — e o padrão de diálogo com formulário que ela usa — é o ponto de maior
atrito hoje: um bug de interação torna botões aparentemente "mortos" após o primeiro uso, a lista
inteira é carregada de uma vez (sem paginação real), não há hierarquia visual em telas maiores, e
não há feedback de carregamento além de estados binários (carregando/carregado). Esta rodada
resolve essas cinco questões como uma unidade, porque compartilham a mesma superfície de código
(`Dialog`, listagem de transações, filtros).

## Diagnóstico: causa raiz do bug de interação

Confirmado por inspeção de código em três arquivos (`recurring-transaction-form-dialog.tsx`,
`transaction-edit-dialog.tsx`, `import-dialog.tsx`): todos declaram `useState` (para `open`) e
`useActionState` (para o resultado do Server Action) no **componente pai**, que é montado uma
única vez pela página e nunca desmonta. O `Dialog` (`components/ui/dialog.tsx`) só renderiza seus
`children` condicionalmente (`{open && children}`) — mas como `useActionState` vive _fora_ dessa
fronteira, seu estado sobrevive ao fechamento do diálogo.

O fechamento após sucesso é feito como um side-effect em tempo de render:

```tsx
if (state.success && open) setOpen(false);
```

Na primeira submissão isso funciona. Mas `state.success` permanece `true` para sempre depois
disso (nada o reseta). Na segunda vez que o usuário abre o mesmo diálogo, `open` volta a `true` e
`state.success` ainda é `true` da vez anterior — a mesma linha dispara de novo, fechando o
diálogo imediatamente, antes de qualquer interação. É isso que o usuário percebe como "o botão
parou de funcionar".

Não é um bug isolado por tela — é o padrão de composição (`useActionState` acima da fronteira de
`Dialog`) que está errado, e vai se repetir em qualquer novo diálogo com formulário escrito do
mesmo jeito.

## Componentes

### 1. `DialogForm` — primitivo reutilizável (`components/ui/dialog-form.tsx`)

Um wrapper que resolve o problema estruturalmente, não em cada chamador:

```tsx
interface DialogFormProps<State> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  children: (args: { state: State; formAction: (formData: FormData) => void }) => React.ReactNode;
  onSuccess?: () => void; // chamado além do fechamento automático, se precisar de mais (ex: toast)
}

export function DialogForm<State extends { success: boolean }>({
  open, onOpenChange, action, initialState, children, onSuccess,
}: DialogFormProps<State>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogFormInner
          action={action}
          initialState={initialState}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        >
          {children}
        </DialogFormInner>
      )}
    </Dialog>
  );
}

function DialogFormInner<State extends { success: boolean }>({ action, initialState, onClose, onSuccess, children }: ...) {
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      onClose();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a transições de sucesso
  }, [state.success]);

  return children({ state, formAction });
}
```

O ponto-chave: `DialogFormInner` só existe enquanto `open` é `true` — o `<Dialog>` já teria feito
esse unmount de qualquer forma (`{open && children}`), então mover `useActionState` para dentro
dessa fronteira faz seu estado nascer e morrer a cada abertura, sem precisar de nenhum reset
manual. E o fechamento vira um `useEffect` (roda depois do commit), não mais um side-effect em
tempo de render.

Os 3 diálogos afetados (`recurring-transaction-form-dialog.tsx`, `transaction-edit-dialog.tsx`,
`import-dialog.tsx`) migram para esse wrapper. Qualquer diálogo com formulário futuro (Rodadas 2
e 3 vão criar vários) usa `DialogForm` desde o início — nunca mais reimplementa esse padrão à mão.

**Teste de regressão obrigatório**: para cada diálogo migrado, um teste (ou passo manual de QA,
documentado no plano de implementação) que abre → submete com sucesso → fecha → abre de novo →
confirma que o formulário aparece limpo e funcional, repetindo esse ciclo 3x. Esse é exatamente o
fluxo que estava quebrado.

### 2. Paginação cursor-based no backend

`TransactionFilters` ganha `cursor?: { occurredAt: Date; id: string }` e mantém `limit` (renomeado
de `pageSize` só nesse novo caminho — `page`/`pageSize` antigos continuam existindo para não
quebrar nada que ainda os use, mas a listagem principal migra para cursor).

Chave de ordenação: `(occurredAt DESC, id DESC)` — usar só `occurredAt` não é suficiente porque
timestamps podem empatar (várias transações no mesmo dia); `id` como desempate garante uma ordem
total estável. Índice composto novo:

```sql
CREATE INDEX transactions_user_cursor_idx
  ON transactions (user_id, occurred_at DESC, id DESC);
```

`DrizzleTransactionRepository.findByUserId` ganha a cláusula `WHERE (occurred_at, id) < (:cursorOccurredAt, :cursorId)`
quando um cursor é passado (keyset pagination — evita o `OFFSET` crescente de paginação por
página, que fica lento conforme a tabela cresce).

Nova rota: `GET /api/transactions?limit=50&cursor=<base64>&accountId=...&categoryId=...&type=...&from=...&to=...`
(mesmos filtros que já existem hoje, incluindo os da Rodada anterior). Resposta:

```json
{ "transactions": [...], "nextCursor": "eyJvY2N1cnJlZEF0Ijoi..." }
```

`nextCursor` é `null` quando não há mais páginas. O cursor é opaco ao cliente (só um blob
base64) — o formato interno pode mudar sem quebrar contrato.

A página `/transactions` (Server Component) continua fazendo a primeira busca (SSR, 50 itens) —
só as buscas incrementais subsequentes vão para essa rota via `fetch` no cliente.

### 3. Lista infinita + virtualização no frontend

Hook `useInfiniteTransactions(initialTransactions, initialCursor, filters)`:

- Mantém o array de transações carregadas em estado.
- Um elemento sentinela no fim da lista observado via `IntersectionObserver`; ao entrar na
  viewport, dispara `fetch` da próxima página com o cursor atual e concatena o resultado.
- Debounce/guarda contra disparos duplicados (`isFetching` flag) — essencial porque
  `IntersectionObserver` pode disparar múltiplas vezes durante um scroll rápido.

Renderização via `@tanstack/react-virtual` (`useVirtualizer`): só os itens perto da viewport viram
nós DOM reais; o espaço dos demais é reservado via `transform: translateY()` num contêiner de
altura total calculada. Cada grupo temporal (ver item 5) tem sua própria altura estimada
(cabeçalho + N linhas) — a virtualização precisa saber a altura de cada tipo de item (header de
grupo vs. linha de transação), o que a biblioteca já suporta via `measureElement`.

**Mobile**: a lista empilhada (`TransactionRowMobile`) continua exatamente com a aparência atual —
a virtualização é uma otimização por baixo do DOM, não uma mudança de layout. Confirmar
visualmente (screenshot antes/depois) que nada mudou no viewport 375×812 além de performance.

### 4. Responsividade tablet/desktop

Revisão pontual (não reescrita) das grids em `/transactions`, `/dashboard`, `/accounts`,
`/budgets`, `/loans`, `/reports`, usando os breakpoints já disponíveis no Tailwind config
(`sm`/`md`/`lg`/`xl`) — hoje a maioria das telas só tem uma virada `xl:grid-cols-[1fr_360px]`
(ex: `/transactions`), pulando direto de "empilhado" para "duas colunas fixas", sem aproveitar o
intervalo `md`–`xl` (tablets e desktops menores). Ajustes concretos:

- `/transactions`: filtros em linha a partir de `md` (hoje empilham até `xl`); a tabela desktop já
  existe, então o ganho principal é no formulário lateral, que pode virar 2 colunas internas a
  partir de `lg` em vez de continuar de largura fixa 360px em qualquer tela grande.
- `/dashboard`: cards de resumo em grid de 2 colunas a partir de `md`, 4 a partir de `xl` (hoje
  provavelmente pula de 1 para um número fixo).
- `/accounts`, `/budgets`, `/loans`: grids de cards que hoje são 1 coluna até um breakpoint único
  ganham um estágio intermediário em `md` (2 colunas) antes do estágio final em `xl`.

**Regra dura**: nenhuma classe `sm:` ou implícita (mobile-first, sem prefixo) é alterada nesta
rodada. Toda mudança entra como `md:`/`lg:`/`xl:` adicional. Verificação: diff visual (Playwright,
viewport 375×812) do "antes" e "depois" de cada tela tocada deve dar zero diferença.

### 5. Skeletons

Um skeleton por tipo de conteúdo, no formato aproximado do real (evita layout shift):

- `transaction-row-skeleton.tsx` (desktop e mobile) — mesma estrutura de `.ledger-row`, blocos
  `animate-pulse` no lugar de texto.
- `card-skeleton.tsx` genérico, parametrizado por número de linhas — usado em cards de resumo do
  dashboard e de contas.
- `table-skeleton.tsx` — cabeçalho real + N linhas de skeleton.

Uso:

- `loading.tsx` do App Router em `/transactions`, `/dashboard`, `/accounts`, `/budgets`, `/loans`
  (Next.js já suporta isso nativamente para Server Components — cobre o carregamento inicial da
  navegação).
- Estado `isFetching` do `useInfiniteTransactions` renderiza 3-5 `transaction-row-skeleton`
  no fim da lista atual durante o carregamento incremental (visualmente diferente de um carregamento
  inicial — a lista já existente não some, só cresce).
- Mutations (criar/editar/excluir transação): o botão de submit já usa `useFormStatus` para
  desabilitar+trocar texto (`"Salvando…"`) — esse padrão já existe e é mantido, só confirmado como
  consistente em todos os formulários migrados para `DialogForm`.

### 6. Agrupamento temporal

Função pura `groupTransactionsByPeriod(transactions: Transaction[], today: Date): TransactionGroup[]`
em `shared/lib/`, testável sem repositório (mesmo padrão de `core/value-objects/recurrence.ts`).
Regras de granularidade:

- Hoje / Ontem — rótulo explícito.
- Últimos 7 dias (exclusive de hoje/ontem) — nome do dia da semana por extenso ("Segunda-feira").
- Resto do mês corrente — "Esta semana" agrupamentos por semana não são necessários aqui; um
  cabeçalho único "Este mês" é suficiente até o fim do mês corrente.
- Meses anteriores — "Agosto de 2026", mais antigo primeiro dentro da lista carregada.

Os cabeçalhos de grupo são inseridos como itens sintéticos na lista virtualizada (não uma lista
separada) para que o `IntersectionObserver`/scroll continue funcionando com um único contêiner.

### 7. Filtros por período

`TransactionsFilters` (já tem `from`/`to` desde a rodada anterior, mas sem atalhos) ganha botões
de atalho: Hoje, Esta semana, Este mês, Personalizado (abre os inputs de data já existentes).
Chips abaixo do formulário de filtro mostram cada filtro ativo (`Conta: Nubank ×`,
`Categoria: Alimentação ×`, `01/06/2026 – 30/06/2026 ×`) — clicar no `×` remove só aquele filtro e
recarrega a query string, sem precisar abrir o formulário de novo.

## Fora de escopo desta rodada

- Preferências de visualização persistidas (lista/blocos/agrupado) — Rodada 2 (depende de nova
  tabela e é um requisito maior, reutilizável por outras telas).
- Qualquer correção de lógica de saldo/projeção — Rodada 2.
- Importação com preview/mapeamento de colunas — Rodada 2 (o `import-dialog.tsx` atual só migra
  para `DialogForm` nesta rodada, sem mudar seu fluxo interno).
- Dashboard interativo, relatórios, empty states, microcopy — Rodada 3.

## Verificação

- Testes unitários: `groupTransactionsByPeriod` (todas as granularidades, incluindo virada de
  mês/ano), keyset pagination do repositório (cursor avança corretamente, não repete nem pula
  itens em presença de timestamps duplicados).
- Teste de regressão do bug: ciclo abrir→submeter→fechar→abrir 3x para cada diálogo migrado.
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `vitest run` — todos verdes.
- QA visual (Playwright): screenshots mobile (375×812) idênticos ao estado atual; screenshots
  tablet (768px) e desktop (1440px) mostrando os novos breakpoints em uso.
- Manual: rolar uma lista com >100 transações de teste, confirmar que a paginação incremental
  dispara corretamente e que o DOM não cresce sem limite (inspecionar contagem de nós renderizados).
