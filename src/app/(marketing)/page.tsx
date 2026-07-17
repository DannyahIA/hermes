import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.16),_transparent_35%),linear-gradient(135deg,#0f172a_0%,#111827_100%)] px-6 py-20 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <section className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/10 p-10 backdrop-blur-xl">
          <div className="max-w-2xl space-y-4">
            <p className="text-sm tracking-[0.3em] text-slate-300 uppercase">
              Hermes Finance
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              A premium command center for your finances.
            </h1>
            <p className="text-lg text-slate-300">
              Track accounts, budgets, transactions and growth with clarity and
              elegance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create account</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-white/10 bg-slate-950/40 text-white">
            <CardHeader>
              <CardTitle>Instant visibility</CardTitle>
              <CardDescription className="text-slate-400">
                Know where your money moves in seconds.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-white/10 bg-slate-950/40 text-white">
            <CardHeader>
              <CardTitle>Budget discipline</CardTitle>
              <CardDescription className="text-slate-400">
                Create category-based budgets and stay aligned.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-white/10 bg-slate-950/40 text-white">
            <CardHeader>
              <CardTitle>Secure access</CardTitle>
              <CardDescription className="text-slate-400">
                Login, logout and password recovery are built in.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </div>
  );
}
