import Link from 'next/link';

import { ROUTES } from '@/config/routes';

import { AuthCard } from '../auth-card';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      code="F.03"
      eyebrow="Hermes · Recuperação"
      title="Recuperar senha"
      description="Informe seu e-mail e enviaremos um link de recuperação."
    >
      <ForgotPasswordForm />

      <div className="mt-6 text-center text-sm">
        <Link
          href={ROUTES.login}
          className="text-muted-foreground hover:text-foreground"
        >
          Voltar para o login
        </Link>
      </div>
    </AuthCard>
  );
}
