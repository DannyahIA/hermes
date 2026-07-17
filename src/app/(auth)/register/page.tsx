import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_45%),linear-gradient(135deg,#020617_0%,#111827_100%)] px-6 py-16">
      <Card className="w-full max-w-md border-white/10 bg-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            Create your account
          </CardTitle>
          <CardDescription className="text-slate-300">
            Start managing your finances with Hermes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-200" htmlFor="name">
                Full name
              </label>
              <Input
                id="name"
                placeholder="Alex Morgan"
                className="border-white/10 bg-slate-950/40 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="border-white/10 bg-slate-950/40 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="border-white/10 bg-slate-950/40 text-white"
              />
            </div>
            <Button className="w-full">Create account</Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-300">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-white hover:text-slate-200"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
