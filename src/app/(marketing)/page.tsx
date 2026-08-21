import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { APP_DESCRIPTION, APP_NAME } from '@/config/constants';
import { ROUTES } from '@/config/routes';

const LEDGER_SAMPLE = [
  {
    description: 'Salário',
    amount: 'R$ 6.200,00',
    tone: 'success' as const,
    sign: '+',
  },
  {
    description: 'Aluguel',
    amount: 'R$ 1.800,00',
    tone: 'error' as const,
    sign: '−',
  },
  {
    description: 'Mercado',
    amount: 'R$ 412,30',
    tone: 'error' as const,
    sign: '−',
  },
  {
    description: 'Transferência · Reserva',
    amount: 'R$ 500,00',
    tone: 'neutral' as const,
    sign: '⇄',
  },
];

const FEATURES = [
  {
    title: 'Visibilidade instantânea',
    description: 'Saiba para onde seu dinheiro vai em segundos, sem planilhas.',
  },
  {
    title: 'Disciplina de orçamento',
    description:
      'Crie orçamentos por categoria e veja o consumo em tempo real.',
  },
  {
    title: 'Acesso seguro',
    description:
      'Login por e-mail, Google ou GitHub — sua conta protegida do início.',
  },
];

export default function MarketingPage() {
  return (
    <div className="bg-background min-h-screen px-6 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-primary text-sm tracking-[0.3em] uppercase">
              {APP_NAME}
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Suas finanças, escrituradas com precisão.
            </h1>
            <p className="text-muted-foreground max-w-lg text-lg">
              {APP_DESCRIPTION}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link href={ROUTES.register}>Criar conta</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={ROUTES.login}>Entrar</Link>
              </Button>
            </div>
          </div>

          {/* The thesis, made visible: every entry black or red ink, tabular
              figures — this is the product's whole idea in one glance. */}
          <Card className="ledger-spine p-6">
            <p className="font-display text-muted-foreground mb-2 text-sm italic">
              Hoje · Conta corrente
            </p>
            <div>
              {LEDGER_SAMPLE.map((row) => (
                <div key={row.description} className="ledger-row">
                  <span className="text-sm">{row.description}</span>
                  <span
                    className={`ledger-figure text-sm font-semibold ${
                      row.tone === 'success'
                        ? 'text-success'
                        : row.tone === 'error'
                          ? 'text-destructive'
                          : 'text-foreground'
                    }`}
                  >
                    {row.sign} {row.amount}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section>
          <div>
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="border-border grid gap-1 border-t py-6 first:border-t-0 sm:grid-cols-[1fr_2fr] sm:items-baseline sm:gap-8"
              >
                <h2 className="font-display text-lg font-semibold">
                  {feature.title}
                </h2>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
