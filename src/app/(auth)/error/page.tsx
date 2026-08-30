import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

import { AuthCard } from '../auth-card';

interface ErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

/**
 * Where better-auth sends the browser when an OAuth flow fails — its
 * default `errorURL` is `${baseURL}/error` (see `src/infra/auth/server.ts`,
 * which doesn't override `onAPIError.errorURL`), and every OAuth callback
 * failure routes through that same redirect. Before this page existed, any
 * of these failures — most commonly a Google/GitHub sign-in whose e-mail
 * matches an existing account but can't be auto-linked (see
 * `account_not_linked` below) — landed the visitor on a raw 404 with no
 * explanation.
 *
 * `error` arrives as better-auth's error code with spaces replaced by
 * underscores (e.g. "account not linked" → `account_not_linked`); only the
 * codes realistically reachable from this app's configured flows
 * (email/password + optional Google/GitHub, no other OAuth-only provider
 * quirks) get a tailored message — everything else falls back to a generic
 * one instead of guessing at codes that can't actually occur here.
 */
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  account_not_linked: {
    title: 'Essa conta ainda não está conectada',
    description:
      'Já existe uma conta com esse e-mail. Entre com e-mail e senha para acessá-la — a conexão com o Google/GitHub poderá ser feita depois.',
  },
  unable_to_link_account: {
    title: 'Não foi possível conectar a conta',
    description:
      'Algo deu errado ao tentar conectar esse provedor à sua conta. Tente novamente ou entre com e-mail e senha.',
  },
  state_mismatch: {
    title: 'A sessão de login expirou',
    description:
      'O link de autenticação expirou ou já foi usado. Tente entrar novamente.',
  },
  oauth_code_verification_failed: {
    title: 'Não foi possível confirmar o login',
    description:
      'O provedor não confirmou a autenticação a tempo. Tente entrar novamente.',
  },
};

const DEFAULT_ERROR = {
  title: 'Não foi possível entrar',
  description:
    'Algo deu errado durante o login. Tente novamente ou entre com e-mail e senha.',
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const { error } = await searchParams;
  const { title, description } =
    (error && ERROR_MESSAGES[error]) || DEFAULT_ERROR;

  return (
    <AuthCard
      code="F.00"
      eyebrow="Hermes · Nota de revisão"
      title={title}
      description={description}
      tone="error"
    >
      <Button asChild className="w-full">
        <Link href={ROUTES.login}>Voltar para o login</Link>
      </Button>
    </AuthCard>
  );
}
