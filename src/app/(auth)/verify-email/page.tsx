import Link from 'next/link';

import { ROUTES } from '@/config/routes';
import { getCurrentSession } from '@/infra/auth/session';

import { AuthCard } from '../auth-card';
import { ResendVerificationButton } from './resend-verification-button';

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const [session, { email: emailFromQuery }] = await Promise.all([
    getCurrentSession(),
    searchParams,
  ]);

  // There's no session yet right after sign-up (verification is required
  // before sign-in) or when redirected here from a blocked login attempt —
  // the email arrives via the query string in both of those cases instead.
  const email = session?.user.email ?? emailFromQuery;

  return (
    <AuthCard
      code="F.04"
      eyebrow="Hermes · Verificação"
      title="Confirme seu e-mail"
      description="Enviamos um link de verificação para o seu e-mail."
    >
      <p className="text-muted-foreground text-sm">
        Acesse sua caixa de entrada e confirme o link para ativar sua conta.
        Você precisa confirmar o e-mail antes de conseguir entrar.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {email && <ResendVerificationButton email={email} />}
        <Link
          href={ROUTES.login}
          className="text-muted-foreground hover:text-foreground text-center text-sm"
        >
          Voltar para o login
        </Link>
      </div>
    </AuthCard>
  );
}
