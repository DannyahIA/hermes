import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.16),_transparent_45%),linear-gradient(135deg,#020617_0%,#111827_100%)] px-6 py-16">
      <Card className="w-full max-w-md border-white/10 bg-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            Verify your email
          </CardTitle>
          <CardDescription className="text-slate-300">
            A verification email has been sent to your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300">
            Check your inbox and confirm the link to activate your account.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button className="w-full">Resend email</Button>
            <Link
              href="/login"
              className="text-center text-sm text-slate-300 hover:text-white"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
