import Link from 'next/link';

import { isGithubAuthConfigured, isGoogleAuthConfigured } from '@/config/env';
import { ROUTES } from '@/config/routes';

import { AuthCard } from '../auth-card';
import { SocialSignInButtons } from '../social-sign-in-buttons';
import { LoginForm } from './login-form';

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <AuthCard
      title="Bem-vindo(a) de volta"
      description="Entre para acessar sua central financeira."
    >
      <SocialSignInButtons
        google={isGoogleAuthConfigured()}
        github={isGithubAuthConfigured()}
        redirectTo={redirectTo}
      />

      <LoginForm redirectTo={redirectTo ?? ROUTES.dashboard} />

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link
          href={ROUTES.forgotPassword}
          className="text-muted-foreground hover:text-foreground"
        >
          Esqueceu a senha?
        </Link>
        <Link
          href={ROUTES.register}
          className="text-muted-foreground hover:text-foreground"
        >
          Criar conta
        </Link>
      </div>
    </AuthCard>
  );
}
