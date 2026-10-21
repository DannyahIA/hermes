'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';

import {
  connectTelegramAction,
  disconnectTelegramAction,
  setTelegramPrivacyAction,
} from './actions';
import { CopyField } from './copy-field';

/** How often the page looks for the chat while a link is out. */
const REFRESH_MS = 4_000;

interface TelegramConnectionProps {
  /** The bot's username, or null when it isn't set up. */
  botUsername: string | null;
  /** "Conectado como @dan desde 17/10", when a chat is connected. */
  connected: string | null;
  /** Whether payment messages say what is still free to spend. */
  showFree: boolean;
}

/**
 * Connecting the Telegram chat (spec 2026-10-17-telegram-apple-pay-
 * design.md §5.1, §6): a one-time link starts the bot, and the page
 * updates on its own when the chat shows up.
 */
export function TelegramConnection({
  botUsername,
  connected,
  showFree,
}: TelegramConnectionProps) {
  if (!botUsername) {
    return (
      <p className="text-muted-foreground text-sm">
        O bot ainda não está configurado. Crie um no @BotFather e defina{' '}
        <code className="dimension-figure text-xs">TELEGRAM_BOT_TOKEN</code> e{' '}
        <code className="dimension-figure text-xs">TELEGRAM_BOT_USERNAME</code>{' '}
        no servidor, junto com{' '}
        <code className="dimension-figure text-xs">pnpm telegram:poll</code>.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {connected ? <Connected status={connected} /> : <Connect />}
      <FreeLinePreference showFree={showFree} />
    </div>
  );
}

function Connect() {
  const router = useRouter();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // While the link is good, look now and then for the chat to show up;
  // once it does, this part of the page is replaced.
  useEffect(() => {
    if (!link) return;
    const expiresAt = new Date(link.expiresAt).getTime();
    const timer = setInterval(() => {
      if (Date.now() >= expiresAt) {
        setLink(null);
        return;
      }
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [link, router]);

  function connect() {
    setError(null);
    startTransition(async () => {
      const result = await connectTelegramAction();
      if (result.success) setLink(result);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {link ? (
        <>
          <p className="text-sm">
            Abra o link no celular e toque em <strong>Começar</strong> no
            Telegram. Esta página se atualiza sozinha quando o chat se conectar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={link.url} target="_blank" rel="noreferrer">
                Abrir no Telegram
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={connect}
              disabled={isPending}
            >
              Gerar outro link
            </Button>
          </div>
          <CopyField label="Link de conexão" value={link.url} />
          <p className="text-muted-foreground text-xs">
            Vale por 10 minutos, uma vez. No computador, copie e abra no
            celular.
          </p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Cada pagamento do iPhone chega no Telegram com botões para escolher
            a categoria, trocar débito por crédito, parcelar ou desfazer.
          </p>
          <Button type="button" onClick={connect} disabled={isPending}>
            {isPending ? 'Gerando link…' : 'Conectar Telegram'}
          </Button>
        </>
      )}
    </div>
  );
}

function Connected({ status }: { status: string }) {
  const [confirming, setConfirming] = useState(false);

  async function disconnect() {
    const result = await disconnectTelegramAction();
    toast(
      result.success
        ? { title: 'Telegram desconectado.', variant: 'success' }
        : { title: result.error, variant: 'error' },
    );
  }

  return (
    <div className="dimension-row gap-3">
      <p className="text-sm">{status}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Desconectar
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Desconectar o Telegram"
        description="O Hermes para de avisar os pagamentos no Telegram e os botões das mensagens deixam de funcionar. As compras continuam sendo registradas e esperam em Configurações."
        confirmLabel="Desconectar"
        onConfirm={disconnect}
      />
    </div>
  );
}

/**
 * Telegram chats with bots aren't end-to-end encrypted (spec §8): what is
 * free to spend can be kept out of them.
 */
function FreeLinePreference({ showFree }: { showFree: boolean }) {
  const [checked, setChecked] = useState(showFree);
  const [isPending, startTransition] = useTransition();

  function change(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setTelegramPrivacyAction(next);
      if (!result.success) {
        setChecked(!next);
        toast({ title: result.error, variant: 'error' });
      }
    });
  }

  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={(event) => change(event.target.checked)}
        className="border-input mt-0.5 h-4 w-4 rounded"
      />
      <span>
        Dizer em cada pagamento quanto ainda está livre para gastar
        <span className="text-muted-foreground block text-xs">
          As conversas com bots no Telegram não têm criptografia de ponta a
          ponta. Desmarque para não mandar saldos para lá.
        </span>
      </span>
    </label>
  );
}
