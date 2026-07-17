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

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.14),_transparent_45%),linear-gradient(135deg,#020617_0%,#111827_100%)] px-6 py-16">
      <Card className="w-full max-w-md border-white/10 bg-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            Reset your password
          </CardTitle>
          <CardDescription className="text-slate-300">
            Enter your email and we&apos;ll help you recover access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
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
            <Button className="w-full">Send reset link</Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-300">
            <Link href="/login" className="hover:text-white">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
