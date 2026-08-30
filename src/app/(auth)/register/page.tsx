import Link from 'next/link';

import { isGithubAuthConfigured, isGoogleAuthConfigured } from '@/config/env';
import { ROUTES } from '@/config/routes';

import { AuthCard } from '../auth-card';
import { SocialSignInButtons } from '../social-sign-in-buttons';
import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <AuthCard
      code="F.02"
      eyebrow="Hermes · Cadastro"
      title="Crie sua conta"
      description="Comece a organizar suas finanças com o Hermes."
    >
      <SocialSignInButtons
        google={isGoogleAuthConfigured()}
        github={isGithubAuthConfigured()}
      />

      <RegisterForm />

      <div className="mt-6 text-center text-sm">
        Já tem uma conta?{' '}
        <Link
          href={ROUTES.login}
          className="text-foreground font-medium hover:underline"
        >
          Entrar
        </Link>
      </div>
    </AuthCard>
  );
}
