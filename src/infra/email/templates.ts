import { APP_NAME } from '@/config/constants';

function wrapper(
  title: string,
  message: string,
  url: string,
  ctaLabel: string,
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #4338ca; margin-bottom: 8px;">${APP_NAME}</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
      <p style="font-size: 14px; color: #475569; line-height: 1.5;">${message}</p>
      <a href="${url}" style="display: inline-block; margin-top: 24px; padding: 12px 20px; background: #4338ca; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 600;">${ctaLabel}</a>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Se você não pediu isso, pode ignorar este e-mail.</p>
    </div>
  `;
}

export function verificationEmailTemplate(url: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Confirme seu e-mail — ${APP_NAME}`,
    html: wrapper(
      'Confirme seu e-mail',
      'Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.',
      url,
      'Confirmar e-mail',
    ),
  };
}

export function resetPasswordEmailTemplate(url: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Redefinir senha — ${APP_NAME}`,
    html: wrapper(
      'Redefinir sua senha',
      'Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova.',
      url,
      'Redefinir senha',
    ),
  };
}
