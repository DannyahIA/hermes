import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const metrics = [
  {
    label: 'Patrimônio',
    value: 'R$ 42.580,00',
    trend: '+8.4% vs mês anterior',
  },
  { label: 'Receitas', value: 'R$ 9.240,00', trend: '+12% este mês' },
  { label: 'Despesas', value: 'R$ 4.860,00', trend: '-3.1% vs meta' },
  { label: 'Fluxo de caixa', value: 'R$ 4.380,00', trend: 'Positivo' },
];

const transactions = [
  {
    title: 'Salário',
    category: 'Income',
    amount: '+ R$ 3.200,00',
    time: 'Hoje · 09:30',
  },
  {
    title: 'Supermercado',
    category: 'Essentials',
    amount: '- R$ 184,50',
    time: 'Hoje · 19:15',
  },
  {
    title: 'Streaming',
    category: 'Leisure',
    amount: '- R$ 39,90',
    time: 'Ontem · 20:00',
  },
  {
    title: 'Transferência',
    category: 'Savings',
    amount: '- R$ 500,00',
    time: 'Ontem · 10:40',
  },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.label}
              className="border-border/70 bg-card/80 p-5"
            >
              <p className="text-muted-foreground text-sm">{metric.label}</p>
              <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
              <p className="mt-2 text-sm text-emerald-600">{metric.trend}</p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Fluxo de caixa</CardTitle>
              <CardDescription>
                Comparativo mensal de entradas e saídas.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6 p-0">
              <div className="bg-muted/50 flex h-56 items-end gap-3 rounded-3xl p-4">
                {[38, 54, 46, 68, 72, 81].map((height, index) => (
                  <div
                    key={index}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className="from-primary w-full rounded-t-2xl bg-gradient-to-t to-sky-400"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-muted-foreground text-xs">
                      {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][index]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Desempenho</CardTitle>
              <CardDescription>
                Meta mensal versus consumo atual.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6 space-y-4 p-0">
              {[
                { label: 'Essenciais', value: '78%', color: 'bg-primary' },
                { label: 'Lazer', value: '44%', color: 'bg-emerald-500' },
                {
                  label: 'Investimentos',
                  value: '61%',
                  color: 'bg-violet-500',
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.value}</span>
                  </div>
                  <div className="bg-muted h-2 rounded-full">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: item.value }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Últimas transações</CardTitle>
              <CardDescription>
                Movimentações recentes da sua conta principal.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-3 p-0">
              {transactions.map((transaction) => (
                <div
                  key={transaction.title}
                  className="bg-muted/50 flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{transaction.title}</p>
                    <p className="text-muted-foreground">
                      {transaction.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{transaction.amount}</p>
                    <p className="text-muted-foreground">{transaction.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Resumo rápido</CardTitle>
              <CardDescription>
                Próximos passos para manter a saúde financeira.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-3 p-0">
              {[
                'Revisar orçamento',
                'Transferir para reserva',
                'Confirmar contas',
              ].map((item) => (
                <div
                  key={item}
                  className="bg-muted/50 rounded-2xl px-4 py-3 text-sm"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
