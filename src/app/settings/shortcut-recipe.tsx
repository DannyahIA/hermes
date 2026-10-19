import { CopyField } from './copy-field';

const FIELDS: Array<[string, string]> = [
  ['amount', 'Entrada do atalho › Valor'],
  ['merchant', 'Entrada do atalho › Comerciante'],
  ['card', 'Entrada do atalho › Cartão ou Passe'],
  ['occurredAt', 'Data atual, no formato ISO 8601'],
];

/**
 * How to set up the iPhone automation (spec 2026-10-17-telegram-apple-pay-
 * design.md §7), with this Hermes' address filled in. The labels follow
 * iOS 17 and 18 and may differ a little in other versions.
 */
export function ShortcutRecipe({ captureUrl }: { captureUrl: string }) {
  return (
    <details className="group border-border rounded-[var(--radius)] border">
      <summary className="hover:bg-accent/60 focus-visible:ring-ring cursor-pointer list-none rounded-[var(--radius)] px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
        <span className="text-muted-foreground mr-2 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Como configurar o atalho no iPhone
      </summary>
      <ol className="border-border space-y-4 border-t px-4 py-4 text-sm [counter-reset:step]">
        <Step>
          Em <strong>Atalhos › Automação</strong>, toque em{' '}
          <strong>Nova automação</strong> e escolha <strong>Transação</strong>.
        </Step>
        <Step>
          Em <strong>Cartões</strong>, marque os cartões que você usa, de débito
          e de crédito. Deixe <strong>Categorias</strong> e{' '}
          <strong>Estabelecimentos</strong> em “Qualquer” e escolha{' '}
          <strong>Executar imediatamente</strong>.
        </Step>
        <Step>
          <p>
            Adicione a ação <strong>Obter conteúdo do URL</strong>, com método{' '}
            <strong>POST</strong>, neste endereço:
          </p>
          <CopyField
            className="mt-2"
            label="Endereço da captura"
            value={captureUrl}
          />
          <p className="mt-3">
            Em <strong>Cabeçalhos</strong>, adicione{' '}
            <code className="dimension-figure">Authorization</code> com o valor
            mostrado quando você gera o token (
            <code className="dimension-figure">Bearer hm_…</code>).
          </p>
          <p className="mt-3">
            Em <strong>Corpo da requisição</strong>, escolha{' '}
            <strong>JSON</strong> e adicione:
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {FIELDS.map(([field, source]) => (
              <div key={field} className="contents">
                <dt className="dimension-figure">{field}</dt>
                <dd className="text-muted-foreground">{source}</dd>
              </div>
            ))}
          </dl>
        </Step>
        <Step>
          Recomendado: adicione <strong>Se</strong> o conteúdo do URL{' '}
          <strong>não contém</strong>{' '}
          <code className="dimension-figure">ok</code>,{' '}
          <strong>Mostrar notificação</strong> “Hermes não recebeu esta compra”.
          Assim, se o Hermes estiver fora do ar, você fica sabendo na hora.
        </Step>
      </ol>
      <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
        Débito ou crédito não se configura no atalho: o Hermes sabe pelo nome do
        cartão, que você associa a uma conta abaixo depois da primeira compra.
      </p>
    </details>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="before:border-border relative pl-8 [counter-increment:step] before:absolute before:top-0 before:left-0 before:flex before:size-5 before:items-center before:justify-center before:rounded-full before:border before:font-mono before:text-xs before:content-[counter(step)]">
      {children}
    </li>
  );
}
