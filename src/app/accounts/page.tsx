import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const accounts = [
  {
    name: 'Conta Principal',
    type: 'Checking',
    balance: 'R$ 12.450,00',
    currency: 'BRL',
  },
  {
    name: 'Reserva de Emergência',
    type: 'Savings',
    balance: 'R$ 8.300,00',
    currency: 'BRL',
  },
  {
    name: 'Cartão Premium',
    type: 'Credit',
    balance: 'R$ -1.280,00',
    currency: 'BRL',
  },
];

export default function AccountsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gerencie seus saldos, tipos e movimentações.
            </p>
          </div>
          <Button>Nova conta</Button>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Saldo consolidado</CardTitle>
              <CardDescription>
                Visão geral do patrimônio em contas.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              <div className="bg-primary/10 rounded-3xl p-5">
                <p className="text-muted-foreground text-sm">
                  Patrimônio total
                </p>
                <p className="mt-2 text-3xl font-semibold">R$ 19.470,00</p>
                <p className="mt-2 text-sm text-emerald-600">
                  +5.2% em relação ao mês passado
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Criar / editar conta</CardTitle>
              <CardDescription>
                Defina nome, tipo, moeda e saldo inicial.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-4 p-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm">Nome</label>
                  <Input placeholder="Conta principal" />
                </div>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm">Tipo</label>
                  <Input placeholder="Checking" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm">Moeda</label>
                  <Input placeholder="BRL" />
                </div>
                <div className="space-y-2">
                  <label className="text-muted-foreground text-sm">Saldo</label>
                  <Input placeholder="0,00" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1">Salvar conta</Button>
                <Button variant="outline" className="flex-1">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {accounts.map((account) => (
            <Card
              key={account.name}
              className="border-border/70 bg-card/80 p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold">{account.name}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {account.type} · {account.currency}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-muted-foreground text-sm">Saldo</p>
                    <p className="text-xl font-semibold">{account.balance}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm">
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
